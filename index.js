import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { WPlacer, log, duration } from "./wplacer.js";
import express from "express";

// User data handling
const users = existsSync("users.json") ? JSON.parse(readFileSync("users.json", "utf8")) : {};
const saveUsers = () => writeFileSync("users.json", JSON.stringify(users));

// Template data handling
const templates = {};
const saveTemplates = () => {
    const templatesToSave = {};
    for (const id in templates) {
        const t = templates[id];
        templatesToSave[id] = {
            name: t.name,
            template: t.template,
            coords: t.coords,
            canBuyCharges: t.canBuyCharges,
            canBuyMaxCharges: t.canBuyMaxCharges,
            userIds: t.userIds,
            drawingMethod: t.drawingMethod
        };
    }
    writeFileSync("templates.json", JSON.stringify(templatesToSave, null, 4));
};

const app = express();
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

let currentSettings = {
    turnstileNotifications: false,
    accountCooldown: 20000
};

const sseClients = new Set();
let needToken = true;

function sseBroadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) res.write(payload);
}

function requestTokenFromClients(reason = "unknown") {
    if (sseClients.size === 0) {
        needToken = true;
        return;
    }
    sseBroadcast("request-token", { reason });
}

function logUserError(error, id, name, context) {
    if (error.message && error.message.includes("(500)")) {
        log(id, name, `🔑 Failed to ${context}: Expired or invalid cookie.`);
    } else {
        log(id, name, `Failed to ${context}`, error);
    }
}

class TemplateManager {
    constructor(name, templateData, coords, canBuyCharges, canBuyMaxCharges, userIds, drawingMethod) {
        this.name = name;
        this.template = templateData;
        this.coords = coords;
        this.canBuyCharges = canBuyCharges;
        this.canBuyMaxCharges = canBuyMaxCharges;
        this.userIds = userIds;
        this.drawingMethod = drawingMethod || 'linear';
        this.running = false;
        this.status = "Waiting to be started.";
        this.activeWplacer = null;
        this.turnstileToken = null;
        this.masterId = this.userIds[0];
        this.masterName = users[this.masterId].name;
        this.masterIdentifier = this.userIds.map(id => `${users[id].name}#${id}`).join(', ');
        this.isFirstRun = true;
    }
    sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
    setToken(t) { 
        this.turnstileToken = t;
        if (this.activeWplacer) this.activeWplacer.setToken(t); 
    }
    async handleUpgrades(wplacer) {
        if (this.canBuyMaxCharges) {
            await wplacer.loadUserInfo(); // Refresh user info to get latest droplet count
            while (wplacer.userInfo.droplets >= 500) {
                log(wplacer.userInfo.id, wplacer.userInfo.name, `💰 Attempting to buy max charge upgrade. Droplets: ${wplacer.userInfo.droplets}`);
                await wplacer.buyProduct(70, 1);
                await this.sleep(10000);
                await wplacer.loadUserInfo();
            }
        }
    }
    async start() {
        this.running = true;
        this.status = "Started.";
        log('SYSTEM', 'wplacer', `▶️ Starting template "${this.name}" for users: ${this.masterIdentifier}...`);
        
        while (this.running) {
            if (this.isFirstRun) {
                log('SYSTEM', 'wplacer', `🚀 Calculating initial placement order for "${this.name}"...`);
                const userChargeStates = await Promise.all(this.userIds.map(async (userId) => {
                    const wplacer = new WPlacer(null, null, null, requestTokenFromClients, currentSettings);
                    try {
                        await wplacer.login(users[userId].cookies);
                        const diff = wplacer.userInfo.charges.max - wplacer.userInfo.charges.count;
                        return { userId, diff };
                    } catch (error) {
                        logUserError(error, userId, users[userId].name, "fetch charge state for initial sort");
                        return { userId, diff: Infinity }; // Put failing accounts at the end
                    } finally {
                        await wplacer.close();
                    }
                }));

                userChargeStates.sort((a, b) => a.diff - b.diff);
                const sortedUserIds = userChargeStates.map(u => u.userId);
                const sortedUserNames = sortedUserIds.map(id => `${users[id].name}#${id}`).join(', ');

                log('SYSTEM', 'wplacer', `✅ Initial placement order determined: ${sortedUserNames}`);
                
                for (let i = 0; i < sortedUserIds.length; i++) {
                    const userId = sortedUserIds[i];
                    if (!this.running) break;
                    const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
                    wplacer.token = this.turnstileToken;
                    try {
                        const { id, name } = await wplacer.login(users[userId].cookies);
                        this.status = `Initial run for ${name}#${id}`;
                        log(id, name, `🏁 Starting initial turn for "${this.name}"...`);
                        this.activeWplacer = wplacer;
                        await wplacer.paint(this.drawingMethod);
                        this.turnstileToken = wplacer.token;
                        await this.handleUpgrades(wplacer);
                        if (await wplacer.pixelsLeft() === 0) {
                            log('SYSTEM', 'wplacer', `🖼 Template "${this.name}" finished during initial run!`);
                            this.running = false;
                        }
                    } catch (error) {
                        logUserError(error, userId, users[userId].name, "perform initial user turn");
                    } finally {
                        if (wplacer.browser) await wplacer.close();
                        this.activeWplacer = null;
                    }
                    if (this.running && i < sortedUserIds.length - 1) {
                        log('SYSTEM', 'wplacer', `⏱️ Initial cycle: Waiting ${currentSettings.accountCooldown / 1000} seconds before next user.`);
                        await this.sleep(currentSettings.accountCooldown);
                    }
                }
                this.isFirstRun = false;
                log('SYSTEM', 'wplacer', `✅ Initial placement cycle for "${this.name}" complete.`);
                if (!this.running) break;
            }
            let readyUserWplacer = null;
            let minTimeToReady = Infinity;
            for (const userId of this.userIds) {
                const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
                try {
                    await wplacer.login(users[userId].cookies);
                    const threshold = wplacer.userInfo.charges.max * 0.75;

                    if (wplacer.userInfo.charges.count >= threshold) {
                        readyUserWplacer = wplacer;
                        break;
                    } else {
                        const needed = threshold - wplacer.userInfo.charges.count;
                        const time = needed * wplacer.userInfo.charges.cooldownMs;
                        if (time < minTimeToReady) minTimeToReady = time;
                        await wplacer.close();
                    }
                } catch (error) {
                    logUserError(error, userId, users[userId].name, "check user status");
                    await wplacer.close();
                }
            }
            if (readyUserWplacer) {
                const { id, name } = readyUserWplacer.userInfo;
                this.status = `Running user ${name}#${id}`;
                log(id, name, `🔋 User has reached charge threshold. Starting turn for "${this.name}"...`);
                this.activeWplacer = readyUserWplacer;
                readyUserWplacer.token = this.turnstileToken;
                try {
                    await readyUserWplacer.paint(this.drawingMethod);
                    this.turnstileToken = readyUserWplacer.token;
                    await this.handleUpgrades(readyUserWplacer);
                    if (await readyUserWplacer.pixelsLeft() === 0) {
                        log('SYSTEM', 'wplacer', `🖼 Template "${this.name}" finished!`);
                        this.running = false;
                    }
                } catch (error) {
                    logUserError(error, id, name, "perform paint turn");
                } finally {
                    await readyUserWplacer.close();
                    this.activeWplacer = null;
                }
                if (this.running && this.userIds.length > 1) {
                    log('SYSTEM', 'wplacer', `⏱️ Turn finished. Waiting ${currentSettings.accountCooldown / 1000} seconds before checking next account.`);
                    await this.sleep(currentSettings.accountCooldown);
                }
            } else if (this.running) {
                if (this.canBuyCharges) {
                    const chargeBuyer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
                    try {
                        await chargeBuyer.login(users[this.masterId].cookies);
                        if(chargeBuyer.userInfo.droplets >= 500) {
                            const pixelsLeft = await chargeBuyer.pixelsLeft();
                            const needed = Math.ceil(pixelsLeft / 30);
                            const maxAffordable = Math.floor(chargeBuyer.userInfo.droplets / 500);
                            const amountToBuy = Math.min(needed, maxAffordable);
                            if (amountToBuy > 0) {
                                log(this.masterId, this.masterName, `💰 Attempting to buy pixel charges for "${this.name}"...`);
                                await chargeBuyer.buyProduct(80, amountToBuy);
                                await this.sleep(10000);
                                await chargeBuyer.close();
                                continue;
                            }
                        }
                    } catch (error) {
                         logUserError(error, this.masterId, this.masterName, "attempt to buy pixel charges");
                    } finally {
                        await chargeBuyer.close();
                    }
                }
                if (minTimeToReady === Infinity) {
                    log('SYSTEM', 'wplacer', "⚠️ Could not determine wait time for any user. Waiting 60s.");
                    minTimeToReady = 60000;
                }
                const waitTime = minTimeToReady + 2000;
                this.status = `Waiting for charges.`;
                log('SYSTEM', 'wplacer', `⏳ No users have reached charge threshold for "${this.name}". Waiting for next recharge in ${duration(waitTime)}...`);
                await this.sleep(waitTime);
            }
        }
        if (this.status !== "Finished.") {
            this.status = "Stopped.";
            log('SYSTEM', 'wplacer', `✖️ Template "${this.name}" stopped.`);
        }
    }
}

app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.write("retry: 1000\n\n");

    sseClients.add(res);

    if (needToken) {
        res.write(`event: request-token\ndata: ${JSON.stringify({ reason: "client-connect" })}\n\n`);
        needToken = false;
    }

    req.on("close", () => {
        sseClients.delete(res);
    });
});

// frontend endpoints
app.get("/users", (_, res) => res.json(users));
app.get("/templates", (_, res) => res.json(templates));
app.get('/settings', (_, res) => res.json(currentSettings));
app.put('/settings', (req, res) => {
    currentSettings = { ...currentSettings, ...req.body };
    res.sendStatus(200);
});
app.get("/user/status/:id", async (req, res) => {
    const { id } = req.params;
    if (!users[id]) return res.sendStatus(404);
    const wplacer = new WPlacer();
    try {
        await wplacer.login(users[id].cookies);
        res.sendStatus(200);
    } catch (error) {
        logUserError(error, id, users[id].name, "validate cookie");
        res.status(500).json({ error: error.message });
    } finally {
        await wplacer.close();
    }
});
app.post("/user", async (req, res) => {
    if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
    const wplacer = new WPlacer();
    try {
        const userInfo = await wplacer.login(req.body.cookies);
        users[userInfo.id] = { name: userInfo.name, cookies: req.body.cookies };
        saveUsers();
        res.json(userInfo);
    } catch (error) {
        if (error.message && error.message.includes("(500)")) {
            console.log(`❌ Error adding new user: ${error.message}`);
        } else {
            console.log("❌ Error adding new user:", error);
        }
        res.status(500).json({ error: error.message });
    } finally {
        await wplacer.close();
    }
});
app.post("/template", async (req, res) => {
    if (!req.body.templateName || !req.body.template || !req.body.coords || !req.body.userIds || !req.body.userIds.length) return res.sendStatus(400);
    
    const isDuplicateName = Object.values(templates).some(t => t.name === req.body.templateName);
    if (isDuplicateName) {
        return res.status(409).json({ error: "A template with this name already exists." });
    }

    const wplacer = new WPlacer();
    try {
        await wplacer.login(users[req.body.userIds[0]].cookies);
        const templateId = Date.now().toString();
        templates[templateId] = new TemplateManager(req.body.templateName, req.body.template, req.body.coords, req.body.canBuyCharges, req.body.canBuyMaxCharges, req.body.userIds, req.body.drawingMethod);
        saveTemplates();
        res.status(200).json({ id: templateId });
    } catch (error) {
        logUserError(error, req.body.userIds[0], users[req.body.userIds[0]].name, "create template");
        res.status(500).json({ error: error.message });
    } finally {
        await wplacer.close();
    }
});
app.delete("/user/:id", async (req, res) => {
    if (!req.params.id || !users[req.params.id]) return res.sendStatus(400);
    delete users[req.params.id];
    saveUsers();
    res.sendStatus(200);
});
app.delete("/template/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id] || templates[req.params.id].running) return res.sendStatus(400);
    delete templates[req.params.id];
    saveTemplates();
    res.sendStatus(200);
});
app.put("/template/image/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id] || !req.body.template) return res.sendStatus(400);
    const manager = templates[req.params.id];
    manager.template = req.body.template;
    saveTemplates();
    res.sendStatus(200);
});
app.put("/template/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id]) return res.sendStatus(400);
    const manager = templates[req.params.id];
    for (const i of Object.keys(req.body)) {
        if (i === "running") {
            if (req.body.running && !manager.running) {
                try {
                    manager.start();
                } catch (error) {
                    log(req.params.id, manager.masterName, "Error starting template", error);
                };
            } else manager.running = false;
        } else manager[i] = req.body[i];
    };
    res.sendStatus(200);
});
app.put("/template/restart/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id]) return res.sendStatus(400);
    const manager = templates[req.params.id];
    manager.running = false;
    setTimeout(() => {
        manager.isFirstRun = true;
        manager.start().catch(error => log(req.params.id, manager.masterName, "Error restarting template", error));
    }, 1000);
    res.sendStatus(200);
});

// client endpoints
app.get("/ping", (_, res) => res.send("Pong!"));
app.post("/t", async (req, res) => {
    const { t } = req.body;
    if (!t) return res.sendStatus(400);
    for (const id in templates) {
        if (templates[id]) {
            templates[id].setToken(t);
        }
    }
    res.sendStatus(200);
});

// starting
const diffVer = (v1, v2) => v1.split(".").map(Number).reduce((r, n, i) => r || (n - v2.split(".")[i]) * (i ? 10 ** (2 - i) : 100), 0);
(async () => {
    const version = JSON.parse(readFileSync("package.json", "utf8")).version;
    console.log(`🌐 wplacer by luluwaffless and jinx (${version})`);

    // Load saved templates
    if (existsSync("templates.json")) {
        const loadedTemplates = JSON.parse(readFileSync("templates.json", "utf8"));
        for (const id in loadedTemplates) {
            const t = loadedTemplates[id];
            if (t.userIds.every(uid => users[uid])) {
                templates[id] = new TemplateManager(t.name, t.template, t.coords, t.canBuyCharges, t.canBuyMaxCharges, t.userIds, t.drawingMethod);
            } else {
                console.warn(`⚠️ Template "${t.name}" could not be loaded because one or more user IDs are missing from users.json. It will be removed on the next save.`);
            }
        }
        console.log(`✅ Loaded ${Object.keys(templates).length} templates.`);
    }

    // check for updates
    const githubPackage = await fetch("https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/package.json");
    const githubVersion = (await githubPackage.json()).version;
    const diff = diffVer(version, githubVersion);
    if (diff !== 0) console.warn(`${diff < 0 ? "⚠️ Outdated version! Please update using \"git pull\"." : "🤖 Unreleased."}\n  GitHub: ${githubVersion}\n  Local: ${version} (${diff})`);
    
    // start server
    const port = Number(process.env.PORT) || 80;
    const host = process.env.HOST || "127.0.0.1";
    app.listen(port, host, () => {
        console.log(`✅ Open http://${host}${port !== 80 ? `:${port}` : ""}/ in your browser to start!`);
        requestTokenFromClients("server-start");
    });
})();