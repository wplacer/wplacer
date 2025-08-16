import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { WPlacer, log } from "./wplacer.js";
import express from "express";
const templates = {};
let lastValidToken = null;
let lastTokenAt = 0;
const users = existsSync("users.json") ? JSON.parse(readFileSync("users.json", "utf8")) : {};
const saveUsers = () => writeFileSync("users.json", JSON.stringify(users));
const app = express();
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));
const sseClients = new Set();
let needToken = true;

function sseBroadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) res.write(payload);
}

function requestTokenFromClients(reason = "server-start") {
    if (sseClients.size === 0) {
        needToken = true;
        return;
    }
    sseBroadcast("request-token", { reason });
}

app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.write("retry: 1000\n\n");

    sseClients.add(res);

    if (needToken || !lastValidToken) {
        res.write(`event: request-token\ndata: ${JSON.stringify({ reason: "client-connect" })}\n\n`);
        needToken = false;
    }

    req.on("close", () => {
        sseClients.delete(res);
    });
});

app.get("/latest-token", (_, res) => {
    res.json({ t: lastValidToken, at: lastTokenAt || null });
});

// frontend endpoints
app.get("/users", (_, res) => res.json(users));
app.get("/templates", (_, res) => res.json(templates));
app.post("/user", async (req, res) => {
    if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
    try {
        const wplacer = new WPlacer(req.body.template, req.body.coords, req.body.canBuyCharges);
        if (lastValidToken) wplacer.setToken(lastValidToken);
        const userInfo = await wplacer.login(req.body.cookies);
        users[userInfo.id] = { name: userInfo.name, cookies: req.body.cookies };
        saveUsers();
        res.json(userInfo);
    } catch (error) {
        res.sendStatus(500);
        console.log("❌ Error adding new user:", error);
    };
});
app.post("/template", async (req, res) => {
    if (!req.body.template || !req.body.coords || !req.body.userId || !users[req.body.userId]) return res.sendStatus(400);
    try {
        const wplacer = new WPlacer(req.body.template, req.body.coords, req.body.canBuyCharges);
        if (lastValidToken) wplacer.setToken(lastValidToken);
        const userInfo = await wplacer.login(users[req.body.userId].cookies);
        if (!templates[userInfo.id]) {
            templates[userInfo.id] = wplacer;
            res.sendStatus(200);
        } else res.sendStatus(403);
    } catch (error) {
        res.sendStatus(500);
        log(req.body.userId, "❌ Error creating template:", error);
    };
});
app.delete("/user/:id", async (req, res) => {
    if (!req.params.id || !users[req.params.id]) return res.sendStatus(400);
    delete users[req.params.id];
    res.sendStatus(200);
});
app.delete("/template/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id] || templates[req.params.id].running) return res.sendStatus(400);
    delete templates[req.params.id];
    res.sendStatus(200);
});
app.put("/template/:id", async (req, res) => {
    if (!req.params.id || !templates[req.params.id]) return res.sendStatus(400);
    for (const i of Object.keys(req.body)) {
        if (i === "running" && req.body.running) {
            try {
                templates[req.params.id].start()
            } catch (error) {
                log(req.params.id, "❌ Error starting template:", error);
            };
        } else templates[req.params.id][i] = req.body[i];
    };
    res.sendStatus(200);
});

// client endpoints
app.get("/ping", (_, res) => res.send("Pong!"));
app.post("/t", async (req, res) => {
    const { t } = req.body;
    if (!t) return res.sendStatus(400);
    lastValidToken = t;
    lastTokenAt = Date.now();
    Object.keys(templates).forEach(i => templates[i].setToken(t));
    res.sendStatus(200);
});

// starting
const diffVer = (v1, v2) => v1.split(".").map(Number).reduce((r, n, i) => r || (n - v2.split(".")[i]) * (i ? 10 ** (2 - i) : 100), 0);
(async () => {
    const version = JSON.parse(readFileSync("package.json", "utf8")).version;
    console.log(`🌐 Wplace by luluwaffless (${version})`);
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
