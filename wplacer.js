import { CookieJar } from "tough-cookie";
import { Impit } from "impit";
import { Image, createCanvas } from "canvas"
import { appendFileSync } from "node:fs";

const basic_colors = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31 };
const premium_colors = { "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
const pallete = { ...basic_colors, ...premium_colors };

const colorBitmapShift = Object.keys(basic_colors).length + 1 // +1 for the transparent color id (0)

export const duration = (durationMs) => {
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
    constructor(template, coords, canBuyCharges, settings, templateName) {
        this.status = "Waiting until called to start.";
        this.template = template;
        this.templateName = templateName;
        this.coords = coords;
        this.canBuyCharges = canBuyCharges;
        this.settings = settings;
        this.cookies = null;
        this.browser = null;
        this.userInfo = null;
        this.tiles = new Map();
        this.token = null;
    };
    async login(cookies) {
        this.cookies = cookies;
        let jar = new CookieJar();
        for (const cookie of Object.keys(this.cookies)) jar.setCookieSync(`${cookie}=${this.cookies[cookie]}; Path=/`, "https://backend.wplace.live");
        this.browser = new Impit({ cookieJar: jar, browser: "chrome", ignoreTlsErrors: true });
        await this.loadUserInfo();
        return this.userInfo;
    };
    async close() {
        return;
    }
    async loadUserInfo() {
        let me = await this.browser.fetch("https://backend.wplace.live/me");
        let bodyText = await me.text();

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
            if (bodyText.includes('Error 1015')) {
                throw new Error("(1015) You are being rate-limited by the server. Please wait a moment and try again.");
            }
            if (bodyText.includes('502') && bodyText.includes('gateway')) {
                throw new Error(`(502) Bad Gateway: The server is temporarily unavailable. Please try again later. Response: "${bodyText.substring(0, 150)}..."`);
            }
            throw new Error(`Failed to parse server response. The service may be down or returning an invalid format. Response: "${bodyText.substring(0, 150)}..."`);
        }
    };
    async post(url, body) {
        const request = await this.browser.fetch(url, {
            method: "POST",
            headers: {
                "Accept": "*/*",
                "Content-Type": "text/plain;charset=UTF-8",
                "Referer": "https://wplace.live/"
            },
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
                const promise = this.browser.fetch(`https://backend.wplace.live/files/s0/tiles/${currentTx}/${currentTy}.png?t=${Date.now()}`)
                    .then(res => res.arrayBuffer())
                    .then(buffer => {
                        const image = new Image();
                        image.src = Buffer.from(buffer);
                        const canvas = createCanvas(image.width, image.height);
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(image, 0, 0);
                        const template = { width: canvas.width, height: canvas.height, data: Array.from({ length: canvas.width }, () => []) };
                        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        for (let x = 0; x < canvas.width; x++) {
                            for (let y = 0; y < canvas.height; y++) {
                                const i = (y * canvas.width + x) * 4;
                                const [r, g, b, a] = [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
                                if (a === 255) {
                                    template.data[x][y] = pallete[`${r},${g},${b}`] || 0;
                                } else template.data[x][y] = 0;
                            };
                        };
                        this.tiles.set(`${currentTx}_${currentTy}`, template);
                    }).catch(err => {
                        log(this.userInfo.id, this.userInfo.name, `Failed to load tile ${currentTx}, ${currentTy}`, err);
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

        // Handle successful paint
        if (response.data && response.data.painted && response.data.painted == body.colors.length) {
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painted ${body.colors.length} pixels on tile ${tx}, ${ty}.`);
            return { painted: body.colors.length };
        }
        
        // Handle specific error conditions
        if (response.status == 403 && response.data && (response.data.error === "refresh" || response.data.error === "Unauthorized")) {
            throw new Error('REFRESH_TOKEN');
        }
        
        if (response.status == 451 && response.data && response.data.suspension) {
            throw new Error(`ACCOUNT_SUSPENDED:${response.data.durationMs}`);
        }
        
        if (response.status == 500) {
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ⏱️ Server error (500). Waiting 40 seconds before retrying...`);
            await this.sleep(40000);
            return { painted: 0 };
        }
        
        if (response.status == 429 || (response.data && response.data.error && response.data.error.includes("Error 1015"))) {
            throw new Error("(1015) You are being rate-limited. Please wait a moment and try again.");
        }
        
        // Fallback for any other unexpected error
        throw new Error(`Unexpected response for tile ${tx},${ty}: ${JSON.stringify(response)}`);
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

                if (templateColor !== tileColor && this.hasColor(templateColor)) {
                    const neighbors = [
                        this.template.data[x - 1]?.[y],
                        this.template.data[x + 1]?.[y],
                        this.template.data[x]?.[y - 1],
                        this.template.data[x]?.[y + 1]
                    ];
                    const isEdge = neighbors.some(n => n === 0 || n === undefined);
                    mismatched.push({ tx: targetTx, ty: targetTy, px: localPx, py: localPy, color: templateColor, isEdge });
                }
            }
        }
        return mismatched;
    }

    async paint(method = 'linear') {
        await this.loadUserInfo();
        await this.loadTiles();
        if (!this.token) throw new Error("Token not provided to paint method.");

        let outlineFirst = this.settings?.outlineMode;
        let mismatchedPixels = this._getMismatchedPixels();

        if (mismatchedPixels.length === 0) {
            return 0;
        }

        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] Found ${mismatchedPixels.length} mismatched pixels.`);

        if (outlineFirst) {
            const edgePixels = mismatchedPixels.filter(p => p.isEdge);
            if (edgePixels.length > 0) {
                mismatchedPixels = edgePixels;
            }
        }

        switch (method) {
            case 'linear-reversed':
                mismatchedPixels.reverse();
                break;
            case 'linear-ltr': {
                const [startX, startY] = this.coords;
                mismatchedPixels.sort((a, b) => {
                    const aGlobalX = (a.tx - startX) * 1000 + a.px;
                    const bGlobalX = (b.tx - startX) * 1000 + b.px;
                    if (aGlobalX !== bGlobalX) return aGlobalX - bGlobalX;
                    return (a.ty - startY) * 1000 + a.py - ((b.ty - startY) * 1000 + b.py);
                });
                break;
            }
            case 'linear-rtl': {
                const [startX, startY] = this.coords;
                mismatchedPixels.sort((a, b) => {
                    const aGlobalX = (a.tx - startX) * 1000 + a.px;
                    const bGlobalX = (b.tx - startX) * 1000 + b.px;
                    if (aGlobalX !== bGlobalX) return bGlobalX - aGlobalX;
                    return (a.ty - startY) * 1000 + a.py - ((b.ty - startY) * 1000 + b.py);
                });
                break;
            }
            case 'singleColorRandom':
            case 'colorByColor': {
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
        }

        const pixelsToPaint = mismatchedPixels.slice(0, Math.floor(this.userInfo.charges.count));
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
            let purchaseMessage;
            if (productId === 80) {
                purchaseMessage = `🛒 Bought ${amount * 30} pixels for ${amount * 500} droplets`;
            } else if (productId === 70) {
                const upgradeText = amount === 1 ? "Upgrade" : "Upgrades";
                purchaseMessage = `🛒 Bought ${amount} Max Charge ${upgradeText} for ${amount * 500} droplets`;
            } else {
                purchaseMessage = `🛒 Purchase successful for product #${productId} (amount: ${amount})`;
            }
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ${purchaseMessage}`);
            return true;
        } else if (response.status === 429 || (response.data.error && response.data.error.includes("Error 1015"))) {
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