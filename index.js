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
            antiGriefMode: t.antiGriefMode,
            userIds: t.userIds
        };
    }
    writeFileSync("templates.json", JSON.stringify(templatesToSave, null, 4));
};

const app = express();
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

let currentSettings = {
    turnstileNotifications: false,
    accountCooldown: 20000,
    dropletReserve: 0,
    antiGriefStandby: 300000,
    drawingMethod: 'linear',
    chargeThreshold: 0.5
};
if (existsSync("settings.json")) {
    currentSettings = { ...currentSettings, ...JSON.parse(readFileSync("settings.json", "utf8")) };
}
const saveSettings = () => writeFileSync("settings.json", JSON.stringify(currentSettings, null, 4));


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
    const message = error.message || "An unknown error occurred.";
    if (message.includes("(500)") || message.includes("(1015)")) {
        log(id, name, `❌ Failed to ${context}: ${message}`);
    } else {
        log(id, name, `❌ Failed to ${context}`, error);
    }
}

class TemplateManager {
    constructor(name, templateData, coords, canBuyCharges, canBuyMaxCharges, antiGriefMode, userIds) {
        this.name = name;
        this.template = templateData;
        this.coords = coords;
        this.canBuyCharges = canBuyCharges;
        this.canBuyMaxCharges = canBuyMaxCharges;
        this.antiGriefMode = antiGriefMode;
        this.userIds = userIds;
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
            await wplacer.loadUserInfo();
            const affordableDroplets = wplacer.userInfo.droplets - currentSettings.dropletReserve;
            const amountToBuy = Math.floor(affordableDroplets / 500);

            if (amountToBuy > 0) {
                log(wplacer.userInfo.id, wplacer.userInfo.name, `💰 Attempting to buy ${amountToBuy} max charge upgrade(s).`);
                try {
                    await wplacer.buyProduct(70, amountToBuy);
                    await this.sleep(10000); // Wait for the purchase to process
                    await wplacer.loadUserInfo(); // Refresh user info after purchase
                } catch (error) {
                    logUserError(error, wplacer.userInfo.id, wplacer.userInfo.name, "purchase max charge upgrades");
                }
            }
        }
    }
    async start() {
        this.running = true;
        this.status = "Started.";
        log('SYSTEM', 'wplacer', `▶️ Starting template "${this.name}"...`);

        while (this.running) {
            if (this.isFirstRun) {
                log('SYSTEM', 'wplacer', `🚀 Performing initial painting cycle for "${this.name}"...`);
                for (const userId of this.userIds) {
                    if (!this.running) break;
                    const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
                    wplacer.token = this.turnstileToken;
                    try {
                        const { id, name } = await wplacer.login(users[userId].cookies);
                        this.status = `Initial run for ${name}#${id}`;
                        log(id, name, `🏁 Starting initial turn...`);
                        this.activeWplacer = wplacer;
                        await wplacer.paint(currentSettings.drawingMethod);
                        this.turnstileToken = wplacer.token;
                        await this.handleUpgrades(wplacer);
                        
                        if (await wplacer.pixelsLeft() === 0) {
                            this.running = false; // Stop the main loop
                            break; // Exit the initial run loop
                        }
                    } catch (error) {
                        logUserError(error, userId, users[userId].name, "perform initial user turn");
                    } finally {
                        if (wplacer.browser) await wplacer.close();
                        this.activeWplacer = null;
                    }
                     if (this.running && this.userIds.length > 1) {
                        log('SYSTEM', 'wplacer', `⏱️ Initial cycle: Waiting ${currentSettings.accountCooldown / 1000} seconds before next user.`);
                        await this.sleep(currentSettings.accountCooldown);
                    }
                }
                this.isFirstRun = false;
                log('SYSTEM', 'wplacer', `✅ Initial placement cycle for "${this.name}" complete.`);
                if (!this.running) continue; // Skip to the main loop's completion check
            }

            const checkWplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
            let pixelsRemaining;
            try {
                await checkWplacer.login(users[this.masterId].cookies);
                pixelsRemaining = await checkWplacer.pixelsLeft();
            } catch (error) {
                logUserError(error, this.masterId, this.masterName, "check pixels left");
                await this.sleep(60000);
                continue;
            } finally {
                await checkWplacer.close();
            }

            if (pixelsRemaining === 0) {
                if (this.antiGriefMode) {
                    this.status = "Monitoring for changes.";
                    log('SYSTEM', 'wplacer', `🖼 Template "${this.name}" is complete. Monitoring... Checking again in ${currentSettings.antiGriefStandby / 60000} minutes.`);
                    await this.sleep(currentSettings.antiGriefStandby);
                    continue;
                } else {
                    log('SYSTEM', 'wplacer', `🖼 Template "${this.name}" finished!`);
                    this.status = "Finished.";
                    this.running = false;
                    break;
                }
            }

            let userStates = [];
            for (const userId of this.userIds) {
                 const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
                 try {
                     await wplacer.login(users[userId].cookies);
                     userStates.push({ userId, charges: wplacer.userInfo.charges, cooldownMs: wplacer.userInfo.charges.cooldownMs });
                 } catch (error) {
                     logUserError(error, userId, users[userId].name, "check user status");
                 } finally {
                     await wplacer.close();
                 }
            }
            
            const readyUsers = userStates.filter(u => u.charges.count >= u.charges.max * currentSettings.chargeThreshold);
            let userToRun = null;

            if (readyUsers.length > 0) {
                userToRun = readyUsers[0];
            } else {
                userStates.sort((a, b) => b.charges.count - a.charges.count);
                if (userStates.length > 0 && userStates[0].charges.count > 0) {
                    userToRun = userStates[0];
                }
            }

            if (userToRun) {
                const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
                try {
                    const { id, name } = await wplacer.login(users[userToRun.userId].cookies);
                    this.status = `Running user ${name}#${id}`;
                    log(id, name, `🔋 User has enough charges. Starting turn for "${this.name}"...`);
                    this.activeWplacer = wplacer;
                    wplacer.token = this.turnstileToken;
                    await wplacer.paint(currentSettings.drawingMethod);
                    this.turnstileToken = wplacer.token;
                    await this.handleUpgrades(wplacer);
                } catch (error) {
                    logUserError(error, userToRun.userId, users[userToRun.userId].name, "perform paint turn");
                } finally {
                    await wplacer.close();
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
                        const affordableDroplets = chargeBuyer.userInfo.droplets - currentSettings.dropletReserve;
                        if(affordableDroplets >= 500) {
                            const maxAffordable = Math.floor(affordableDroplets / 500);
                            const amountToBuy = Math.min(Math.ceil(pixelsRemaining / 30), maxAffordable);
                            if (amountToBuy > 0) {
                                log(this.masterId, this.masterName, `💰 Attempting to buy pixel charges for "${this.name}"...`);
                                await chargeBuyer.buyProduct(80, amountToBuy);
                                await this.sleep(10000);
                                continue;
                            }
                        }
                    } catch (error) {
                         logUserError(error, this.masterId, this.masterName, "attempt to buy pixel charges");
                    } finally {
                        await chargeBuyer.close();
                    }
                }
                
                const minTimeToReady = Math.min(...userStates.map(u => (u.charges.max * currentSettings.chargeThreshold - u.charges.count) * u.cooldownMs));
                const waitTime = (minTimeToReady > 0 ? minTimeToReady : 60000) + 2000;
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
    saveSettings();
    res.sendStatus(200);
});
app.get("/user/status/:id", async (req, res) => {
    const { id } = req.params;
    if (!users[id]) return res.sendStatus(404);
    const wplacer = new WPlacer();
    try {
        const userInfo = await wplacer.login(users[id].cookies);
        res.status(200).json(userInfo);
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
        logUserError(error, 'NEW_USER', 'N/A', 'add new user');
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
        templates[templateId] = new TemplateManager(req.body.templateName, req.body.template, req.body.coords, req.body.canBuyCharges, req.body.canBuyMaxCharges, req.body.antiGriefMode, req.body.userIds);
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
app.get("/canvas", async (req, res) => {
    const { tx, ty } = req.query;
    // Validate tx and ty: must be non-negative integers
    const txInt = Number.isInteger(Number(tx)) ? Number(tx) : NaN;
    const tyInt = Number.isInteger(Number(ty)) ? Number(ty) : NaN;
    if (
        tx === undefined || ty === undefined ||
        isNaN(txInt) || isNaN(tyInt) ||
        txInt < 0 || tyInt < 0
    ) {
        return res.sendStatus(400);
    }
    try {
        const url = `https://backend.wplace.live/files/s0/tiles/${txInt}/${tyInt}.png`;
        const response = await fetch(url);
        if (!response.ok) return res.sendStatus(response.status);
        const buffer = Buffer.from(await response.arrayBuffer());
        res.json({ image: `data:image/png;base64,${buffer.toString('base64')}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
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
                templates[id] = new TemplateManager(t.name, t.template, t.coords, t.canBuyCharges, t.canBuyMaxCharges, t.antiGriefMode, t.userIds);
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