import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { CookieJar } from "tough-cookie";
import { Impit } from "impit";
import { Image, createCanvas } from "canvas";
import { exec } from "node:child_process";

// --- Setup Data Directory ---
const dataDir = "./data";
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

// --- Logging and Utility Functions ---
const log = async (id, name, data, error) => {
    const timestamp = new Date().toLocaleString();
    const identifier = `(${name}#${id})`;
    if (error) {
        console.error(`[${timestamp}] ${identifier} ${data}:`, error);
        appendFileSync(path.join(dataDir, `errors.log`), `[${timestamp}] ${identifier} ${data}: ${error.stack || error.message}\n`);
    } else {
        console.log(`[${timestamp}] ${identifier} ${data}`);
        appendFileSync(path.join(dataDir, `logs.log`), `[${timestamp}] ${identifier} ${data}\n`);
    };
};

function openBrowser(url) {
  const start =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "start" :
    "xdg-open";
  exec(`${start} ${url}`);
}

const duration = (durationMs) => {
    if (durationMs <= 0) return "0s";
    const totalSeconds = Math.floor(durationMs / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- WPlacer Core Classes and Constants ---
class SuspensionError extends Error {
    constructor(message, durationMs) {
        super(message);
        this.name = "SuspensionError";
        this.durationMs = durationMs;
        this.suspendedUntil = Date.now() + durationMs;
    }
}

class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = "NetworkError";
    }
}

const basic_colors = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31 };
const premium_colors = { "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
const pallete = { ...basic_colors, ...premium_colors };
const colorBitmapShift = 32;

const ChargeCache = {
  _m: new Map(),
  REGEN_MS: 30_000,
  SYNC_MS: 8 * 60_000,
  _key(id) { return String(id); },

  has(id) { return this._m.has(this._key(id)); },
  stale(id, now = Date.now()) {
    const u = this._m.get(this._key(id)); if (!u) return true;
    return (now - u.lastSync) > this.SYNC_MS;
  },
  markFromUserInfo(userInfo, now = Date.now()) {
    if (!userInfo?.id || !userInfo?.charges) return;
    const k = this._key(userInfo.id);
    const base = Math.floor(userInfo.charges.count ?? 0);
    const max  = Math.floor(userInfo.charges.max ?? 0);
    this._m.set(k, { base, max, lastSync: now });
  },
  predict(id, now = Date.now()) {
    const u = this._m.get(this._key(id)); if (!u) return null;
    const grown = Math.floor((now - u.lastSync) / this.REGEN_MS);
    const count = Math.min(u.max, u.base + Math.max(0, grown));
    return { count, max: u.max, cooldownMs: this.REGEN_MS };
  },
  consume(id, n = 1, now = Date.now()) {
    const k = this._key(id);
    const u = this._m.get(k); if (!u) return;
    const grown = Math.floor((now - u.lastSync) / this.REGEN_MS);
    const avail = Math.min(u.max, u.base + Math.max(0, grown));
    const newCount = Math.max(0, avail - n);
    u.base = newCount;
    u.lastSync = now - ((now - u.lastSync) % this.REGEN_MS);
    this._m.set(k, u);
  }
};

let loadedProxies = [];
const loadProxies = () => {
  const proxyPath = path.join(dataDir, "proxies.txt");
  if (!existsSync(proxyPath)) {
    writeFileSync(proxyPath, "");
    console.log("[SYSTEM] `data/proxies.txt` not found, created an empty one.");
    loadedProxies = [];
    return;
  }

  const raw = readFileSync(proxyPath, "utf8");
  const lines = raw.split(/\r?\n/).map(l => l.replace(/\s+#.*$|\s+\/\/.*$|^\s*#.*$|^\s*\/\/.*$/g, "").trim()).filter(Boolean);
  const protoMap = new Map([["http", "http"], ["https", "https"], ["socks4", "socks4"], ["socks5", "socks5"]]);
  const inRange = p => Number.isInteger(p) && p >= 1 && p <= 65535;
  const looksHostname = h => !!h && /^[a-z0-9-._[\]]+$/i.test(h);

  const parseOne = (line) => {
    const urlLike = line.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/);
    if (urlLike) {
      const scheme = urlLike[1].toLowerCase();
      const protocol = protoMap.get(scheme);
      if (!protocol) return null;
      try {
        const u = new URL(line);
        const host = u.hostname;
        const port = u.port ? parseInt(u.port, 10) : NaN;
        const username = decodeURIComponent(u.username || "");
        const password = decodeURIComponent(u.password || "");
        if (!looksHostname(host) || !inRange(port)) return null;
        return { protocol, host, port, username, password };
      } catch { return null; }
    }
    const authHost = line.match(/^([^:@\s]+):([^@\s]+)@(.+)$/);
    if (authHost) {
      const username = authHost[1], password = authHost[2], rest = authHost[3];
      const m6 = rest.match(/^\[([^\]]+)\]:(\d+)$/), m4 = rest.match(/^([^:\s]+):(\d+)$/);
      let host = "", port = NaN;
      if (m6) { host = m6[1]; port = parseInt(m6[2], 10); }
      else if (m4) { host = m4[1]; port = parseInt(m4[2], 10); }
      else return null;
      if (!looksHostname(host) || !inRange(port)) return null;
      return { protocol: "http", host, port, username, password };
    }
    const bare6 = line.match(/^\[([^\]]+)\]:(\d+)$/);
    if (bare6) {
      const host = bare6[1], port = parseInt(bare6[2], 10);
      if (!inRange(port)) return null;
      return { protocol: "http", host, port, username: "", password: "" };
    }
    const bare = line.match(/^([^:\s]+):(\d+)$/);
    if (bare) {
      const host = bare[1], port = parseInt(bare[2], 10);
      if (!looksHostname(host) || !inRange(port)) return null;
      return { protocol: "http", host, port, username: "", password: "" };
    }
    const uphp = line.split(":");
    if (uphp.length === 4 && /^\d+$/.test(uphp[3])) {
      const [username, password, host, portStr] = uphp;
      const port = parseInt(portStr, 10);
      if (looksHostname(host) && inRange(port)) return { protocol: "http", host, port, username, password };
    }
    return null;
  };

  const seen = new Set();
  const proxies = [];
  for (const line of lines) {
    const p = parseOne(line);
    if (!p) { console.log(`[SYSTEM] WARNING: Invalid proxy skipped: "${line}"`); continue; }
    const key = `${p.protocol}://${p.username}:${p.password}@${p.host}:${p.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    proxies.push(p);
  }
  loadedProxies = proxies;
};

let nextProxyIndex = 0;
const getNextProxy = () => {
    const { proxyEnabled, proxyRotationMode } = currentSettings;
    if (!proxyEnabled || loadedProxies.length === 0) return null;
    let proxy;
    if (proxyRotationMode === 'random') {
        const randomIndex = Math.floor(Math.random() * loadedProxies.length);
        proxy = loadedProxies[randomIndex];
    } else {
        proxy = loadedProxies[nextProxyIndex];
        nextProxyIndex = (nextProxyIndex + 1) % loadedProxies.length;
    }
    let proxyUrl = `${proxy.protocol}://`;
    if (proxy.username && proxy.password) {
        proxyUrl += `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`;
    }
    proxyUrl += `${proxy.host}:${proxy.port}`;
    return proxyUrl;
};

class WPlacer {
    constructor(template, coords, globalSettings, templateSettings, templateName) {
        this.template = template;
        this.templateName = templateName;
        this.coords = coords;
        this.globalSettings = globalSettings;
        this.templateSettings = templateSettings || {};
        this.cookies = null;
        this.browser = null;
        this.userInfo = null;
        this.tiles = new Map();
        this.token = null;
    };

    async login(cookies) {
        this.cookies = cookies;
        let jar = new CookieJar();
        for (const cookie of Object.keys(this.cookies)) {
            jar.setCookieSync(`${cookie}=${this.cookies[cookie]}; Path=/`, "https://backend.wplace.live");
        }
        const impitOptions = { cookieJar: jar, browser: "chrome", ignoreTlsErrors: true };
        const proxyUrl = getNextProxy();
        if (proxyUrl) {
            impitOptions.proxyUrl = proxyUrl;
            if (currentSettings.logProxyUsage) log('SYSTEM', 'wplacer', `Using proxy: ${proxyUrl.split('@').pop()}`);
        }
        this.browser = new Impit(impitOptions);
        await this.loadUserInfo();
        return this.userInfo;
    };

    async switchUser(cookies) {
        this.cookies = cookies;
        let jar = new CookieJar();
        for (const cookie of Object.keys(this.cookies)) {
            jar.setCookieSync(`${cookie}=${this.cookies[cookie]}; Path=/`, "https://backend.wplace.live");
        }
        this.browser.cookieJar = jar;
        await this.loadUserInfo();
        return this.userInfo;
    }

    async loadUserInfo() {
        const me = await this.browser.fetch("https://backend.wplace.live/me");
        const bodyText = await me.text();
        if (bodyText.trim().startsWith("<!DOCTYPE html>")) throw new NetworkError("Cloudflare interruption detected.");
        try {
            const userInfo = JSON.parse(bodyText);
            if (userInfo.error === "Unauthorized") throw new NetworkError(`(401) Unauthorized.`);
            if (userInfo.error) throw new Error(`(500) Auth failed: "${userInfo.error}".`);
            if (userInfo.id && userInfo.name) {
                this.userInfo = userInfo;
                ChargeCache.markFromUserInfo(userInfo);
                return true;
            }
            throw new Error(`Unexpected /me response: ${JSON.stringify(userInfo)}`);
        } catch (e) {
            if (e instanceof NetworkError) throw e;
            if (bodyText.includes('Error 1015')) throw new NetworkError("(1015) Rate-limited.");
            if (bodyText.includes('502') && bodyText.includes('gateway')) throw new NetworkError(`(502) Bad Gateway.`);
            throw new Error(`Failed to parse server response: "${bodyText.substring(0, 150)}..."`);
        }
    }

    async post(url, body) {
        const request = await this.browser.fetch(url, {
            method: "POST",
            headers: { "Accept": "*/*", "Content-Type": "text/plain;charset=UTF-8", "Referer": "https://wplace.live/" },
            body: JSON.stringify(body)
        });
        const data = await request.json();
        return { status: request.status, data: data };
    };

    async loadTiles() {
        this.tiles.clear();
        const [tx, ty, px, py] = this.coords;
        const endPx = px + this.template.width;
        const endPy = py + this.template.height;
        const endTx = tx + Math.floor(endPx / 1000);
        const endTy = ty + Math.floor(endPy / 1000);
        const tilePromises = [];
        for (let currentTx = tx; currentTx <= endTx; currentTx++) {
            for (let currentTy = ty; currentTy <= endTy; currentTy++) {
                const promise = new Promise((resolve) => {
                    const image = new Image();
                    image.crossOrigin = "Anonymous";
                    image.onload = () => {
                        const canvas = createCanvas(image.width, image.height);
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(image, 0, 0);
                        const tileData = { width: canvas.width, height: canvas.height, data: Array.from({ length: canvas.width }, () => []) };
                        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        for (let x = 0; x < canvas.width; x++) {
                            for (let y = 0; y < canvas.height; y++) {
                                const i = (y * canvas.width + x) * 4;
                                const [r, g, b, a] = [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
                                tileData.data[x][y] = a === 255 ? (pallete[`${r},${g},${b}`] || 0) : 0;
                            }
                        }
                        resolve(tileData);
                    };
                    image.onerror = () => resolve(null);
                    image.src = `https://backend.wplace.live/files/s0/tiles/${currentTx}/${currentTy}.png?t=${Date.now()}`;
                }).then(tileData => {
                    if (tileData) this.tiles.set(`${currentTx}_${currentTy}`, tileData);
                });
                tilePromises.push(promise);
            }
        }
        await Promise.all(tilePromises);
        return true;
    }

    hasColor(id) {
        if (id < colorBitmapShift) return true;
        return !!(this.userInfo.extraColorsBitmap & (1 << (id - colorBitmapShift)));
    }

    async _executePaint(tx, ty, body) {
        if (body.colors.length === 0) return { painted: 0 };
        const response = await this.post(`https://backend.wplace.live/s0/pixel/${tx}/${ty}`, body);
        if (response.data.painted && response.data.painted === body.colors.length) {
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painted ${body.colors.length} pixels on tile ${tx}, ${ty}.`);
            return { painted: body.colors.length };
        }
        if (response.status === 401 && response.data.error === "Unauthorized") throw new NetworkError(`(401) Unauthorized during paint.`);
        if (response.status === 403 && (response.data.error === "refresh" || response.data.error === "Unauthorized")) throw new Error('REFRESH_TOKEN');
        if (response.status === 451 && response.data.suspension) throw new SuspensionError(`Account is suspended.`, response.data.durationMs || 0);
        if (response.status === 500) {
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ⏱️ Server error (500). Waiting 40s...`);
            await sleep(40000);
            return { painted: 0 };
        }
        if (response.status === 429 || (response.data.error && response.data.error.includes("Error 1015"))) throw new NetworkError("(1015) Rate-limited.");
        throw Error(`Unexpected response for tile ${tx},${ty}: ${JSON.stringify(response)}`);
    }

    _getMismatchedPixels(currentSkip = 1) {
        const [startX, startY, startPx, startPy] = this.coords;
        const mismatched = [];
        for (let y = 0; y < this.template.height; y++) {
            for (let x = 0; x < this.template.width; x++) {
                if ((x + y) % currentSkip !== 0) continue;
                const templateColor = this.template.data[x][y];
                const globalPx = startPx + x, globalPy = startPy + y;
                const targetTx = startX + Math.floor(globalPx / 1000), targetTy = startY + Math.floor(globalPy / 1000);
                const localPx = globalPx % 1000, localPy = globalPy % 1000;
                const tile = this.tiles.get(`${targetTx}_${targetTy}`);
                if (!tile || !tile.data[localPx]) continue;
                const tileColor = tile.data[localPx][localPy];
                const neighbors = [this.template.data[x - 1]?.[y], this.template.data[x + 1]?.[y], this.template.data[x]?.[y - 1], this.template.data[x]?.[y + 1]];
                const isEdge = neighbors.some(n => n === 0 || n === undefined);
                if (this.templateSettings.eraseMode && templateColor === 0 && tileColor !== 0) {
                    mismatched.push({ tx: targetTx, ty: targetTy, px: localPx, py: localPy, color: 0, isEdge: false, localX: x, localY: y });
                    continue;
                }
                if (templateColor === -1 && tileColor !== 0) {
                    mismatched.push({ tx: targetTx, ty: targetTy, px: localPx, py: localPy, color: 0, isEdge, localX: x, localY: y });
                    continue;
                }
                if (templateColor > 0) {
                    const shouldPaint = this.templateSettings.skipPaintedPixels ? tileColor === 0 : templateColor !== tileColor;
                    if (shouldPaint && this.hasColor(templateColor)) {
                        mismatched.push({ tx: targetTx, ty: targetTy, px: localPx, py: localPy, color: templateColor, isEdge, localX: x, localY: y });
                    }
                }
            }
        }
        return mismatched;
    }

    async paint(currentSkip = 1) {
        await this.loadTiles();
        if (!this.token) throw new Error("Token not provided.");
        let mismatchedPixels = this._getMismatchedPixels(currentSkip);
        if (mismatchedPixels.length === 0) return 0;
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] Found ${mismatchedPixels.length} mismatched pixels.`);
        let pixelsToProcess = mismatchedPixels;
        if (this.templateSettings.outlineMode) {
            const edgePixels = mismatchedPixels.filter(p => p.isEdge);
            if (edgePixels.length > 0) pixelsToProcess = edgePixels;
        }
        switch (this.globalSettings.drawingDirection) {
            case 'btt': pixelsToProcess.sort((a, b) => b.localY - a.localY); break;
            case 'ltr': pixelsToProcess.sort((a, b) => a.localX - b.localX); break;
            case 'rtl': pixelsToProcess.sort((a, b) => b.localX - a.localX); break;
            case 'center_out': {
                const cx = this.template.width / 2, cy = this.template.height / 2;
                const d2 = p => (p.localX - cx) ** 2 + (p.localY - cy) ** 2;
                pixelsToProcess.sort((a, b) => d2(a) - d2(b));
                break;
            }
            case 'ttb': default: pixelsToProcess.sort((a, b) => a.localY - b.localY); break;
        }
        switch (this.globalSettings.drawingOrder) {
            case 'random':
                for (let i = pixelsToProcess.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [pixelsToProcess[i], pixelsToProcess[j]] = [pixelsToProcess[j], pixelsToProcess[i]];
                }
                break;
            case 'color': case 'randomColor': {
                const buckets = pixelsToProcess.reduce((acc, p) => ((acc[p.color] ??= []).push(p), acc), {});
                const colors = Object.keys(buckets);
                if (this.globalSettings.drawingOrder === 'randomColor') {
                    for (let i = colors.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [colors[i], colors[j]] = [colors[j], colors[i]];
                    }
                }
                pixelsToProcess = colors.flatMap(c => buckets[c]);
                break;
            }
            case 'linear': default: break;
        }
        const chargesNow = Math.floor(this.userInfo?.charges?.count ?? 0);
        const pixelsToPaint = pixelsToProcess.slice(0, chargesNow);
        const bodiesByTile = pixelsToPaint.reduce((acc, p) => {
            const key = `${p.tx},${p.ty}`;
            if (!acc[key]) acc[key] = { colors: [], coords: [] };
            acc[key].colors.push(p.color);
            acc[key].coords.push(p.px, p.py);
            return acc;
        }, {});
        let totalPainted = 0;
        for (const tileKey in bodiesByTile) {
            const [tx, ty] = tileKey.split(',').map(Number);
            const body = { ...bodiesByTile[tileKey], t: this.token };
            const result = await this._executePaint(tx, ty, body);
            totalPainted += result.painted;
        }
        return totalPainted;
    }

    async buyProduct(productId, amount) {
        const response = await this.post(`https://backend.wplace.live/purchase`, { product: { id: productId, amount: amount } });
        if (response.data.success) {
            let purchaseMessage = `🛒 Purchase successful for product #${productId} (amount: ${amount})`;
            if (productId === 80) purchaseMessage = `🛒 Bought ${amount * 30} pixels for ${amount * 500} droplets`;
            else if (productId === 70) purchaseMessage = `🛒 Bought ${amount} Max Charge Upgrade(s) for ${amount * 500} droplets`;
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ${purchaseMessage}`);
            return true;
        }
        if (response.status === 429 || (response.data.error && response.data.error.includes("Error 1015"))) throw new NetworkError("(1015) Rate-limited during purchase.");
        throw Error(`Unexpected purchase response: ${JSON.stringify(response)}`);
    };

    async pixelsLeft(currentSkip = 1, useCachedTiles = false) {
        if (!useCachedTiles) {
            await this.loadTiles();
        }
        return this._getMismatchedPixels(currentSkip).length;
    };
}

// --- Data Persistence ---
const loadJSON = (filename) => existsSync(path.join(dataDir, filename)) ? JSON.parse(readFileSync(path.join(dataDir, filename), "utf8")) : {};
const saveJSON = (filename, data) => writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 4));

const users = loadJSON("users.json");
const saveUsers = () => saveJSON("users.json", users);

const templates = {};
const saveTemplates = () => {
    const templatesToSave = {};
    for (const id in templates) {
        const t = templates[id];
        templatesToSave[id] = {
            name: t.name, template: t.template, coords: t.coords,
            canBuyCharges: t.canBuyCharges, canBuyMaxCharges: t.canBuyMaxCharges,
            antiGriefMode: t.antiGriefMode, eraseMode: t.eraseMode,
            outlineMode: t.outlineMode, skipPaintedPixels: t.skipPaintedPixels,
            enableAutostart: t.enableAutostart, userIds: t.userIds
        };
    }
    saveJSON("templates.json", templatesToSave);
};

let currentSettings = {
    accountCooldown: 20000, purchaseCooldown: 5000,
    keepAliveCooldown: 5000, dropletReserve: 0, antiGriefStandby: 600000,
    drawingDirection: 'ttb', drawingOrder: 'linear', chargeThreshold: 0.5,
    pixelSkip: 1,
    proxyEnabled: false,
    proxyRotationMode: 'sequential',
    logProxyUsage: false
};
if (existsSync(path.join(dataDir, "settings.json"))) {
    currentSettings = { ...currentSettings, ...loadJSON("settings.json") };
}
const saveSettings = () => saveJSON("settings.json", currentSettings);

// --- Server State ---
const activeBrowserUsers = new Set();
const activeTemplateUsers = new Set();
const templateQueue = [];
let activePaintingTasks = 0;

// --- Token Management ---
const TokenManager = {
    tokenQueue: [],
    tokenPromise: null,
    resolvePromise: null,
    isTokenNeeded: false,
    TOKEN_EXPIRATION_MS: 2 * 60 * 1000,

    _purgeExpiredTokens() {
        const now = Date.now();
        const initialSize = this.tokenQueue.length;
        this.tokenQueue = this.tokenQueue.filter(item => now - item.receivedAt < this.TOKEN_EXPIRATION_MS);
        const removedCount = initialSize - this.tokenQueue.length;
        if (removedCount > 0) log('SYSTEM', 'wplacer', `TOKEN_MANAGER: Discarded ${removedCount} expired token(s).`);
    },
    getToken() {
        this._purgeExpiredTokens();
        if (this.tokenQueue.length > 0) return Promise.resolve(this.tokenQueue[0].token);
        if (!this.tokenPromise) {
            log('SYSTEM', 'wplacer', 'TOKEN_MANAGER: A task is waiting for a token.');
            this.isTokenNeeded = true;
            this.tokenPromise = new Promise((resolve) => { this.resolvePromise = resolve; });
        }
        return this.tokenPromise;
    },
    setToken(t) {
        log('SYSTEM', 'wplacer', `✅ TOKEN_MANAGER: Token received. Queue size: ${this.tokenQueue.length + 1}`);
        this.isTokenNeeded = false;
        const newToken = { token: t, receivedAt: Date.now() };
        this.tokenQueue.push(newToken);
        if (this.resolvePromise) {
            this.resolvePromise(newToken.token);
            this.tokenPromise = null;
            this.resolvePromise = null;
        }
    },
    invalidateToken() {
        this.tokenQueue.shift();
        log('SYSTEM', 'wplacer', `🔄 TOKEN_MANAGER: Invalidating token. ${this.tokenQueue.length} tokens remaining.`);
    }
};

// --- Error Handling ---
function logUserError(error, id, name, context) {
    const message = error.message || "An unknown error occurred.";
    if (error.name === 'NetworkError' || message.includes("(500)") || message.includes("(1015)") || message.includes("(502)") || error.name === "SuspensionError") {
        log(id, name, `❌ Failed to ${context}: ${message}`);
    } else {
        log(id, name, `❌ Failed to ${context}`, error);
    }
}

// --- Template Management ---
class TemplateManager {
    constructor(name, templateData, coords, canBuyCharges, canBuyMaxCharges, antiGriefMode, eraseMode, outlineMode, skipPaintedPixels, enableAutostart, userIds) {
        this.name = name;
        this.template = templateData;
        this.coords = coords;
        this.canBuyCharges = canBuyCharges;
        this.canBuyMaxCharges = canBuyMaxCharges;
        this.antiGriefMode = antiGriefMode;
        this.eraseMode = eraseMode;
        this.outlineMode = outlineMode;
        this.skipPaintedPixels = skipPaintedPixels;
        this.enableAutostart = enableAutostart;
        this.userIds = userIds;
        this.running = false;
        this.status = "Waiting to be started.";
        this.masterId = this.userIds[0];
        this.masterName = users[this.masterId]?.name || 'Unknown';
        this.sleepAbortController = null;
        this.totalPixels = this.template.data.flat().filter(p => p != 0).length;
        this.pixelsRemaining = this.totalPixels;
        this.currentPixelSkip = currentSettings.pixelSkip;
        this.initialRetryDelay = 30 * 1000;
        this.maxRetryDelay = 5 * 60 * 1000;
        this.currentRetryDelay = this.initialRetryDelay;
        this.userQueue = [...this.userIds];
    }

    cancellableSleep(ms) {
        return new Promise((resolve) => {
            const controller = new AbortController();
            this.sleepAbortController = controller;
            const signal = controller.signal;
            const timeout = setTimeout(() => {
                if (this.sleepAbortController === controller) this.sleepAbortController = null;
                resolve();
            }, ms);
            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                if (this.sleepAbortController === controller) this.sleepAbortController = null;
                resolve();
            });
        });
    }

    interruptSleep() {
        if (this.sleepAbortController) {
            log('SYSTEM', 'wplacer', `[${this.name}] ⚙️ Settings changed, waking up.`);
            this.sleepAbortController.abort();
        }
    }

    async handleUpgrades(wplacer) {
        if (!this.canBuyMaxCharges) return;
        await wplacer.loadUserInfo();
        const affordableDroplets = wplacer.userInfo.droplets - currentSettings.dropletReserve;
        const amountToBuy = Math.floor(affordableDroplets / 500);
        if (amountToBuy > 0) {
            log(wplacer.userInfo.id, wplacer.userInfo.name, `💰 Attempting to buy ${amountToBuy} max charge upgrade(s).`);
            try {
                await wplacer.buyProduct(70, amountToBuy);
                await sleep(currentSettings.purchaseCooldown);
                await wplacer.loadUserInfo();
            } catch (error) {
                logUserError(error, wplacer.userInfo.id, wplacer.userInfo.name, "purchase max charge upgrades");
            }
        }
    }

    async _performPaintTurn(wplacer) {
        let paintedTotal = 0;
        let done = false;
        while (!done && this.running) {
            try {
                wplacer.token = await TokenManager.getToken();
                const painted = await wplacer.paint(this.currentPixelSkip);
                paintedTotal += painted;
                done = true;
            } catch (error) {
                if (error.name === "SuspensionError") {
                    const suspendedUntilDate = new Date(error.suspendedUntil).toLocaleString();
                    log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🛑 Account suspended until ${suspendedUntilDate}.`);
                    users[wplacer.userInfo.id].suspendedUntil = error.suspendedUntil;
                    saveUsers();
                    throw error;
                }
                if (error.message === 'REFRESH_TOKEN') {
                    log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🔄 Token expired. Trying next...`);
                    TokenManager.invalidateToken();
                    await sleep(1000);
                } else {
                    throw error;
                }
            }
        }
        if (wplacer?.userInfo?.id && paintedTotal > 0) ChargeCache.consume(wplacer.userInfo.id, paintedTotal);
        return paintedTotal;
    }

    async start() {
        this.running = true;
        this.status = "Started.";
        log('SYSTEM', 'wplacer', `▶️ Starting template "${this.name}"...`);
        activePaintingTasks++;
        try {
            while (this.running) {
                for (this.currentPixelSkip = currentSettings.pixelSkip; this.currentPixelSkip >= 1; this.currentPixelSkip /= 2) {
                    if (!this.running) break;
                    log('SYSTEM', 'wplacer', `[${this.name}] Starting pass (1/${this.currentPixelSkip})`);
                    let passComplete = false;
                    while (this.running && !passComplete) {
                        let pixelsChecked = false;
                        let passPixelsRemaining = -1;
                        const initialQueueSizeForCheck = this.userQueue.length;
                        if (initialQueueSizeForCheck === 0) {
                            log('SYSTEM', 'wplacer', `[${this.name}] No valid users in queue to check canvas. Waiting...`);
                            await sleep(5000);
                            this.userQueue = [...this.userIds];
                            continue;
                        }
                        for (let i = 0; i < initialQueueSizeForCheck; i++) {
                            const checkUserId = this.userQueue.shift();
                            if (!users[checkUserId] || (users[checkUserId].suspendedUntil && Date.now() < users[checkUserId].suspendedUntil)) {
                                continue;
                            }
                            const templateSettings = { eraseMode: this.eraseMode, outlineMode: this.outlineMode, skipPaintedPixels: this.skipPaintedPixels };
                            const checkWplacer = new WPlacer(this.template, this.coords, currentSettings, templateSettings, this.name);
                            try {
                                await checkWplacer.login(users[checkUserId].cookies);
                                this.pixelsRemaining = await checkWplacer.pixelsLeft(1, false);
                                passPixelsRemaining = await checkWplacer.pixelsLeft(this.currentPixelSkip, true);
                                this.currentRetryDelay = this.initialRetryDelay;
                                pixelsChecked = true;
                                this.userQueue.push(checkUserId);
                                break;
                            } catch (error) {
                                logUserError(error, checkUserId, users[checkUserId].name, "check pixels left");
                                this.userQueue.push(checkUserId);
                            }
                        }
                        if (!pixelsChecked) {
                            log('SYSTEM', 'wplacer', `[${this.name}] All users failed to check canvas. Retrying in ${duration(this.currentRetryDelay)}.`);
                            await sleep(this.currentRetryDelay);
                            this.currentRetryDelay = Math.min(this.currentRetryDelay * 2, this.maxRetryDelay);
                            continue;
                        }
                        if (this.pixelsRemaining === 0) {
                            if (this.antiGriefMode) {
                                this.status = "Monitoring for changes.";
                                log('SYSTEM', 'wplacer', `[${this.name}] ✅ All passes complete. Monitoring... Checking again in ${duration(currentSettings.antiGriefStandby)}.`);
                                await this.cancellableSleep(currentSettings.antiGriefStandby);
                                continue;
                            }
                            
                            log('SYSTEM', 'wplacer', `[${this.name}] ✅ All passes complete! Template finished!`);
                            this.status = "Finished.";
                            this.running = false;
                            break;
                        }
                        if (passPixelsRemaining === 0) {
                            log('SYSTEM', 'wplacer', `[${this.name}] ✅ Pass (1/${this.currentPixelSkip}) complete.`);
                            passComplete = true;
                            continue;
                        }
                        if (!this.running) break;
                        if (this.userQueue.length === 0) {
                            log('SYSTEM', 'wplacer', `[${this.name}] ⏳ No valid users in queue. Waiting...`);
                            await sleep(5000);
                            this.userQueue = [...this.userIds];
                            continue;
                        }
                        let foundUserForTurn = false;
                        const queueSize = this.userQueue.length;
                        for (let i = 0; i < queueSize; i++) {
                            const userId = this.userQueue.shift();
                            let shouldRequeue = true;
                            const now = Date.now();
                            if (!users[userId] || (users[userId].suspendedUntil && now < users[userId].suspendedUntil)) {
                                continue;
                            }
                            if (ChargeCache.stale(userId, now)) {
                                if (!activeBrowserUsers.has(userId)) {
                                    activeBrowserUsers.add(userId);
                                    const w = new WPlacer();
                                    try {
                                        await w.login(users[userId].cookies);
                                    } catch (e) {
                                        logUserError(e, userId, users[userId].name, "opportunistic resync");
                                    } finally {
                                        activeBrowserUsers.delete(userId);
                                    }
                                }
                            }
                            const predicted = ChargeCache.predict(userId, now);
                            if (predicted && Math.floor(predicted.count) >= Math.max(1, Math.floor(predicted.max * currentSettings.chargeThreshold))) {
                                activeBrowserUsers.add(userId);
                                const wplacer = new WPlacer(this.template, this.coords, currentSettings, { eraseMode: this.eraseMode, outlineMode: this.outlineMode, skipPaintedPixels: this.skipPaintedPixels }, this.name);
                                try {
                                    const userInfo = await wplacer.login(users[userId].cookies);
                                    this.status = `Running user ${userInfo.name}#${userInfo.id} | Pass (1/${this.currentPixelSkip})`;
                                    log(userInfo.id, userInfo.name, `[${this.name}] 🔋 Predicted charges: ${Math.floor(predicted.count)}/${predicted.max}.`);
                                    const paintedNow = await this._performPaintTurn(wplacer);
                                    if (paintedNow > 0) foundUserForTurn = true;
                                    await this.handleUpgrades(wplacer);
                                    this.currentRetryDelay = this.initialRetryDelay;
                                } catch (error) {
                                    if (error.name !== 'SuspensionError') logUserError(error, userId, users[userId].name, "perform paint turn");
                                } finally {
                                    activeBrowserUsers.delete(userId);
                                    if (shouldRequeue) this.userQueue.push(userId);
                                }
                                if (foundUserForTurn) break;
                            } else {
                                if (shouldRequeue) this.userQueue.push(userId);
                            }
                        }
                        if (foundUserForTurn) {
                            if (this.running && this.userIds.length > 1) {
                                log('SYSTEM', 'wplacer', `[${this.name}] ⏱️ Waiting for cooldown (${duration(currentSettings.accountCooldown)}).`);
                                await sleep(currentSettings.accountCooldown);
                            }
                        } else {
                            const now = Date.now();
                            const cooldowns = this.userQueue.map(id => {
                                const p = ChargeCache.predict(id, now);
                                if (!p) return Infinity;
                                const threshold = Math.max(1, Math.floor(p.max * currentSettings.chargeThreshold));
                                return Math.max(0, (threshold - Math.floor(p.count)) * (p.cooldownMs ?? 30000));
                            });
                            const waitTime = (cooldowns.length > 0 ? Math.min(...cooldowns) : 60000) + 2000;
                            this.status = "Waiting for charges.";
                            log('SYSTEM', 'wplacer', `[${this.name}] ⏳ No users ready. Waiting ~${duration(waitTime)}.`);
                            await this.cancellableSleep(waitTime);
                        }
                    }
                }
                if (!this.running) break;
            }
        } finally {
            activePaintingTasks--;
            if (this.status !== "Finished.") this.status = "Stopped.";
            if (!this.antiGriefMode) {
                this.userIds.forEach(id => activeTemplateUsers.delete(id));
                processQueue();
            }
        }
    }
}

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

// --- Autostartup Templates Array ---
const autostartedTemplates = [];

// --- Queue Processing ---
const processQueue = () => {
    for (let i = 0; i < templateQueue.length; i++) {
        const templateId = templateQueue[i];
        const manager = templates[templateId];
        if (!manager) {
            templateQueue.splice(i, 1);
            i--;
            continue;
        }
        const isUserBusy = manager.userIds.some(id => activeTemplateUsers.has(id));
        if (!isUserBusy) {
            templateQueue.splice(i, 1);
            manager.userIds.forEach(id => activeTemplateUsers.add(id));
            manager.start().catch(error => log(templateId, manager.masterName, "Error starting queued template", error));
            break;
        }
    }
};

// --- API Endpoints ---
app.get("/token-needed", (req, res) => res.json({ needed: TokenManager.isTokenNeeded }));
app.post("/t", (req, res) => {
    const { t } = req.body;
    if (!t) return res.sendStatus(400);
    TokenManager.setToken(t);
    res.sendStatus(200);
});

app.get("/users", (_, res) => res.json(users));
app.post("/user", async (req, res) => {
    if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
    const wplacer = new WPlacer();
    try {
        const userInfo = await wplacer.login(req.body.cookies);
        users[userInfo.id] = { name: userInfo.name, cookies: req.body.cookies, expirationDate: req.body.expirationDate };
        saveUsers();
        res.json(userInfo);
    } catch (error) {
        logUserError(error, 'NEW_USER', 'N/A', 'add new user');
        res.status(500).json({ error: error.message });
    }
});

app.delete("/user/:id", async (req, res) => {
    const userIdToDelete = req.params.id;
    if (!userIdToDelete || !users[userIdToDelete]) return res.sendStatus(400);
    const deletedUserName = users[userIdToDelete].name;
    delete users[userIdToDelete];
    saveUsers();
    log('SYSTEM', 'Users', `Deleted user ${deletedUserName}#${userIdToDelete}.`);
    let templatesModified = false;
    for (const templateId in templates) {
        const template = templates[templateId];
        const initialUserCount = template.userIds.length;
        template.userIds = template.userIds.filter(id => id !== userIdToDelete);
        template.userQueue = template.userQueue.filter(id => id !== userIdToDelete);
        if (template.userIds.length < initialUserCount) {
            templatesModified = true;
            log('SYSTEM', 'Templates', `Removed user ${deletedUserName}#${userIdToDelete} from template "${template.name}".`);
            if (template.masterId === userIdToDelete) {
                template.masterId = template.userIds[0] || null;
                template.masterName = template.masterId ? users[template.masterId].name : null;
            }
            if (template.userIds.length === 0 && template.running) {
                template.running = false;
                log('SYSTEM', 'wplacer', `[${template.name}] 🛑 Template stopped, no users left.`);
            }
        }
    }
    if (templatesModified) saveTemplates();
    res.sendStatus(200);
});

app.get("/user/status/:id", async (req, res) => {
    const { id } = req.params;
    if (!users[id] || activeBrowserUsers.has(id)) return res.sendStatus(409);
    activeBrowserUsers.add(id);
    const wplacer = new WPlacer();
    try {
        const userInfo = await wplacer.login(users[id].cookies);
        res.status(200).json(userInfo);
    } catch (error) {
        logUserError(error, id, users[id].name, "validate cookie");
        res.status(500).json({ error: error.message });
    } finally {
        activeBrowserUsers.delete(id);
    }
});

app.post("/users/status", async (req, res) => {
    const userIds = Object.keys(users);
    const results = {};
    const checkUser = async (id) => {
        if (activeBrowserUsers.has(id)) {
            results[id] = { success: false, error: "User is busy." };
            return;
        }
        activeBrowserUsers.add(id);
        const wplacer = new WPlacer();
        try {
            const userInfo = await wplacer.login(users[id].cookies);
            results[id] = { success: true, data: userInfo };
        } catch (error) {
            logUserError(error, id, users[id].name, "bulk check");
            results[id] = { success: false, error: error.message };
        } finally {
            activeBrowserUsers.delete(id);
        }
    };
    const USER_TIMEOUT_MS = 30_000;
    const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms))]);
    for (const userId of userIds) {
        try {
            await withTimeout(checkUser(userId), USER_TIMEOUT_MS, `user ${userId}`);
        } catch (err) {
            results[userId] = { success: false, error: err.message };
        }
    }
    res.json(results);
});

app.get("/templates", (_, res) => {
    const sanitizedTemplates = {};
    for (const id in templates) {
        const t = templates[id];
        sanitizedTemplates[id] = {
            name: t.name, template: t.template, coords: t.coords,
            canBuyCharges: t.canBuyCharges, canBuyMaxCharges: t.canBuyMaxCharges,
            antiGriefMode: t.antiGriefMode, eraseMode: t.eraseMode,
            outlineMode: t.outlineMode, skipPaintedPixels: t.skipPaintedPixels,
            enableAutostart: t.enableAutostart, userIds: t.userIds,
            running: t.running, status: t.status,
            pixelsRemaining: t.pixelsRemaining, totalPixels: t.totalPixels
        };
    }
    res.json(sanitizedTemplates);
});

app.post("/template", async (req, res) => {
    const { templateName, template, coords, userIds, canBuyCharges, canBuyMaxCharges, antiGriefMode, eraseMode, outlineMode, skipPaintedPixels, enableAutostart } = req.body;
    if (!templateName || !template || !coords || !userIds || !userIds.length) return res.sendStatus(400);
    if (Object.values(templates).some(t => t.name === templateName)) return res.status(409).json({ error: "A template with this name already exists." });
    const templateId = Date.now().toString();
    templates[templateId] = new TemplateManager(templateName, template, coords, canBuyCharges, canBuyMaxCharges, antiGriefMode, eraseMode, outlineMode, skipPaintedPixels, enableAutostart, userIds);
    saveTemplates();
    res.status(200).json({ id: templateId });
});

app.delete("/template/:id", async (req, res) => {
    const { id } = req.params;
    if (!id || !templates[id] || templates[id].running) return res.sendStatus(400);
    delete templates[id];
    saveTemplates();
    res.sendStatus(200);
});

app.put("/template/edit/:id", async (req, res) => {
    const { id } = req.params;
    if (!templates[id]) return res.sendStatus(404);
    const manager = templates[id];
    const { templateName, coords, userIds, canBuyCharges, canBuyMaxCharges, antiGriefMode, eraseMode, outlineMode, skipPaintedPixels, enableAutostart, template } = req.body;
    manager.name = templateName;
    manager.coords = coords;
    manager.userIds = userIds;
    manager.userQueue = [...userIds];
    manager.canBuyCharges = canBuyCharges;
    manager.canBuyMaxCharges = canBuyMaxCharges;
    manager.antiGriefMode = antiGriefMode;
    manager.eraseMode = eraseMode;
    manager.outlineMode = outlineMode;
    manager.skipPaintedPixels = skipPaintedPixels;
    manager.enableAutostart = enableAutostart;
    if (template) {
        manager.template = template;
        manager.totalPixels = manager.template.data.flat().filter(p => p > 0).length;
    }
    manager.masterId = manager.userIds[0];
    manager.masterName = users[manager.masterId].name;
    saveTemplates();
    res.sendStatus(200);
});

app.put("/template/:id", async (req, res) => {
    const { id } = req.params;
    if (!id || !templates[id]) return res.sendStatus(400);
    const manager = templates[id];
    if (req.body.running && !manager.running) {
        if (manager.antiGriefMode) {
            manager.start().catch(error => log(id, manager.masterName, "Error starting template", error));
        } else {
            const isUserBusy = manager.userIds.some(id => activeTemplateUsers.has(id));
            if (isUserBusy) {
                if (!templateQueue.includes(id)) {
                    templateQueue.push(id);
                    manager.status = "Queued";
                    log('SYSTEM', 'wplacer', `[${manager.name}] Template queued as its users are busy.`);
                }
            } else {
                manager.userIds.forEach(id => activeTemplateUsers.add(id));
                manager.start().catch(error => log(id, manager.masterName, "Error starting template", error));
            }
        }
    } else if (!req.body.running) {
        manager.running = false;
        const queueIndex = templateQueue.indexOf(id);
        if (queueIndex > -1) templateQueue.splice(queueIndex, 1);
        manager.userIds.forEach(id => activeTemplateUsers.delete(id));
        processQueue();
    }
    res.sendStatus(200);
});

app.get('/settings', (_, res) => res.json({ ...currentSettings, proxyCount: loadedProxies.length }));
app.put('/settings', (req, res) => {
    const oldSettings = { ...currentSettings };
    currentSettings = { ...currentSettings, ...req.body };
    saveSettings();
    if (oldSettings.chargeThreshold !== currentSettings.chargeThreshold) {
        for (const id in templates) {
            if (templates[id].running) templates[id].interruptSleep();
        }
    }
    res.sendStatus(200);
});

app.post('/reload-proxies', (req, res) => {
    loadProxies();
    res.status(200).json({ success: true, count: loadedProxies.length });
});

app.get("/canvas", async (req, res) => {
    const { tx, ty } = req.query;
    if (isNaN(parseInt(tx)) || isNaN(parseInt(ty))) return res.sendStatus(400);
    try {
        const url = `https://backend.wplace.live/files/s0/tiles/${tx}/${ty}.png`;
        const response = await fetch(url);
        if (!response.ok) return res.sendStatus(response.status);
        const buffer = Buffer.from(await response.arrayBuffer());
        res.json({ image: `data:image/png;base64,${buffer.toString('base64')}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Server Startup ---
(async () => {
    console.clear();
    const version = JSON.parse(readFileSync("package.json", "utf8")).version;
    console.log(`\n--- wplacer v${version} by luluwaffless and jinx ---\n`);
    const loadedTemplates = loadJSON("templates.json");
    for (const id in loadedTemplates) {
        const t = loadedTemplates[id];
        if (t.userIds.every(uid => users[uid])) {
            templates[id] = new TemplateManager(t.name, t.template, t.coords, t.canBuyCharges, t.canBuyMaxCharges, t.antiGriefMode, t.eraseMode, t.outlineMode, t.skipPaintedPixels, t.enableAutostart, t.userIds);
            if (t.enableAutostart) autostartedTemplates.push(id);
        } else {
            console.warn(`⚠️ Template "${t.name}" was not loaded because its assigned user(s) no longer exist.`);
        }
    }
    loadProxies();
    console.log(`✅ Loaded ${Object.keys(templates).length} templates, ${Object.keys(users).length} users and ${loadedProxies.length} proxies.`);
    const host = "0.0.0.0";
    const initial = Number(process.env.PORT) || 80;
    const common = [3000, 5173, 8080, 8000, 5000, 7000, 4200, 5500];
    const probe = Array.from(new Set([initial, ...common]));
    for (let p = 3001; p <= 3050; p++) probe.push(p);
    function tryListen(idx = 0) {
        if (idx >= probe.length) {
            console.error("No available port found.");
            process.exit(1);
        }
        const port = probe[idx];
        const server = app.listen(port, host);
        server.on("listening", () => {
            const url = `http://localhost:${port}`;
            console.log(`✅ Server listening on ${url}`);
            console.log("   Open the web UI in your browser to start.");
            openBrowser(url);
            autostartedTemplates.forEach(id => {
                const manager = templates[id];
                if (manager) {
                    log('SYSTEM', 'wplacer', `[${manager.name}] Autostarting template...`);
                    if (manager.antiGriefMode) {
                        manager.start().catch(error => log(id, manager.masterName, "Error autostarting template", error));
                    } else {
                        const isUserBusy = manager.userIds.some(uid => activeTemplateUsers.has(uid));
                        if (isUserBusy) {
                            if (!templateQueue.includes(id)) {
                                templateQueue.push(id);
                                manager.status = "Queued";
                            }
                        } else {
                            manager.userIds.forEach(uid => activeTemplateUsers.add(uid));
                            manager.start().catch(error => log(id, manager.masterName, "Error autostarting template", error));
                        }
                    }
                }
            });
        });
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.error(`Port ${port} in use. Trying ${probe[idx + 1]}...`);
                tryListen(idx + 1);
            } else if (err.code === "EACCES") {
                const nextIdx = Math.max(idx + 1, probe.indexOf(common[0]));
                console.error(`Permission denied on ${port}. Trying ${probe[nextIdx]}...`);
                tryListen(nextIdx);
            } else {
                console.error("Server error:", err);
                process.exit(1);
            }
        });
    }
    tryListen(0);
})();
