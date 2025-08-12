import { WPlacer, log } from "./wplacer.js";
import express from "express";
const instances = {};
express()
    .use(express.static("public"))
    .use(express.json())
    .get('/instances', (_, res) => res.json(instances))
    .post("/init", async (req, res) => {
        if (!req.body.template || !req.body.coords || !req.body.cookies || !req.body.cookies.s || !req.body.cookies.j) return res.sendStatus(400);
        try {
            const wplacer = new WPlacer(req.body.template, req.body.coords, req.body.canBuyCharges);
            const userInfo = await wplacer.login(req.body.cookies);
            if (!instances[userInfo.id]) {
                instances[userInfo.id] = wplacer;
                wplacer.start().then(() => delete instances[userInfo.id]).catch(error => log(userInfo.id, "❌ Error while drawing", error));
                res.json({ name: userInfo.name, id: userInfo.id });
            } else res.sendStatus(403);
        } catch (error) {
            res.sendStatus(500);
            console.log("❌ Error starting WPlacer:", error);
        };
    })
    .post("/t", async (req, res) => {
        const { t } = req.body;
        if (!t) return res.sendStatus(400);
        Object.keys(instances).forEach(i => instances[i].setToken(t));
        res.sendStatus(200);
    })
    .listen(80, () => {
        console.log("✅ Open http://localhost to start")
    });