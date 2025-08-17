import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { appendFileSync } from "node:fs";
import puppeteer from 'puppeteer-extra';
import notifier from 'node-notifier';
import path from 'node:path';

const pallete = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31, "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
export const duration = (durationMs) => {
    if (durationMs <= 0) return "0 seconds";
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const parts = [];
    if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
    if (seconds || parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
    if (parts.length === 1) {
        return parts[0];
    } else if (parts.length === 2) {
        return parts.join(' and ');
    } else {
        return parts.slice(0, -1).join(', ') + ' and ' + parts.slice(-1);
    };
};
export const log = async (id, name, data, error) => {
    const timestamp = new Date().toLocaleString();
    const identifier = `(${name}#${id})`;
    if (error) {
        console.error(`[${timestamp}] ${identifier} ${data}:`, error);
        appendFileSync(`errors.log`, `[${timestamp}] ${identifier} ${data}: ${error.stack || error.message}\n`);
    } else {
        console.log(`[${timestamp}] ${identifier} ${data}`);
        appendFileSync(`logs.log`, `[${timestamp}] ${identifier} ${data}\n`);
    };
};
export class WPlacer {
    constructor(template, coords, canBuyCharges, requestTokenCallback, settings) {
        this.status = "Waiting until called to start.";
        this.template = template;
        this.coords = coords;
        this.canBuyCharges = canBuyCharges;
        this.requestTokenCallback = requestTokenCallback;
        this.settings = settings;
        this.cookies = null;
        this.browser = null;
        this.me = null;
        this.userInfo = null;
        this.tiles = new Map();
        this.token = null;
        this.running = false;
        this._resolveToken = null;
        this.tokenPromise = new Promise((resolve) => {
            this._resolveToken = resolve;
        });
    };
    async login(cookies) {
        this.cookies = cookies;
        puppeteer.use(StealthPlugin());
        this.browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        for (const cookie of Object.keys(this.cookies)) await this.browser.setCookie({ name: cookie, value: this.cookies[cookie], domain: 'backend.wplace.live' });
        await this.loadUserInfo();
        return this.userInfo;
    };
    async close() {
        if (this.browser) await this.browser.close();
    }
    async loadUserInfo() {
        if (!this.me) this.me = await this.browser.newPage();
        await this.me.goto('https://backend.wplace.live/me');
        await this.me.waitForSelector('body', { timeout: 15000 });
        const bodyText = await this.me.evaluate(() => document.body.innerText);

        if (bodyText.includes('1015')) {
            throw new Error("(1015) You are being rate-limited by the server. Please wait a moment and try again.");
        }

        try {
            const userInfo = JSON.parse(bodyText);
            if (userInfo.error) {
                throw new Error(`(500) Failed to authenticate: "${userInfo.error}". The cookie is likely invalid or expired.`);
            }
            if (userInfo.id && userInfo.name) {
                this.userInfo = userInfo;
                return true;
            } else {
                throw new Error(`Unexpected response from /me endpoint: ${JSON.stringify(userInfo)}`);
            }
        } catch (e) {
            throw new Error(`Failed to parse server response. The service may be down or returning an invalid format. Response: "${bodyText}"`);
        }
    };
    cookieStr = (obj) => Object.keys(obj).map(cookie => `${cookie}=${obj[cookie]}`).join(";");
    async post(url, body) {
        const response = await this.me.evaluate((url, cookies, body) => new Promise(async (resolve) => {
            const request = await fetch(url, {
                method: "POST",
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "text/plain;charset=UTF-8",
                    "Cookie": cookies,
                    "Referer": "https://wplace.live/"
                },
                body: JSON.stringify(body)
            });
            const data = await request.json();
            resolve({ status: request.status, data: data });
        }), url, this.cookieStr(this.cookies), body);
        return response;
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
                const promise = this.me.evaluate((pallete, src) => new Promise((resolve) => {
                    const image = new Image();
                    image.crossOrigin = "Anonymous";
                    image.onload = () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = image.width;
                        canvas.height = image.height;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(image, 0, 0);
                        const template = { width: canvas.width, height: canvas.height, data: Array.from({ length: canvas.width }, () => []) };
                        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        for (let x = 0; x < canvas.width; x++) {
                            for (let y = 0; y < canvas.height; y++) {
                                const i = (y * canvas.width + x) * 4;
                                const [r, g, b, a] = [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
                                if (a === 255) template.data[x][y] = pallete[`${r},${g},${b}`];
                                else template.data[x][y] = 0;
                            };
                        };
                        canvas.remove();
                        resolve(template);
                    };
                    image.onerror = () => resolve(null); // Resolve with null on error
                    image.src = src;
                }), pallete, `https://backend.wplace.live/files/s0/tiles/${currentTx}/${currentTy}.png?t=${Date.now()}`)
                .then(tileData => {
                    if (tileData) {
                        this.tiles.set(`${currentTx}_${currentTy}`, tileData);
                    }
                });
                tilePromises.push(promise);
            }
        }
        await Promise.all(tilePromises);
        return true;
    }
    setToken(t) {
        if (this._resolveToken) {
            this._resolveToken(t);
            this._resolveToken = null;
            this.token = t;
        };
    };
    async waitForToken() {
        if (this.requestTokenCallback) {
            this.requestTokenCallback(`user-${this.userInfo.name}`);
        }
        log(this.userInfo.id, this.userInfo.name, "⚠️ No Turnstile token, requesting one from clients...");
        if (this.settings && this.settings.turnstileNotifications) {
            notifier.notify({
                title: 'wplacer: Action Required',
                message: `User ${this.userInfo.name} (#${this.userInfo.id}) needs a new captcha token to continue. Please open wplace.live or solve a captcha.`,
                icon: path.join(process.cwd(), 'public', 'icons', 'favicon.png'),
                sound: true,
                wait: true
            });
        }
        await this.tokenPromise;
        log(this.userInfo.id, this.userInfo.name, "✅ Got Turnstile token!");
    }

    async _executePaint(tx, ty, body) {
        if (body.colors.length === 0) return { painted: 0, success: true };
        const response = await this.post(`https://backend.wplace.live/s0/pixel/${tx}/${ty}`, body);

        if (response.data.painted && response.data.painted == body.colors.length) {
            log(this.userInfo.id, this.userInfo.name, `🎨 Painted ${body.colors.length} pixels on tile ${tx},${ty}.`);
            return { painted: body.colors.length, success: true };
        } else if (response.status === 403 && response.data.error === "refresh") {
            this.token = null;
            this.tokenPromise = new Promise((resolve) => { this._resolveToken = resolve; });
            return { painted: 0, success: false, reason: 'refresh' };
        } else if (response.status === 500) {
            log(this.userInfo.id, this.userInfo.name, "⏱️ Rate limited by the server. Waiting 40 seconds before retrying...");
            await this.sleep(40000);
            return { painted: 0, success: false, reason: 'ratelimit' };
        } else if (response.status === 429 || (response.data.error && response.data.error.includes("1015"))) {
             throw new Error("(1015) You are being rate-limited. Please wait a moment and try again.");
        } else {
            throw Error(`Unexpected response for tile ${tx},${ty}: ${JSON.stringify(response)}`);
        }
    }

    _getMismatchedPixels() {
        const [startX, startY, startPx, startPy] = this.coords;
        const mismatched = [];
        for (let y = 0; y < this.template.height; y++) {
            for (let x = 0; x < this.template.width; x++) {
                const templateColor = this.template.data[x][y];
                if (templateColor === 0) continue;

                const globalPx = startPx + x;
                const globalPy = startPy + y;
                const targetTx = startX + Math.floor(globalPx / 1000);
                const targetTy = startY + Math.floor(globalPy / 1000);
                const localPx = globalPx % 1000;
                const localPy = globalPy % 1000;

                const tile = this.tiles.get(`${targetTx}_${targetTy}`);
                if (!tile || !tile.data[localPx]) continue; 
                
                const tileColor = tile.data[localPx][localPy];

                if (templateColor !== tileColor) {
                    mismatched.push({ tx: targetTx, ty: targetTy, px: localPx, py: localPy, color: templateColor });
                }
            }
        }
        return mismatched;
    }

    async paint(method = 'linear') {
        await this.loadUserInfo();

        switch (method) {
            case 'linear': log(this.userInfo.id, this.userInfo.name, "🎨 Painting (Top to Bottom)..."); break;
            case 'linear-reversed': log(this.userInfo.id, this.userInfo.name, "🎨 Painting (Bottom to Top)..."); break;
            case 'singleColorRandom': log(this.userInfo.id, this.userInfo.name, `🎨 Painting (Random Color)...`); break;
            case 'colorByColor': log(this.userInfo.id, this.userInfo.name, `🎨 Painting (Color by Color)...`); break;
            default: throw new Error(`Unknown paint method: ${method}`);
        }

        while (true) {
            await this.loadTiles();
            if (!this.token) await this.waitForToken();
        
            let mismatchedPixels = this._getMismatchedPixels();
            if (mismatchedPixels.length === 0) return 0;
    
            switch (method) {
                case 'linear-reversed':
                    mismatchedPixels.reverse();
                    break;
                case 'singleColorRandom':
                case 'colorByColor':
                    const pixelsByColor = mismatchedPixels.reduce((acc, p) => {
                        if (!acc[p.color]) acc[p.color] = [];
                        acc[p.color].push(p);
                        return acc;
                    }, {});
                    const colors = Object.keys(pixelsByColor);
                    if (method === 'singleColorRandom') {
                        for (let i = colors.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [colors[i], colors[j]] = [colors[j], colors[i]];
                        }
                    }
                    mismatchedPixels = colors.flatMap(color => pixelsByColor[color]);
                    break;
            }
    
            const pixelsToPaint = mismatchedPixels.slice(0, Math.floor(this.userInfo.charges.count));
            const bodiesByTile = pixelsToPaint.reduce((acc, p) => {
                const key = `${p.tx}_${p.ty}`;
                if (!acc[key]) acc[key] = { colors: [], coords: [] };
                acc[key].colors.push(p.color);
                acc[key].coords.push(p.px, p.py);
                return acc;
            }, {});
    
            let totalPainted = 0;
            let needsRetry = false;
            for (const tileKey in bodiesByTile) {
                const [tx, ty] = tileKey.split('_').map(Number);
                const body = { ...bodiesByTile[tileKey], t: this.token };
                const result = await this._executePaint(tx, ty, body);
                
                if (result.success) {
                    totalPainted += result.painted;
                } else {
                    needsRetry = true;
                    break;
                }
            }

            if (!needsRetry) {
                return totalPainted;
            }
        }
    }

    async buyProduct(productId, amount) {
        const response = await this.post(`https://backend.wplace.live/purchase`, { product: { id: productId, amount: amount } });
        if (response.data.success) {
            let purchaseMessage = `🛒 Purchase successful for product #${productId} (amount: ${amount})`;
            if (productId === 80) {
                purchaseMessage = `🛒 Bought ${amount * 30} pixels for ${amount * 500} droplets`;
            } else if (productId === 70) {
                purchaseMessage = `🛒 Bought Max Charge Upgrade for 500 droplets`;
            }
            log(this.userInfo.id, this.userInfo.name, purchaseMessage);
            return true;
        } else if (response.status === 429 || (response.data.error && response.data.error.includes("1015"))) {
             throw new Error("(1015) You are being rate-limited while trying to make a purchase. Please wait.");
        } else {
            throw Error(`Unexpected response during purchase: ${JSON.stringify(response)}`);
        }
    };
    async pixelsLeft() {
        await this.loadTiles();
        return this._getMismatchedPixels().length;
    };
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };
};