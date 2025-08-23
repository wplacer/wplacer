import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { WPlacer, log, duration } from "./wplacer.js";
import express from "express";
import cors from "cors";

// User data handling
const users = existsSync("users.json") ? JSON.parse(readFileSync("users.json", "utf8")) : {};
const saveUsers = () => writeFileSync("users.json", JSON.stringify(users, null, 4));

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
app.use(cors()); // Use a more flexible CORS policy
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

let currentSettings = {
    turnstileNotifications: false,
    accountCooldown: 20000,
    purchaseCooldown: 5000,
    keepAliveCooldown: 5000,
    dropletReserve: 0,
    antiGriefStandby: 600000,
    drawingMethod: 'linear',
    chargeThreshold: 0.5,
    outlineMode: false,
};
if (existsSync("settings.json")) {
    currentSettings = { ...currentSettings, ...JSON.parse(readFileSync("settings.json", "utf8")) };
}
const saveSettings = () => writeFileSync("settings.json", JSON.stringify(currentSettings, null, 4));


const sseClients = new Set();
const activeBrowserUsers = new Set(); // --- BROWSER LOCK ---
let activePaintingTasks = 0; // Counter for active painting managers

function sseBroadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) res.write(payload);
}

function requestTokenFromClients(reason = "unknown") {
    if (sseClients.size === 0) {
        log('SYSTEM', 'wplacer', '⚠️ Cannot request token: No clients connected. Please open a wplace.live tab.');
        return false;
    }
    sseBroadcast("request-token", { reason });
    return true;
}

const TokenManager = {
    tokenQueue: [],
    tokenPromise: null,
    resolvePromise: null,
    requestTimeout: null,
    isWaitingForClient: false,
    TOKEN_REQUEST_TIMEOUT: 30000,

    _requestNewToken() {
        log('SYSTEM', 'wplacer', 'TOKEN_MANAGER: Requesting new token from clients...');
        const success = requestTokenFromClients("server-request");

        if (success) {
            this.isWaitingForClient = false;
            clearTimeout(this.requestTimeout);
            this.requestTimeout = setTimeout(() => {
                log('SYSTEM', 'wplacer', '⚠️ Token request timed out. Retrying...');
                this._requestNewToken();
            }, this.TOKEN_REQUEST_TIMEOUT);
        } else {
            this.isWaitingForClient = true;
            clearTimeout(this.requestTimeout);
            log('SYSTEM', 'wplacer', '🛑 TOKEN_MANAGER: Stalled. Waiting for a browser client to connect...');
        }
    },

    getToken() {
        if (this.tokenQueue.length > 0) {
            return Promise.resolve(this.tokenQueue[0]);
        }
        if (!this.tokenPromise) {
            this.tokenPromise = new Promise((resolve) => {
                this.resolvePromise = resolve;
            });
            this._requestNewToken();
        }
        return this.tokenPromise;
    },

    setToken(t) {
        log('SYSTEM', 'wplacer', `✅ TOKEN_MANAGER: Token received and added to queue. Queue size: ${this.tokenQueue.length + 1}`);
        this.tokenQueue.push(t);
        if (this.resolvePromise) {
            this.resolvePromise(this.tokenQueue[0]);
        }
        if (this.tokenPromise) {
            this._reset();
        }
    },

    invalidateToken() {
        const invalidToken = this.tokenQueue.shift();
        log('SYSTEM', 'wplacer', `🔄 TOKEN_MANAGER: Invalidating token. ${this.tokenQueue.length} tokens remaining.`);
    },
    
    _reset() {
        clearTimeout(this.requestTimeout);
        this.requestTimeout = null;
        this.tokenPromise = null;
        this.resolvePromise = null;
        this.isWaitingForClient = false;
    },

    clientConnected() {
        if (this.isWaitingForClient && this.tokenPromise) {
            log('SYSTEM', 'wplacer', '✅ TOKEN_MANAGER: Client connected! Resuming token request.');
            this.isWaitingForClient = false;
            this._requestNewToken();
        }
    }
};


function logUserError(error, id, name, context) {
    const message = error.message || "An unknown error occurred.";
    if (message.includes("(500)") || message.includes("(1015)") || message.includes("(502)") || error.name === "SuspensionError") {
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
        this.masterId = this.userIds[0];
        this.masterName = users[this.masterId].name;
        this.masterIdentifier = this.userIds.map(id => `${users[id].name}#${id}`).join(', ');
        this.isFirstRun = true;
        this.sleepResolve = null;
        this.sleepInterval = null;
        this.sleepTimeout = null;
    }
    sleep(ms, withProgressBar = false) {
        return new Promise(resolve => {
            this.sleepResolve = resolve;
            
            this.sleepTimeout = setTimeout(() => {
                if (this.sleepInterval) {
                    clearInterval(this.sleepInterval);
                    this.sleepInterval = null;
                    if (withProgressBar && process.stdout && process.stdout.isTTY) process.stdout.write('\n');
                }
                if (this.sleepResolve) {
                    this.sleepResolve = null;
                    this.sleepTimeout = null;
                    resolve();
                }
            }, ms);

            if (withProgressBar && ms > 1000 && process.stdout && process.stdout.isTTY) {
                const totalDuration = ms;
                const barWidth = 40;
                let elapsed = 0;

                const updateProgressBar = () => {
                    elapsed += 1000;
                    if (elapsed > totalDuration) elapsed = totalDuration;
                    const percentage = (elapsed / totalDuration) * 100;
                    const filledWidth = Math.round((barWidth * percentage) / 100);
                    const emptyWidth = barWidth - filledWidth;
                    const bar = `[${'█'.repeat(filledWidth)}${' '.repeat(emptyWidth)}]`;
                    const time = `${duration(elapsed)} / ${duration(totalDuration)}`;
                    const eta = duration(totalDuration - elapsed);
                    if (typeof process.stdout.clearLine === 'function') process.stdout.clearLine(0);
                    if (typeof process.stdout.cursorTo === 'function') process.stdout.cursorTo(0);
                    process.stdout.write(`⏲️ ${bar} ${percentage.toFixed(0)}% ${time} (ETA: ${eta}) `);
                };
                updateProgressBar();
                this.sleepInterval = setInterval(updateProgressBar, 1000);
            }
        });
    }

    interruptSleep() {
        if (this.sleepResolve) {
            log('SYSTEM', 'wplacer', `[${this.name}] ⚙️ Settings changed, waking up.`);
            clearTimeout(this.sleepTimeout);
            if (this.sleepInterval) {
                clearInterval(this.sleepInterval);
                this.sleepInterval = null;
                if (process.stdout && process.stdout.isTTY) process.stdout.write('\n');
            }
            this.sleepResolve();
            this.sleepResolve = null;
            this.sleepTimeout = null;
        }
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
                    logUserError(error, wplacer.userInfo.id, wplacer.userInfo.name, "purchase max charge upgrades", this.name);
                }
            }
        }
    }

    async _performPaintTurn(wplacer) {
        let paintingComplete = false;
        while (!paintingComplete && this.running) {
            try {
                wplacer.token = await TokenManager.getToken();
                await wplacer.paint(currentSettings.drawingMethod);
                paintingComplete = true;
            } catch (error) {
                if (error.name === "SuspensionError") {
                    const suspendedUntilDate = new Date(error.suspendedUntil).toLocaleString();
                    log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🛑 Account suspended from painting until ${suspendedUntilDate}.`);
                    users[wplacer.userInfo.id].suspendedUntil = error.suspendedUntil;
                    saveUsers();
                    paintingComplete = true; // End this user's turn
                } else if (error.message === 'REFRESH_TOKEN') {
                    log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🔄 Token expired or invalid. Trying next token in queue...`);
                    TokenManager.invalidateToken();
                    await this.sleep(1000);
                } else {
                    throw error;
                }
            }
        }
    }

    async start() {
        this.running = true;
        this.status = "Started.";
        log('SYSTEM', 'wplacer', `▶️ Starting template "${this.name}"...`);
        activePaintingTasks++;

        try {
            while (this.running) {
                if (this.isFirstRun) {
                    log('SYSTEM', 'wplacer', `[${this.name}] 🚀 Performing initial painting cycle...`);
                    
                    const userChargeStates = await Promise.all(this.userIds.map(async (userId) => {
                        if (activeBrowserUsers.has(userId)) return { userId, charges: -1 };
                        activeBrowserUsers.add(userId);
                        const wplacer = new WPlacer(null, null, null, currentSettings, this.name);
                        try {
                            await wplacer.login(users[userId].cookies);
                            return { userId, charges: wplacer.userInfo.charges.count };
                        } catch (error) {
                            logUserError(error, userId, users[userId].name, "fetch charge state for initial sort", this.name);
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
                        if (users[userId].suspendedUntil && Date.now() < users[userId].suspendedUntil) continue;
                        if (activeBrowserUsers.has(userId)) continue;
                        
                        activeBrowserUsers.add(userId);
                        const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, currentSettings, this.name);
                        try {
                            const { id, name } = await wplacer.login(users[userId].cookies);
                            this.status = `Initial run for ${name}#${id}`;
                            log(id, name, `[${this.name}] 🏁 Starting initial turn...`);
                            
                            await this._performPaintTurn(wplacer);
                            await this.handleUpgrades(wplacer);
                            
                            if (await wplacer.pixelsLeft() === 0) {
                                this.running = false;
                                break;
                            }
                        } catch (error) {
                            logUserError(error, userId, users[userId].name, "perform initial user turn", this.name);
                        } finally {
                            await wplacer.close();
                            activeBrowserUsers.delete(userId);
                        }
                         if (this.running && this.userIds.length > 1) {
                            log('SYSTEM', 'wplacer', `[${this.name}] ⏱️ Initial cycle: Waiting ${currentSettings.accountCooldown / 1000} seconds before next user.`);
                            await this.sleep(currentSettings.accountCooldown);
                        }
                    }
                    this.isFirstRun = false;
                    log('SYSTEM', 'wplacer', `[${this.name}] ✅ Initial placement cycle complete.`);
                    if (!this.running) continue;
                }

                if (activeBrowserUsers.has(this.masterId)) {
                    await this.sleep(5000);
                    continue;
                }
                activeBrowserUsers.add(this.masterId);
                const checkWplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, currentSettings, this.name);
                let pixelsRemaining;
                try {
                    await checkWplacer.login(users[this.masterId].cookies);
                    pixelsRemaining = await checkWplacer.pixelsLeft();
                } catch (error) {
                    logUserError(error, this.masterId, this.masterName, "check pixels left", this.name);
                    await this.sleep(60000);
                    continue;
                } finally {
                    await checkWplacer.close();
                    activeBrowserUsers.delete(this.masterId);
                }

                if (pixelsRemaining === 0) {
                    if (this.antiGriefMode) {
                        this.status = "Monitoring for changes.";
                        log('SYSTEM', 'wplacer', `[${this.name}] 🖼 Template is complete. Monitoring... Checking again in ${currentSettings.antiGriefStandby / 60000} minutes.`);
                        await this.sleep(currentSettings.antiGriefStandby);
                        continue;
                    } else {
                        log('SYSTEM', 'wplacer', `[${this.name}] 🖼 Template finished!`);
                        this.status = "Finished.";
                        this.running = false;
                        break;
                    }
                }

                let userStates = [];
                for (const userId of this.userIds) {
                     if (users[userId].suspendedUntil && Date.now() < users[userId].suspendedUntil) continue;
                     if (activeBrowserUsers.has(userId)) continue;
                     
                     activeBrowserUsers.add(userId);
                     const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, currentSettings, this.name);
                     try {
                         await wplacer.login(users[userId].cookies);
                         userStates.push({ userId, charges: wplacer.userInfo.charges, cooldownMs: wplacer.userInfo.charges.cooldownMs });
                     } catch (error) {
                         logUserError(error, userId, users[userId].name, "check user status", this.name);
                     } finally {
                         await wplacer.close();
                         activeBrowserUsers.delete(userId);
                     }
                }
                
                const readyUsers = userStates.filter(u => {
                    const target = Math.max(1, u.charges.max * currentSettings.chargeThreshold);
                    return u.charges.count >= target;
                });

                let userToRun = null;
                if (readyUsers.length > 0) {
                    readyUsers.sort((a, b) => b.charges.count - a.charges.count);
                    userToRun = readyUsers[0];
                }

                if (userToRun) {
                    if (activeBrowserUsers.has(userToRun.userId)) continue;
                    activeBrowserUsers.add(userToRun.userId);
                    const wplacer = new WPlacer(this.template, this.coords, this.canBuyCharges, currentSettings, this.name);
                    try {
                        const { id, name } = await wplacer.login(users[userToRun.userId].cookies);
                        this.status = `Running user ${name}#${id}`;
                        
                        if (wplacer.userInfo.charges.count === wplacer.userInfo.charges.max) {
                            log(id, name, `[${this.name}] 🔋 User is at max charges. Checking for upgrades before painting...`);
                            await this.handleUpgrades(wplacer);
                            await wplacer.loadUserInfo();
                        }
                        
                        log(id, name, `[${this.name}] 🔋 User has ${Math.floor(wplacer.userInfo.charges.count)} charges. Starting turn...`);
                        await this._performPaintTurn(wplacer);
                        await this.handleUpgrades(wplacer);

                    } catch (error) {
                        logUserError(error, userToRun.userId, users[userToRun.userId].name, "perform paint turn", this.name);
                    } finally {
                        await wplacer.close();
                        activeBrowserUsers.delete(userToRun.userId);
                    }
                    if (this.running && this.userIds.length > 1) {
                        log('SYSTEM', 'wplacer', `[${this.name}] ⏱️ Turn finished. Waiting ${currentSettings.accountCooldown / 1000} seconds before checking next account.`);
                        await this.sleep(currentSettings.accountCooldown);
                    }
                } else if (this.running) {
                    if (this.canBuyCharges) {
                        if (!activeBrowserUsers.has(this.masterId)) {
                            activeBrowserUsers.add(this.masterId);
                            const chargeBuyer = new WPlacer(this.template, this.coords, this.canBuyCharges, currentSettings, this.name);
                            try {
                                await chargeBuyer.login(users[this.masterId].cookies);
                                const affordableDroplets = chargeBuyer.userInfo.droplets - currentSettings.dropletReserve;
                                if(affordableDroplets >= 500) {
                                    const maxAffordable = Math.floor(affordableDroplets / 500);
                                    const amountToBuy = Math.min(Math.ceil(pixelsRemaining / 30), maxAffordable);
                                    if (amountToBuy > 0) {
                                        log(this.masterId, this.masterName, `[${this.name}] 💰 Attempting to buy pixel charges...`);
                                        await chargeBuyer.buyProduct(80, amountToBuy);
                                        await this.sleep(currentSettings.purchaseCooldown);
                                        continue;
                                    }
                                }
                            } catch (error) {
                                 logUserError(error, this.masterId, this.masterName, "attempt to buy pixel charges", this.name);
                            } finally {
                                await chargeBuyer.close();
                                activeBrowserUsers.delete(this.masterId);
                            }
                        }
                    }
                    
                    const times = userStates.map(u => {
                        const target = Math.max(1, u.charges.max * currentSettings.chargeThreshold);
                        return Math.max(0, (target - u.charges.count) * u.cooldownMs);
                    });
                    const minTimeToReady = times.length ? Math.min(...times) : -1;
                    const waitTime = (minTimeToReady > 0 ? minTimeToReady : 60000) + 2000;
                    this.status = `Waiting for charges.`;
                    log('SYSTEM', 'wplacer', `[${this.name}] ⏳ No users have reached charge threshold. Waiting for next recharge...`);
                    await this.sleep(waitTime, true);
                }
            }
        } finally {
            activePaintingTasks--;
            if (this.status !== "Finished.") {
                this.status = "Stopped.";
                log('SYSTEM', 'wplacer', `[${this.name}] ✖️ Template stopped.`);
            }
        }
    }
}



// Function to show existing template image when editing
const showExistingTemplateImage = (template) => {
    if (template && template.width > 0) {
        currentTemplate = template;
        drawTemplate(template, templateCanvas);
        size.innerHTML = `${template.width}x${template.height}px`;
        ink.innerHTML = template.ink || calculateTemplateInk(template);
        details.style.display = "block";
        
        // Add a note that this is the existing image
        const existingImageNote = document.createElement('div');
        existingImageNote.id = 'existingImageNote';
        existingImageNote.className = 'existing-image-note';
        existingImageNote.innerHTML = '📋 <strong>Current Template Image</strong> - Upload a new image to replace it';
        
        // Remove any existing note
        const oldNote = document.getElementById('existingImageNote');
        if (oldNote) oldNote.remove();
        
        // Insert after the details div
        details.parentNode.insertBefore(existingImageNote, details.nextSibling);
    }
};

// Function to calculate template ink if not provided
const calculateTemplateInk = (template) => {
    let ink = 0;
    for (let x = 0; x < template.width; x++) {
        for (let y = 0; y < template.height; y++) {
            if (template.data[x][y] !== 0) ink++;
        }
    }
    return ink;
};

// Function to create progress bar element
const createProgressBar = (percentage, status) => {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = `${Math.min(Math.max(percentage || 0, 0), 100)}%`;
    
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.textContent = `${percentage || 0}%`;
    
    progressBar.appendChild(progressFill);
    progressBar.appendChild(progressText);
    progressContainer.appendChild(progressBar);
    
    const progressStatus = document.createElement('div');
    progressStatus.className = 'progress-status';
    progressStatus.textContent = status || 'Loading...';
    
    progressContainer.appendChild(progressStatus);
    return progressContainer;
};

app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write("retry: 1000\n\n");

    sseClients.add(res);
    console.log(`✅ Client connected to SSE. Total clients: ${sseClients.size}`);
    TokenManager.clientConnected();

    if (TokenManager.tokenPromise && TokenManager.tokenQueue.length === 0) {
        sseBroadcast("request-token", { reason: "new-client-join" });
    }

    req.on("close", () => {
        sseClients.delete(res);
        console.log(`❌ Client disconnected from SSE. Total clients: ${sseClients.size}`);
    });
});

// frontend endpoints
app.get("/users", (_, res) => res.json(users));
app.get("/templates", (_, res) => {
    const sanitizedTemplates = {};
    for (const id in templates) {
        const t = templates[id];
        sanitizedTemplates[id] = {
            name: t.name,
            template: t.template,
            coords: t.coords,
            canBuyCharges: t.canBuyCharges,
            canBuyMaxCharges: t.canBuyMaxCharges,
            antiGriefMode: t.antiGriefMode,
            userIds: t.userIds,
            running: t.running,
            status: t.status
        };
    }
    res.json(sanitizedTemplates);
});
app.get('/settings', (_, res) => res.json(currentSettings));
app.put('/settings', (req, res) => {
    const oldSettings = { ...currentSettings };
    currentSettings = { ...currentSettings, ...req.body };
    saveSettings();

    if (oldSettings.chargeThreshold !== currentSettings.chargeThreshold) {
        for (const id in templates) {
            if (templates[id].running) {
                templates[id].interruptSleep();
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
        users[userInfo.id] = { 
            name: userInfo.name, 
            cookies: req.body.cookies,
            expirationDate: req.body.expirationDate 
        };
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
    TokenManager.setToken(t);
    res.sendStatus(200);
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- New Keep-Alive System ---
const keepAlive = async () => {
    if (activePaintingTasks > 0) {
        log('SYSTEM', 'wplacer', '⚙️ Deferring keep-alive check: painting is active.');
        return;
    }

    log('SYSTEM', 'wplacer', '⚙️ Performing periodic cookie keep-alive check for all users...');
    const userIds = Object.keys(users);
    for (const [index, userId] of userIds.entries()) {
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
            await wplacer.close();
            activeBrowserUsers.delete(userId);
        }

        if (index < userIds.length - 1) {
            await sleep(currentSettings.keepAliveCooldown);
        }
    }
    log('SYSTEM', 'wplacer', '✅ Keep-alive check complete.');
};

// starting
const diffVer = (v1, v2) => v1.split(".").map(Number).reduce((r, n, i) => r || (n - v2.split(".")[i]) * (i ? 10 ** (2 - i) : 100), 0);
(async () => {
    console.clear();
    const version = JSON.parse(readFileSync("package.json", "utf8")).version;
    console.log(`🌐 wplacer by luluwaffless and jinx (${version})`);

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

    try {
        const githubPackage = await fetch("https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/package.json");
        const githubVersion = (await githubPackage.json()).version;
        const diff = diffVer(version, githubVersion);
        if (diff !== 0) console.warn(`${diff < 0 ? "⚠️ Outdated version! Please update using \"git pull\"." : "🤖 Unreleased."}\n  GitHub: ${githubVersion}\n  Local: ${version} (${diff})`);
    } catch (e) {
        console.warn("⚠️ Could not check for updates.");
    }
    
    const port = Number(process.env.PORT) || 80;
    const host = process.env.HOST || "0.0.0.0"; // Bind to 0.0.0.0 for broader accessibility
    app.listen(port, host, () => {
        console.log(`✅ Server listening on http://${host}:${port}`);
        console.log(`   Open the web UI in your browser to start!`);
        TokenManager.getToken().catch(() => {}); // Initial token request
        setInterval(keepAlive, 20 * 60 * 1000);
    });
})();

// Add this endpoint after your other template endpoints
app.get("/template/progress/:id", async (req, res) => {
    const { id } = req.params;
    if (!templates[id]) {
        return res.status(404).json({ 
            error: "Template not found",
            totalPixels: 0, 
            completedPixels: 0, 
            percentage: 0,
            running: false 
        });
    }
    
    const template = templates[id];
    
    if (!template.running) {
        return res.json({ 
            totalPixels: 0, 
            completedPixels: 0, 
            percentage: 0,
            running: false,
            status: template.status || "Stopped"
        });
    }

    try {
        if (activeBrowserUsers.has(template.masterId)) {
            return res.json({ 
                totalPixels: 0, 
                completedPixels: 0, 
                percentage: 0,
                running: true,
                status: "Checking progress..." 
            });
        }

        activeBrowserUsers.add(template.masterId);
        const wplacer = new WPlacer(template.template, template.coords, template.canBuyCharges, currentSettings, template.name);
        
        try {
            await wplacer.login(users[template.masterId].cookies);
            
            let totalPixels = 0;
            for (let x = 0; x < template.template.width; x++) {
                for (let y = 0; y < template.template.height; y++) {
                    if (template.template.data[x][y] !== 0) {
                        totalPixels++;
                    }
                }
            }
            
            const pixelsLeft = await wplacer.pixelsLeft();
            const completedPixels = Math.max(0, totalPixels - pixelsLeft);
            const percentage = totalPixels > 0 ? Math.min(100, Math.round((completedPixels / totalPixels) * 100)) : 0;
            
            let enhancedStatus = template.status || "Running";
            if (pixelsLeft === 0) {
                enhancedStatus = template.antiGriefMode ? "Complete - Monitoring for changes" : "Complete";
            } else if (completedPixels > 0) {
                enhancedStatus = "Drawing in progress";
            }
            
            res.json({
                totalPixels,
                completedPixels,
                pixelsLeft,
                percentage,
                running: true,
                status: enhancedStatus
            });
            
        } catch (error) {
            res.json({ 
                totalPixels: 0, 
                completedPixels: 0, 
                percentage: 0,
                running: true,
                status: "Error checking progress",
                error: error.message
            });
        } finally {
            if (wplacer.browser) await wplacer.close();
            activeBrowserUsers.delete(template.masterId);
        }
        
    } catch (error) {
        activeBrowserUsers.delete(template.masterId);
        res.status(500).json({ 
            error: error.message,
            totalPixels: 0, 
            completedPixels: 0, 
            percentage: 0,
            running: template.running
        });
    }
});