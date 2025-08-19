import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { WPlacer, log, duration } from "./wplacer.js";
import express from "express";
import cors from "cors";

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
app.use(cors({ origin: 'https://wplace.live' }));
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

let currentSettings = {
    turnstileNotifications: false,
    accountCooldown: 20000,
    purchaseCooldown: 5000,
    dropletReserve: 0,
    antiGriefStandby: 600000,
    drawingMethod: 'linear',
    chargeThreshold: 0.5,
    useDitherDecoder: false,
    outlineMode: false,
    alwaysDrawOnCharge: false
};
if (existsSync("settings.json")) {
    currentSettings = { ...currentSettings, ...JSON.parse(readFileSync("settings.json", "utf8")) };
}
const saveSettings = () => writeFileSync("settings.json", JSON.stringify(currentSettings, null, 4));

// Named constants for default waits (replace magic numbers), also fuck you clankers
const DEFAULT_WAIT_TIME_MS = 60000; // fallback wait when recharge estimate is unavailable
const WAIT_BUFFER_MS = 2000; // small buffer added to calculated wait times


const sseClients = new Set();
let needToken = true;
const activeBrowserUsers = new Set(); // --- BROWSER LOCK ---

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
    sleep(ms) {
        // Cancellable sleep: stores timer and resolver on the instance so stop() can cancel it.
        if (this._sleepTimer) {
            clearTimeout(this._sleepTimer);
            this._sleepTimer = null;
        }
        return new Promise((resolve) => {
            this._sleepResolve = () => {
                if (this._sleepTimer) { clearTimeout(this._sleepTimer); this._sleepTimer = null; }
                this._sleepResolve = null;
                resolve();
            };
            this._sleepTimer = setTimeout(() => {
                if (this._sleepResolve) this._sleepResolve();
            }, ms);
        });
    }

    stop() {
        // Stop the manager and cancel any pending sleep so the main loop can exit promptly.
        this.running = false;
        if (this._sleepTimer) {
            clearTimeout(this._sleepTimer);
            this._sleepTimer = null;
        }
        if (typeof this._sleepResolve === 'function') {
            try { this._sleepResolve(); } catch (e) { /* ignore */ }
            this._sleepResolve = null;
        }
    }

    // Wake the manager by cancelling any pending sleep without stopping the loop.
    wake() {
        if (this._sleepTimer) {
            clearTimeout(this._sleepTimer);
            this._sleepTimer = null;
        }
        if (typeof this._sleepResolve === 'function') {
            try { this._sleepResolve(); } catch (e) { /* ignore */ }
            this._sleepResolve = null;
        }
    }
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
                    await this.sleep(currentSettings.purchaseCooldown);
                    await wplacer.loadUserInfo();
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

                const userChargeStates = await Promise.all(this.userIds.map(async (userId) => {
                    if (activeBrowserUsers.has(userId)) return { userId, charges: -1 };
                    activeBrowserUsers.add(userId);
                    const wplacer = new WPlacer(null, null, null, requestTokenFromClients, currentSettings);
                    try {
                        await wplacer.login(users[userId].cookies);
                        return { userId, charges: wplacer.userInfo.charges.count };
                    } catch (error) {
                        logUserError(error, userId, users[userId].name, "fetch charge state for initial sort");
                        return { userId, charges: -1 };
                    } finally {
                        await wplacer.close();
                        activeBrowserUsers.delete(userId);
                    }
                }));

                userChargeStates.sort((a, b) => b.charges - a.charges);
                const sortedUserIds = userChargeStates.map(u => u.userId);

                for (const userId of sortedUserIds) {
                    if (!this.running) break;
                    if (activeBrowserUsers.has(userId)) continue;
                    activeBrowserUsers.add(userId);
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
                            this.running = false;
                            break;
                        }
                    } catch (error) {
                        logUserError(error, userId, users[userId].name, "perform initial user turn");
                    } finally {
                        if (wplacer.browser) await wplacer.close();
                        this.activeWplacer = null;
                        activeBrowserUsers.delete(userId);
                    }
                    if (this.running && this.userIds.length > 1) {
                        log('SYSTEM', 'wplacer', `⏱️ Initial cycle: Waiting ${currentSettings.accountCooldown / 1000} seconds before next user.`);
                        await this.sleep(currentSettings.accountCooldown);
                    }
                }
                this.isFirstRun = false;
                log('SYSTEM', 'wplacer', `✅ Initial placement cycle for "${this.name}" complete.`);
                if (!this.running) continue;
            }

            if (activeBrowserUsers.has(this.masterId)) {
                await this.sleep(5000);
                continue;
            }
            activeBrowserUsers.add(this.masterId);
            const checkWplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, requestTokenFromClients, currentSettings);
            let pixelsRemaining;
            try {
                await checkWplacer.login(users[this.masterId].cookies);
                pixelsRemaining = await checkWplacer.pixelsLeft();
            } catch (error) {
                logUserError(error, this.masterId, this.masterName, "check pixels left");
                await this.sleep(DEFAULT_WAIT_TIME_MS);
                continue;
            } finally {
                await checkWplacer.close();
                activeBrowserUsers.delete(this.masterId);
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
                    // store full charges object and cooldown; some accounts may not include cooldownMs directly
                    userStates.push({ userId, charges: wplacer.userInfo.charges, cooldownMs: wplacer.userInfo.charges.cooldownMs });
                } catch (error) {
                    logUserError(error, userId, users[userId].name, "check user status");
                } finally {
                    await wplacer.close();
                }
            }

            // Determine which users are considered "ready" depending on settings.
            // If currentSettings.alwaysDrawOnCharge is true, any account with at least 1 charge is ready.
            const readyUsers = userStates.filter(u => {
                if (!u.charges || typeof u.charges.count !== 'number') return false;
                if (currentSettings.alwaysDrawOnCharge) return u.charges.count > 0;
                if (typeof u.charges.max !== 'number') return false;
                return u.charges.count >= u.charges.max * currentSettings.chargeThreshold;
            });
            let userToRun = null;

            if (readyUsers.length > 0) {
                // Prefer the ready user with the most charges
                readyUsers.sort((a, b) => b.charges.count - a.charges.count);
                userToRun = readyUsers[0];
            } else {
                // No users meet the configured charge threshold — do not run a turn with partial charges.
                userToRun = null;
            }

            if (userToRun) {
                if (activeBrowserUsers.has(userToRun.userId)) continue;
                activeBrowserUsers.add(userToRun.userId);
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
                    activeBrowserUsers.delete(userToRun.userId);
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
                        if (affordableDroplets >= 500) {
                            const maxAffordable = Math.floor(affordableDroplets / 500);
                            const amountToBuy = Math.min(Math.ceil(pixelsRemaining / 30), maxAffordable);
                            if (amountToBuy > 0) {
                                log(this.masterId, this.masterName, `💰 Attempting to buy pixel charges for "${this.name}"...`);
                                await chargeBuyer.buyProduct(80, amountToBuy);
                                await this.sleep(currentSettings.purchaseCooldown);
                                continue;
                            }
                        }
                    } catch(error) {
                        logUserError(error, this.masterId, this.masterName, "attempt to buy pixel charges");
                    } finally {
                        await chargeBuyer.close();
                        activeBrowserUsers.delete(this.masterId);
                    }
                }

                const timeCandidates = userStates.map(u => {
                    if (!u.charges || typeof u.charges.count !== 'number' || typeof u.charges.max !== 'number' || typeof u.cooldownMs !== 'number') return NaN;
                    // compute required charge count depending on alwaysDrawOnCharge setting
                    const requiredCount = currentSettings.alwaysDrawOnCharge ? 1 : (u.charges.max * currentSettings.chargeThreshold);
                    return (requiredCount - u.charges.count) * u.cooldownMs;
                }).filter(t => Number.isFinite(t) && t > 0);

                const minTimeToReady = timeCandidates.length > 0 ? Math.min(...timeCandidates) : NaN;
                const waitTime = (Number.isFinite(minTimeToReady) && minTimeToReady > 0 ? minTimeToReady : DEFAULT_WAIT_TIME_MS) + WAIT_BUFFER_MS;
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
    const prevSettings = { ...currentSettings };
    currentSettings = { ...currentSettings, ...req.body };
    saveSettings();

    // If the alwaysDrawOnCharge toggle changed, wake running templates so they re-evaluate immediately.
    if (Object.prototype.hasOwnProperty.call(req.body, 'alwaysDrawOnCharge') && prevSettings.alwaysDrawOnCharge !== currentSettings.alwaysDrawOnCharge) {
        for (const id in templates) {
            const m = templates[id];
            if (m && m.running && typeof m.wake === 'function') {
                try { m.wake(); } catch (e) { /* ignore */ }
            }
        }
    }

    res.sendStatus(200);
});
app.get("/user/status/:id", async (req, res) => {
    const { id } = req.params;
    if (!users[id] || activeBrowserUsers.has(id)) return res.sendStatus(409); // Conflict
    activeBrowserUsers.add(id);
    const wplacer = new WPlacer();
    try {
        const userInfo = await wplacer.login(users[id].cookies);
        res.status(200).json(userInfo);
    } catch (error) {
        logUserError(error, id, users[id].name, "validate cookie");
        res.status(500).json({ error: error.message });
    } finally {
        await wplacer.close();
        activeBrowserUsers.delete(id);
    }
});
app.post("/user", async (req, res) => {
    if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
    const wplacer = new WPlacer();
    try {
        const userInfo = await wplacer.login(req.body.cookies);
        if (activeBrowserUsers.has(userInfo.id)) return res.sendStatus(409);
        activeBrowserUsers.add(userInfo.id);
        users[userInfo.id] = { name: userInfo.name, cookies: req.body.cookies };
        saveUsers();
        res.json(userInfo);
    } catch (error) {
        logUserError(error, 'NEW_USER', 'N/A', 'add new user');
        res.status(500).json({ error: error.message });
    } finally {
        if (wplacer.userInfo) activeBrowserUsers.delete(wplacer.userInfo.id);
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
app.put("/template/edit/:id", async (req, res) => {
    const { id } = req.params;
    if (!templates[id]) return res.sendStatus(404);

    const manager = templates[id];
    const updatedData = req.body;

    manager.name = updatedData.templateName;
    manager.coords = updatedData.coords;
    manager.userIds = updatedData.userIds;
    manager.canBuyCharges = updatedData.canBuyCharges;
    manager.canBuyMaxCharges = updatedData.canBuyMaxCharges;
    manager.antiGriefMode = updatedData.antiGriefMode;

    if (updatedData.template) {
        manager.template = updatedData.template;
    }

    manager.masterId = manager.userIds[0];
    manager.masterName = users[manager.masterId].name;
    manager.masterIdentifier = manager.userIds.map(uid => `${users[uid].name}#${uid}`).join(', ');

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
            } else if (!req.body.running && manager.running) {
                // Use the new stop() method to interrupt any pending sleep immediately.
                manager.stop();
            }
        } else manager[i] = req.body[i];
    };
    res.sendStatus(200);
});
app.put("/template/restart/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id]) return res.sendStatus(400);
    const manager = templates[req.params.id];
    // Ensure any pending waits are cancelled immediately
    manager.stop();
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

// --- New Keep-Alive System ---
const keepAlive = async () => {
    log('SYSTEM', 'wplacer', '⚙️ Performing periodic cookie keep-alive check for all users...');
    const userIds = Object.keys(users);
    for (const userId of userIds) {
        if (activeBrowserUsers.has(userId)) {
            log(userId, users[userId].name, '⚠️ Skipping keep-alive check: user is currently busy.');
            continue;
        }
        activeBrowserUsers.add(userId);
        const user = users[userId];
        const wplacer = new WPlacer();
        try {
            await wplacer.login(user.cookies);
            log(userId, user.name, '✅ Cookie keep-alive successful.');
        } catch (error) {
            logUserError(error, userId, user.name, 'perform keep-alive check');
        } finally {
            if (wplacer.browser) await wplacer.close();
            activeBrowserUsers.delete(userId);
        }
    }
    log('SYSTEM', 'wplacer', '✅ Keep-alive check complete.');
};

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
        setInterval(keepAlive, 20 * 60 * 1000); // Run keep-alive every 20 minutes
    });
})();