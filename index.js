import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { WPlacer, log } from "./wplacer-1.2.3.js";
import express from "express";
import open from "open";
const templates = {};
const users = existsSync("users.json") ? JSON.parse(readFileSync("users.json", "utf8")) : {};
const saveUsers = () => writeFileSync("users.json", JSON.stringify(users));
const app = express();
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

// frontend endpoints
app.get("/users", (_, res) => res.json(users));
app.get("/templates", (_, res) => res.json(templates));
app.post("/user", async (req, res) => {
    if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
    try {
        const wplacer = new WPlacer(req.body.template, req.body.coords, req.body.canBuyCharges);
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
    if (diff !== 0) console.warn(`${diff < 0 ? "⚠️ Outdated version! Please update!" : "🤖 Unreleased."}\n  GitHub: ${githubVersion}\n  Local: ${version} (${diff})`);
    app.listen(80, "127.0.0.1", () => {
        console.log("✅ http://localhost/");
        open("http://localhost/");
    });
})();