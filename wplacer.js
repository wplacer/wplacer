import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { appendFileSync } from "node:fs";
import puppeteer from 'puppeteer-extra';
const pallete = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31, "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
const duration = (durationMs) => {
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
export const log = async (id, data, error) => {
    const timestamp = new Date().toLocaleString();
    if (error) {
        console.error(`[${timestamp}] (#${id}) ${data}:`, error);
        appendFileSync(`errors.log`, `(#${id}) [${timestamp}] ${data}: ${error.message}, ${error.stack || 'no stack trace available'}\n`);
    } else {
        console.log(`[${timestamp}] (#${id}) ${data}`);
        appendFileSync(`logs.log`, `(#${id}) [${timestamp}] ${data}\n`);
    };
};
export class WPlacer {
    constructor(template, coords, canBuyCharges) {
        const [_tx, _ty, px, py] = coords;
        if (px + (template.width - 1) >= 1000 || py + (template.height - 1) >= 1000) throw Error("No space to draw the entire template in one tile.");
        this.template = template;
        this.coords = coords;
        this.canBuyCharges = canBuyCharges;
        this.cookie = null;
        this.browser = null;
        this.me = null;
        this.userInfo = null;
        this.tile = null;
    };
    async login(cookie) {
        this.cookie = cookie;
        puppeteer.use(StealthPlugin());
        this.browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        await this.browser.setCookie({ name: 's', value: this.cookie, domain: 'backend.wplace.live' });
        await this.loadUserInfo();
        log(this.userInfo.id, `✅ Logged in as ${this.userInfo.name}!`);
        return this.userInfo;
    };
    async loadUserInfo() {
        if (!this.me) this.me = await this.browser.newPage();
        await this.me.goto('https://backend.wplace.live/me');
        await this.me.waitForSelector('body');
        this.userInfo = JSON.parse(await this.me.evaluate(() => document.querySelector('body').innerText));
        return true;
    };
    async post(url, body) {
        const response = await this.me.evaluate((url, header, body) => new Promise(async (resolve) => {
            const request = await fetch(url, {
                method: "POST",
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "text/plain;charset=UTF-8",
                    "Cookie": header,
                    "Referer": "https://wplace.live/"
                },
                body: JSON.stringify(body)
            });
            const response = await request.json();
            resolve(response);
        }), url, `s=${this.cookie}`, body);
        return response;
    };
    async loadTile() {
        const [tx, ty, _px, _py] = this.coords;
        const imageData = await this.me.evaluate((pallete, src) => new Promise((resolve) => {
            const image = new Image();
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
            image.src = src;
        }), pallete, `https://backend.wplace.live/files/s0/tiles/${tx}/${ty}.png`);
        this.tile = imageData;
        return true;
    };
    async paint() {
        await this.loadTile();
        const [tx, ty, px, py] = this.coords;
        const body = { colors: [], coords: [] };
        let pixelsUsed = 0;
        log(this.userInfo.id, "🎨 Painting...");
        for (let y = 0; y < this.template.height; y++) {
            for (let x = 0; x < this.template.width; x++) {
                if (this.template.data[x][y] === 0 || this.template.data[x][y] === this.tile.data[px + x][py + y]) continue;
                body.colors.push(this.template.data[x][y]);
                body.coords.push((px + x), (py + y))
                pixelsUsed++;
                if (pixelsUsed === Math.floor(this.userInfo.charges.count)) {
                    const response = await this.post(`https://backend.wplace.live/s0/pixel/${tx}/${ty}`, body);
                    if (response.painted && response.painted == pixelsUsed) {
                        log(this.userInfo.id, `🎨 Painted ${pixelsUsed} pixels`);
                        return pixelsUsed;
                    } else throw Error(`Unexpected response: ${JSON.stringify(response)}`);
                };
            };
        };
        if (pixelsUsed > 0) {
            const response = await this.post(`https://backend.wplace.live/s0/pixel/${tx}/${ty}`, body);
            if (response.painted && response.painted == pixelsUsed) {
                log(this.userInfo.id, `🎨 Painted ${pixelsUsed} pixels`);
                return pixelsUsed;
            } else throw Error(`Unexpected response: ${JSON.stringify(response)}`);
        };
    };
    async buyCharges(amount) {
        const response = await this.post(`https://backend.wplace.live/s0/pixel/${tx}/${ty}`, { product: { id: 80, amount: amount } });
        if (response.success) {
            log(this.userInfo.id, `🛒 Bought ${amount * 30} pixels for ${amount * 500} droplets`);
            return true;
        } else throw Error(`Unexpected response: ${JSON.stringify(response)}`);
    };
    async pixelsLeft() {
        await this.loadTile();
        let count = 0;
        const [_tx, _ty, px, py] = this.coords;
        for (let y = 0; y < this.template.height; y++) {
            for (let x = 0; x < this.template.width; x++) {
                if (this.template.data[x][y] !== 0 && this.template.data[x][y] !== this.tile.data[px + x][py + y]) count += 1;
            };
        };
        return count;
    };
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };
    async start() {
        this.running = true;
        log(this.userInfo.id, "▶️ Starting...")
        while (true) {
            if (this.running) {
                const pixelsUsed = await this.paint();
                if (pixelsUsed === this.template.ink) {
                    this.running = false;
                    log(this.userInfo.id, "🖼 Finished!");
                    break;
                } else {
                    await this.sleep(2500);
                    const pixelsLeft = await this.pixelsLeft();
                    if (pixelsLeft === 0) {
                        this.running = false;
                        log(this.userInfo.id, "🖼 Finished!");
                        break;
                    } else {
                        log(this.userInfo.id, `🛑 ${pixelsLeft} pixels left`);
                        await this.loadUserInfo();
                        if (this.canBuyCharges && this.userInfo.droplets >= 500) {
                            const maxAffordable = Math.floor(this.userInfo.droplets / 500);
                            const needed = Math.ceil(pixelsLeft / 30);
                            const amount = Math.min(maxAffordable, needed);
                            await this.buyCharges(amount);
                        } else {
                            const restartAt = Math.min(this.userInfo.charges.max, pixelsLeft);
                            const time = (restartAt - Math.floor(this.userInfo.charges.count)) * this.userInfo.charges.cooldownMs;
                            log(this.userInfo.id, `⏳ Waiting for recharge in ${duration(time)}...`);
                            await this.sleep(time);
                        };
                    };
                };
            } else {
                log(this.userInfo.id, "✖️ Stopped.")
                break;
            };
        };
        return true;
    };
};