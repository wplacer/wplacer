// --- Global error handler for listen EACCES ---
process.on('uncaughtException', (err) => {
    if (err && err.code === 'EACCES' && /listen/i.test(err.message)) {
        // Try to extract port from error message
        let port = '';
        const match = err.message.match(/:(\d+)/);
        if (match) port = match[1];
        console.error(`\n❌ Permission denied for port${port ? ' ' + port : ''}.\nYou do not have permission to bind to this port.${port ? ' (' + port + ')' : ''}\nPlease use a different port (e.g., 3000) or run with elevated privileges.\n`);
        process.exit(1);
    }
    throw err;
});
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { Image, createCanvas } from 'canvas';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CookieJar } from 'tough-cookie';
import gradient from 'gradient-string';
import express from 'express';
import { Impit } from 'impit';
import path from 'node:path';
import cors from 'cors';

// --- WebSocket for logs ---
import { WebSocketServer } from 'ws';
import { watch } from 'node:fs';

// ---------- Runtime constants ----------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_HOST = '0.0.0.0';
const APP_PRIMARY_PORT = Number(process.env.PORT) || 80;
const APP_FALLBACK_PORTS = [
    3000,
    5173,
    8080,
    8000,
    5000,
    7000,
    4200,
    5500,
    ...Array.from({ length: 50 }, (_, i) => 3001 + i),
];

const WPLACE_BASE = 'https://backend.wplace.live';
const WPLACE_FILES = `${WPLACE_BASE}/files/s0`;
const WPLACE_ME = `${WPLACE_BASE}/me`;
const WPLACE_PIXEL = (tx, ty) => `${WPLACE_BASE}/s0/pixel/${tx}/${ty}`;
const WPLACE_PURCHASE = `${WPLACE_BASE}/purchase`;
const TILE_URL = (tx, ty) => `${WPLACE_FILES}/tiles/${tx}/${ty}.png`;

const DATA_DIR = './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TEMPLATES_PATH = path.join(DATA_DIR, 'templates.json');

const JSON_LIMIT = '50mb';

const MS = {
    QUARTER_SEC: 250,
    TWO_SEC: 2_000,
    THIRTY_SEC: 30_000,
    TWO_MIN: 120_000,
    FIVE_MIN: 300_000,
    FORTY_SEC: 40_000,
    ONE_HOUR: 3600_000,
};

const HTTP_STATUS = {
    OK: 200,
    BAD_REQ: 400,
    UNAUTH: 401,
    FORBIDDEN: 403,
    TOO_MANY: 429,
    UNAVAILABLE_LEGAL: 451,
    SRV_ERR: 500,
    BAD_GATEWAY: 502,
    CONFLICT: 409,
};

// ---------- FS bootstrap ----------

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
// Ensure logs.log and errors.log exist
const logFiles = [
    path.join(DATA_DIR, 'logs.log'),
    path.join(DATA_DIR, 'errors.log')
];
for (const file of logFiles) {
    if (!existsSync(file)) {
        writeFileSync(file, '', { flag: 'w' });
    }
}

/** Structured logger. Errors to errors.log, info to logs.log. */
const log = async (id, name, data, error) => {
    const ts = new Date().toLocaleString();
    const who = `(${name}#${id})`;
    if (error) {
        console.error(`[${ts}] ${who} ${data}:`, error);
        appendFileSync(path.join(DATA_DIR, 'errors.log'), `[${ts}] ${who} ${data}: ${error.stack || error.message}\n`);
    } else {
        console.log(`[${ts}] ${who} ${data}`);
        appendFileSync(path.join(DATA_DIR, 'logs.log'), `[${ts}] ${who} ${data}\n`);
    }
};

// --- WebSocket broadcast helpers ---
let wsLogServer = null;
let wsClients = { logs: new Set(), errors: new Set() };

function broadcastLog(type, line) {
    for (const ws of wsClients[type]) {
        if (ws.readyState === ws.OPEN) {
            ws.send(line);
        }
    }
}

// ---------- Small utilities ----------

/** Cross-platform open-in-browser. */
function openBrowser(url) {
    const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${start} ${url}`);
}

/** Human-readable duration. */
const duration = (ms) => {
    if (ms <= 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60) % 60;
    const h = Math.floor(s / 3600);
    return [h ? `${h}h` : '', m ? `${m}m` : '', `${s % 60}s`].filter(Boolean).join(' ');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Errors ----------

class SuspensionError extends Error {
    constructor(message, durationMs) {
        super(message);
        this.name = 'SuspensionError';
        this.durationMs = durationMs;
        this.suspendedUntil = Date.now() + durationMs;
    }
}
class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NetworkError';
    }
}

// ---------- palette ----------

const palette = {
    '0,0,0': 1, '60,60,60': 2, '120,120,120': 3, '210,210,210': 4, '255,255,255': 5,
    '96,0,24': 6, '237,28,36': 7, '255,127,39': 8, '246,170,9': 9, '249,221,59': 10,
    '255,250,188': 11, '14,185,104': 12, '19,230,123': 13, '135,255,94': 14, '12,129,110': 15,
    '16,174,166': 16, '19,225,190': 17, '40,80,158': 18, '64,147,228': 19, '96,247,242': 20,
    '107,80,246': 21, '153,177,251': 22, '120,12,153': 23, '170,56,185': 24, '224,159,249': 25,
    '203,0,122': 26, '236,31,128': 27, '243,141,169': 28, '104,70,52': 29, '149,104,42': 30,
    '248,178,119': 31, '170,170,170': 32, '165,14,30': 33, '250,128,114': 34, '228,92,26': 35,
    '214,181,148': 36, '156,132,49': 37, '197,173,49': 38, '232,212,95': 39, '74,107,58': 40,
    '90,148,74': 41, '132,197,115': 42, '15,121,159': 43, '187,250,242': 44, '125,199,255': 45,
    '77,49,184': 46, '74,66,132': 47, '122,113,196': 48, '181,174,241': 49, '219,164,99': 50,
    '209,128,81': 51, '255,197,165': 52, '155,82,73': 53, '209,128,120': 54, '250,182,164': 55,
    '123,99,82': 56, '156,132,107': 57, '51,57,65': 58, '109,117,141': 59, '179,185,209': 60,
    '109,100,63': 61, '148,140,107': 62, '205,197,158': 63,
};
const VALID_COLOR_IDS = new Set([-1, 0, ...Object.values(palette)]);
const COLOR_NAMES = {
    1: 'Black', 2: 'Dark Gray', 3: 'Gray', 4: 'Light Gray', 5: 'White',
    6: 'Deep Red', 7: 'Red', 8: 'Orange', 9: 'Gold', 10: 'Yellow', 11: 'Light Yellow',
    12: 'Dark Green', 13: 'Green', 14: 'Light Green', 15: 'Dark Teal', 16: 'Teal', 17: 'Light Teal',
    18: 'Dark Blue', 19: 'Blue', 20: 'Cyan', 21: 'Indigo', 22: 'Light Indigo',
    23: 'Dark Purple', 24: 'Purple', 25: 'Light Purple', 26: 'Dark Pink', 27: 'Pink', 28: 'Light Pink',
    29: 'Dark Brown', 30: 'Brown', 31: 'Beige',
    32: '★ Medium Gray', 33: '★ Dark Red', 34: '★ Light Red', 35: '★ Dark Orange', 36: '★ Light Tan',
    37: '★ Dark Goldenrod', 38: '★ Goldenrod', 39: '★ Light Goldenrod', 40: '★ Dark Olive', 41: '★ Olive',
    42: '★ Light Olive', 43: '★ Dark Cyan', 44: '★ Light Cyan', 45: '★ Light Blue', 46: '★ Dark Indigo',
    47: '★ Dark Slate Blue', 48: '★ Slate Blue', 49: '★ Light Slate Blue', 50: '★ Light Brown', 51: '★ Dark Beige',
    52: '★ Light Beige', 53: '★ Dark Peach', 54: '★ Peach', 55: '★ Light Peach', 56: '★ Dark Tan',
    57: '★ Tan', 58: '★ Dark Slate', 59: '★ Slate', 60: '★ Light Slate', 61: '★ Dark Stone',
    62: '★ Stone', 63: '★ Light Stone'
};

// ---------- Charge prediction cache ----------

const ChargeCache = {
    _m: new Map(),
    REGEN_MS: 30_000,
    SYNC_MS: 8 * 60_000,

    _key(id) {
        return String(id);
    },
    has(id) {
        return this._m.has(this._key(id));
    },
    stale(id, now = Date.now()) {
        const u = this._m.get(this._key(id));
        if (!u) return true;
        return now - u.lastSync > this.SYNC_MS;
    },
    markFromUserInfo(userInfo, now = Date.now()) {
        if (!userInfo?.id || !userInfo?.charges) return;
        const k = this._key(userInfo.id);
        
        const count = Math.floor(userInfo.charges.count ?? 0);
        const max = Math.floor(userInfo.charges.max ?? 0);

        let sanitizedCount = count;
        if (count > max) {
            console.log(`[ChargeCache] Correcting optimistic charge count for user ${userInfo.id}. Server sent ${count}, capping to max ${max}.`);
            sanitizedCount = max;
        }
        
        this._m.set(k, { base: sanitizedCount, max, lastSync: now });
    },
    predict(id, now = Date.now()) {
        const u = this._m.get(this._key(id));
        if (!u) return null;
        const grown = Math.floor((now - u.lastSync) / this.REGEN_MS);
        const count = Math.min(u.max, u.base + Math.max(0, grown));
        return { count, max: u.max, cooldownMs: this.REGEN_MS };
    },
    consume(id, n = 1, now = Date.now()) {
        const k = this._key(id);
        const u = this._m.get(k);
        if (!u) return;
        const grown = Math.floor((now - u.lastSync) / this.REGEN_MS);
        const avail = Math.min(u.max, u.base + Math.max(0, grown));
        const newCount = Math.max(0, avail - n);
        u.base = newCount;
        // align to last regen tick
        u.lastSync = now - ((now - u.lastSync) % this.REGEN_MS);
        this._m.set(k, u);
    },
    forceResync(id, newCount = 0, now = Date.now()) {
        const k = this._key(id);
        const u = this._m.get(k) || { max: 0 }; // Get existing or create a shell
        u.base = newCount;
        u.lastSync = now; // Reset the timer from this exact moment
        this._m.set(k, u);
    },
};

// ---------- Proxy loader ----------

let loadedProxies = [];

const loadProxies = () => {
    const proxyPath = path.join(DATA_DIR, 'proxies.txt');
    if (!existsSync(proxyPath)) {
        writeFileSync(proxyPath, '');
        console.log('[SYSTEM] `data/proxies.txt` not found, created an empty one.');
        loadedProxies = [];
        return;
    }

    const raw = readFileSync(proxyPath, 'utf8');
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+#.*$|\s+\/\/.*$|^\s*#.*$|^\s*\/\/.*$/g, '').trim())
        .filter(Boolean);

    const protoMap = new Map([
        ['http', 'http'],
        ['https', 'https'],
        ['socks4', 'socks4'],
        ['socks5', 'socks5'],
    ]);

    const inRange = (p) => Number.isInteger(p) && p >= 1 && p <= 65535;
    const looksHostname = (h) => !!h && /^[a-z0-9-._[\]]+$/i.test(h);

    const parseOne = (line) => {
        // url-like: scheme://user:pass@host:port
        const urlLike = line.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/);
        if (urlLike) {
            const scheme = urlLike[1].toLowerCase();
            const protocol = protoMap.get(scheme);
            if (!protocol) return null;
            try {
                const u = new URL(line);
                const host = u.hostname;
                const port = u.port ? parseInt(u.port, 10) : NaN;
                const username = decodeURIComponent(u.username || '');
                const password = decodeURIComponent(u.password || '');
                if (!looksHostname(host) || !inRange(port)) return null;
                return { protocol, host, port, username, password };
            } catch {
                return null;
            }
        }
        // user:pass@host:port
        const authHost = line.match(/^([^:@\s]+):([^@\s]+)@(.+)$/);
        if (authHost) {
            const username = authHost[1],
                password = authHost[2],
                rest = authHost[3];
            const m6 = rest.match(/^\[([^\]]+)\]:(\d+)$/),
                m4 = rest.match(/^([^:\s]+):(\d+)$/);
            let host = '',
                port = NaN;
            if (m6) {
                host = m6[1];
                port = parseInt(m6[2], 10);
            } else if (m4) {
                host = m4[1];
                port = parseInt(m4[2], 10);
            } else return null;
            if (!looksHostname(host) || !inRange(port)) return null;
            return { protocol: 'http', host, port, username, password };
        }
        // [ipv6]:port
        const bare6 = line.match(/^\[([^\]]+)\]:(\d+)$/);
        if (bare6) {
            const host = bare6[1],
                port = parseInt(bare6[2], 10);
            if (!inRange(port)) return null;
            return { protocol: 'http', host, port, username: '', password: '' };
        }
        // host:port
        const bare = line.match(/^([^:\s]+):(\d+)$/);
        if (bare) {
            const host = bare[1],
                port = parseInt(bare[2], 10);
            if (!looksHostname(host) || !inRange(port)) return null;
            return { protocol: 'http', host, port, username: '', password: '' };
        }
        // user:pass:host:port
        const uphp = line.split(':');
        if (uphp.length === 4 && /^\d+$/.test(uphp[3])) {
            const [username, password, host, portStr] = uphp;
            const port = parseInt(portStr, 10);
            if (looksHostname(host) && inRange(port)) return { protocol: 'http', host, port, username, password };
        }
        return null;
    };

    const seen = new Set();
    const proxies = [];
    for (const line of lines) {
        const p = parseOne(line);
        if (!p) {
            console.log(`[SYSTEM] ⚠️ WARNING: Invalid proxy skipped: "${line}"`);
            continue;
        }
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
        proxy = loadedProxies[Math.floor(Math.random() * loadedProxies.length)];
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

// Get the color ordoring for a given template, or global default.
const getColorOrderForTemplate = (templateId) => {
    if (templateId && colorOrdering.templates[templateId]) {
        return colorOrdering.templates[templateId];
    }
    return colorOrdering.global;
};

// ---------- HTTP client wrapper ----------

/**
 * Minimal WPlacer client for authenticated calls.
 * Holds cookie jar, optional proxy, and Impit fetch context.
 */
class WPlacer {
    constructor({ template, coords, globalSettings, templateSettings, templateName }) {
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
        this.pawtect = null;
    }

    async _fetch(url, options) {
        try {
            // Add a default timeout and browser-like defaults to reduce CF challenges
            const defaultHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                // Referer helps some CF setups; safe default for this backend
                'Referer': 'https://wplace.live/'
            };
            const mergedHeaders = { ...(defaultHeaders), ...(options?.headers || {}) };
            const optsWithTimeout = { timeout: 30000, ...options, headers: mergedHeaders };
            return await this.browser.fetch(url, optsWithTimeout);
        } catch (error) {
            if (error.code === 'InvalidArg') {
                throw new NetworkError(`Internal fetch error (InvalidArg) for URL: ${url}. This may be a temporary network issue or a problem with a proxy.`);
            }
            // Re-throw other errors
            throw error;
        }
    }

    async login(cookies) {
        this.cookies = cookies;
        const jar = new CookieJar();
        for (const k of Object.keys(this.cookies)) {
            jar.setCookieSync(`${k}=${this.cookies[k]}; Path=/`, WPLACE_BASE);
        }
        const sleepTime = Math.floor(Math.random() * MS.TWO_SEC) + MS.QUARTER_SEC;
        await sleep(sleepTime);
        const opts = { cookieJar: jar, browser: 'chrome', ignoreTlsErrors: true };
        const proxyUrl = getNextProxy();
        if (proxyUrl) {
            opts.proxyUrl = proxyUrl;
            if (currentSettings.logProxyUsage) log('SYSTEM', 'wplacer', `Using proxy: ${proxyUrl.split('@').pop()}`);
        }
        this.browser = new Impit(opts);
        await this.loadUserInfo();
        return this.userInfo;
    }

    async switchUser(cookies) {
        this.cookies = cookies;
        const jar = new CookieJar();
        for (const k of Object.keys(this.cookies)) jar.setCookieSync(`${k}=${this.cookies[k]}; Path=/`, WPLACE_BASE);
        this.browser.cookieJar = jar;
        await this.loadUserInfo();
        return this.userInfo;
    }

    async loadUserInfo() {
        const me = await this._fetch(WPLACE_ME);
        const bodyText = await me.text();

        if (bodyText.trim().startsWith('<!DOCTYPE html>')) throw new NetworkError('Cloudflare interruption detected.');

        try {
            const userInfo = JSON.parse(bodyText);
            if (userInfo.error === 'Unauthorized')
                throw new NetworkError('(401) Unauthorized. The cookie may be invalid or the current IP/proxy is rate-limited.');
            if (userInfo.error) throw new Error(`(500) Auth failed: "${userInfo.error}".`);
            if (userInfo.id && userInfo.name) {
                const suspendedUntil = users[userInfo.id]?.suspendedUntil; // Grab suspendedUntil property from config files
                const isStillSuspended = suspendedUntil > new Date();

                // And create a new property in UserInfo
                userInfo["ban"] = {
                    status: isStillSuspended,
                    until: suspendedUntil
                };

                this.userInfo = userInfo;
                ChargeCache.markFromUserInfo(userInfo);
                return true;
            }
            throw new Error(`Unexpected /me response: ${JSON.stringify(userInfo)}`);
        } catch (e) {
            if (e instanceof NetworkError) throw e;
            if (bodyText.includes('Error 1015')) throw new NetworkError('(1015) Rate-limited.');
            if (bodyText.includes('502') && bodyText.includes('gateway')) throw new NetworkError(`(502) Bad Gateway.`);
            throw new Error(`Failed to parse server response: "${bodyText.substring(0, 150)}..."`);
        }
    }

    async post(url, body) {
        const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
        if (this.pawtect) headers['x-pawtect-token'] = this.pawtect;
        const req = await this._fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        const data = await req.json();
        return { status: req.status, data };
    }

    /*
     * Load all tiles intersecting the template bounding box into memory.
     * Converts to palette IDs for quick mismatch checks.
    */
    async loadTiles() {
        this.tiles.clear();
        const [tx, ty, px, py] = this.coords;
        const endPx = px + this.template.width;
        const endPy = py + this.template.height;
        const endTx = tx + Math.floor(endPx / 1000);
        const endTy = ty + Math.floor(endPy / 1000);

        const promises = [];
        for (let X = tx; X <= endTx; X++) {
            for (let Y = ty; Y <= endTy; Y++) {
                const p = this._fetch(`${TILE_URL(X, Y)}?t=${Date.now()}`)
                    .then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null))
                    .then((buf) => {
                        if (!buf) return null;
                        const image = new Image();
                        image.src = buf; // node-canvas accepts Buffer
                        const canvas = createCanvas(image.width, image.height);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(image, 0, 0);
                        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const tile = {
                            width: canvas.width,
                            heigh: canvas.height,
                            data: Array.from({ length: canvas.width }, () => Array(canvas.height)),
                        };
                        for (let x = 0; x < canvas.width; x++) {
                            for (let y = 0; y < canvas.height; y++) {
                                const i = (y * canvas.width + x) * 4;
                                const r = d.data[i],
                                    g = d.data[i + 1],
                                    b = d.data[i + 2],
                                    a = d.data[i + 3];
                                tile.data[x][y] = a === 255 ? palette[`${r},${g},${b}`] || 0 : 0;
                            }
                        }
                        return tile;
                    })
                    .then((tileData) => {
                        if (tileData) {
                            this.tiles.set(`${X}_${Y}`, tileData);
                        }
                    });
                promises.push(p);
            }
        }
        await Promise.all(promises);
        return true;
    }

    hasColor(id) {
        if (id < 32) return true;
        return !!(this.userInfo.extraColorsBitmap & (1 << (id - 32)));
    }

    async _executePaint(tx, ty, body) {
        if (body.colors.length === 0) return { painted: 0, success: true };
        const response = await this.post(WPLACE_PIXEL(tx, ty), body);

        // Success Case
        if (response.data.painted && response.data.painted === body.colors.length) {
            log(
                this.userInfo.id,
                this.userInfo.name,
                `[${this.templateName}] 🎨 Painted ${body.colors.length} px at ${tx},${ty}.`
            );
            // Update the in-memory tile data.
            const tile = this.tiles.get(`${tx}_${ty}`);
            if (tile) {
                for (let i = 0; i < body.colors.length; i++) {
                    const px = body.coords[i * 2];
                    const py = body.coords[i * 2 + 1];
                    const color = body.colors[i];
                    if (tile.data[px]) {
                        tile.data[px][py] = color;
                    }
                }
            }
            return { painted: response.data.painted, success: true };
        }

        if (response.data.painted === 0 && body.colors.length > 0) {
            return { painted: 0, success: false, reason: 'NO_CHARGES' };
        }

        // classify other errors
        if (response.status === HTTP_STATUS.UNAUTH && response.data.error === 'Unauthorized')
            throw new NetworkError('(401) Unauthorized during paint. The cookie may be invalid or the current IP/proxy is rate-limited.');
        if (
            response.status === HTTP_STATUS.FORBIDDEN &&
            (response.data.error === 'refresh' || response.data.error === 'Unauthorized')
        )
            throw new Error('REFRESH_TOKEN');
        if (response.status === HTTP_STATUS.UNAVAILABLE_LEGAL && response.data.suspension)
            throw new SuspensionError(`Account is suspended.`, response.data.durationMs || 0);
        if (response.status === HTTP_STATUS.SRV_ERR) {
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ⏱️ Server error (500). Wait 40s.`);
            await sleep(MS.FORTY_SEC);
            return { painted: 0, success: true }; // Treat as a temporary server issue, not a charge mismatch
        }
        if (
            response.status === HTTP_STATUS.TOO_MANY ||
            (response.data.error && response.data.error.includes('Error 1015'))
        )
            throw new NetworkError('(1015) Rate-limited.');

        throw new Error(`Unexpected response for tile ${tx},${ty}: ${JSON.stringify(response)}`);
    }

    /** Compute pixels needing change, honoring modes. */
    _getMismatchedPixels(currentSkip = 1, colorFilter = null) {
        const [startX, startY, startPx, startPy] = this.coords;
        const out = [];

        for (let y = 0; y < this.template.height; y++) {
            for (let x = 0; x < this.template.width; x++) {
                if ((x + y) % currentSkip !== 0) continue;

                const tplColor = this.template.data[x][y];
                if (colorFilter !== null && tplColor !== colorFilter) continue;

                const globalPx = startPx + x,
                    globalPy = startPy + y;

                const targetTx = startX + Math.floor(globalPx / 1000);
                const targetTy = startY + Math.floor(globalPy / 1000);
                const localPx = globalPx % 1000,
                    localPy = globalPy % 1000;

                const tile = this.tiles.get(`${targetTx}_${targetTy}`);
                if (!tile || !tile.data[localPx]) continue;

                const canvasColor = tile.data[localPx][localPy];
                const neighbors = [
                    this.template.data[x - 1]?.[y],
                    this.template.data[x + 1]?.[y],
                    this.template.data[x]?.[y - 1],
                    this.template.data[x]?.[y + 1],
                ];
                const isEdge = neighbors.some((n) => n === 0 || n === undefined);

                // erase non-template
                if (this.templateSettings.eraseMode && tplColor === 0 && canvasColor !== 0) {
                    out.push({
                        tx: targetTx,
                        ty: targetTy,
                        px: localPx,
                        py: localPy,
                        color: 0,
                        isEdge: false,
                        localX: x,
                        localY: y,
                    });
                    continue;
                }
                // treat -1 as "clear if filled"
                if (tplColor === -1 && canvasColor !== 0) {
                    out.push({
                        tx: targetTx,
                        ty: targetTy,
                        px: localPx,
                        py: localPy,
                        color: 0,
                        isEdge,
                        localX: x,
                        localY: y,
                    });
                    continue;
                }
                // positive colors
                if (tplColor > 0 && this.hasColor(tplColor)) {
                    const shouldPaint = this.templateSettings.skipPaintedPixels
                        ? canvasColor === 0
                        : tplColor !== canvasColor;
                    if (shouldPaint) {
                        out.push({
                            tx: targetTx,
                            ty: targetTy,
                            px: localPx,
                            py: localPy,
                            color: tplColor,
                            isEdge,
                            localX: x,
                            localY: y,
                        });
                    }
                }
            }
        }
        return out;
    }

    async paint(currentSkip = 1, colorFilter = null) {
        if (this.tiles.size === 0) await this.loadTiles();
        if (!this.token) throw new Error('Token not provided.');

        let mismatched = this._getMismatchedPixels(currentSkip, colorFilter);
        if (mismatched.length === 0) return 0;

        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] Found ${mismatched.length} paintable pixels.`);

        // outline
        if (this.templateSettings.outlineMode) {
            const edge = mismatched.filter((p) => p.isEdge);
            if (edge.length > 0) mismatched = edge;
        }

        // direction
        switch (this.globalSettings.drawingDirection) {
            case 'btt':
                mismatched.sort((a, b) => b.localY - a.localY);
                break;
            case 'ltr':
                mismatched.sort((a, b) => a.localX - b.localX);
                break;
            case 'rtl':
                mismatched.sort((a, b) => b.localX - a.localX);
                break;
            case 'center_out': {
                const cx = this.template.width / 2,
                    cy = this.template.height / 2;
                const d2 = (p) => (p.localX - cx) ** 2 + (p.localY - cy) ** 2;
                mismatched.sort((a, b) => d2(a) - d2(b));
                break;
            }
            case 'random': {
                for (let i = mismatched.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [mismatched[i], mismatched[j]] = [mismatched[j], mismatched[i]];
                }
                break;
            }
            case 'ttb':
            default:
                mismatched.sort((a, b) => a.localY - b.localY);
                break;
        }

        const chargesNow = Math.floor(this.userInfo?.charges?.count ?? 0);
        const todo = mismatched.slice(0, chargesNow);

        // group per tile
        const byTile = todo.reduce((acc, p) => {
            const key = `${p.tx},${p.ty}`;
            if (!acc[key]) acc[key] = { colors: [], coords: [] };
            acc[key].colors.push(p.color);
            acc[key].coords.push(p.px, p.py);
            return acc;
        }, {});

        let total = 0;
        for (const k in byTile) {
            const [tx, ty] = k.split(',').map(Number);
            const body = { ...byTile[k], t: this.token };
            if (globalThis.__wplacer_last_fp) body.fp = globalThis.__wplacer_last_fp;
            
            const r = await this._executePaint(tx, ty, body);

            if (!r.success && r.reason === 'NO_CHARGES') {
                log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ⚠️ Prediction mismatch. Server reports no charges. Resyncing cache.`);
                ChargeCache.forceResync(this.userInfo.id, 0);
                break;
            }
            
            total += r.painted;
        }

        if (this?.userInfo?.id && total > 0) ChargeCache.consume(this.userInfo.id, total);
        return total;
    }

    async buyProduct(productId, amount) {
        const res = await this.post(WPLACE_PURCHASE, { product: { id: productId, amount } });
        if (res.data.success) {
            let msg = `Purchase ok product #${productId} amount ${amount}`;
            if (productId === 80) msg = `Bought ${amount * 30} pixels for ${amount * 500} droplets`;
            else if (productId === 70) msg = `Bought ${amount} Max Charge for ${amount * 500} droplets`;
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 💰 ${msg}`);
            return true;
        }
        if (res.status === HTTP_STATUS.TOO_MANY || (res.data.error && res.data.error.includes('Error 1015')))
            throw new NetworkError('(1015) Rate-limited during purchase.');
        throw new Error(`Unexpected purchase response: ${JSON.stringify(res)}`);
    }
}

// ---------- Persistence helpers ----------

const loadJSON = (filename) =>
    existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : {};
const saveJSON = (filename, data) => writeFileSync(filename, JSON.stringify(data, null, 2));

const users = loadJSON(USERS_FILE);
const saveUsers = () => saveJSON(USERS_FILE, users);

let templates = {}; // id -> TemplateManager

// ---------- Compact template codec ----------

const Base64URL = {
    enc: (u8) => Buffer.from(u8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
};

function varintWrite(n, out) {
    n = Number(n);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error('varint invalid');
    while (n >= 0x80) {
        out.push((n & 0x7f) | 0x80);
        n >>>= 7;
    }
    out.push(n);
}
function varintRead(u8, i) {
    let n = 0,
        shift = 0,
        b;
    do {
        b = u8[i++];
        n |= (b & 0x7f) << shift;
        shift += 7;
    } while (b & 0x80);
    return [n >>> 0, i];
}
function rleEncode(a) {
    if (!a?.length) return [];
    const o = [];
    let p = a[0],
        c = 1;
    for (let i = 1; i < a.length; i++) {
        const v = a[i];
        if (v === p) c++;
        else {
            o.push([p, c]);
            p = v;
            c = 1;
        }
    }
    o.push([p, c]);
    return o;
}
function normPix(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error('pixel invalid');
    if (n === -1) return -1;
    if (n < 0 || n > 255) throw new Error('pixel out of range');
    return n >>> 0;
}
function flatten2D_XMajor(cols) {
    const w = cols.length,
        h = cols[0]?.length ?? 0;
    const flat = new Array(w * h);
    let k = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) flat[k++] = cols[x][y];
    return { flat, w, h };
}
function reshape_XMajor(flat, w, h) {
    const cols = Array.from({ length: w }, () => Array(h));
    let k = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cols[x][y] = flat[k++];
    return cols;
}
function transposeToXMajor(mat) {
    const h = mat.length,
        w = mat[0]?.length ?? 0;
    const out = Array.from({ length: w }, () => Array(h));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][y] = mat[y][x];
    return out;
}
function ensureXMajor(data, w, h) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('bad matrix');
    if (data.length === w && data[0].length === h) return data; // already x-major
    if (data.length === h && data[0].length === w) return transposeToXMajor(data); // transpose
    throw new Error(`matrix dims mismatch: got ${data.length}x${data[0].length}, want ${w}x${h}`);
}
function sanitizePalette2D(matrix) {
    for (let x = 0; x < matrix.length; x++) {
        const col = matrix[x];
        if (!Array.isArray(col)) continue;
        for (let y = 0; y < col.length; y++) if (!VALID_COLOR_IDS.has(col[y])) col[y] = 0;
    }
}
function buildShareBytes(width, height, data2D) {
    const w = Number(width) >>> 0,
        h = Number(height) >>> 0;
    if (!w || !h) throw new Error('zero dimension');
    const xmaj = ensureXMajor(data2D, w, h).map((col) => col.map(normPix));
    const { flat } = flatten2D_XMajor(xmaj);
    const runs = rleEncode(flat);
    const bytes = [];
    bytes.push(0x57, 0x54, 0x01);
    varintWrite(w, bytes);
    varintWrite(h, bytes);
    varintWrite(runs.length, bytes);
    for (const [val, cnt] of runs) {
        const vb = val === -1 ? 255 : val;
        bytes.push(vb & 0xff);
        varintWrite(cnt, bytes);
    }
    return Uint8Array.from(bytes);
}
function parseShareBytes(u8) {
    if (u8.length < 3 || u8[0] !== 0x57 || u8[1] !== 0x54 || u8[2] !== 0x01) throw new Error('bad magic/version');
    let i = 3;
    let w;
    [w, i] = varintRead(u8, i);
    let h;
    [h, i] = varintRead(u8, i);
    let rc;
    [rc, i] = varintRead(u8, i);

    const flat = [];
    for (let r = 0; r < rc; r++) {
        const raw = u8[i++];
        let cnt;
        [cnt, i] = varintRead(u8, i);
        const v = raw === 255 ? -1 : raw;
        while (cnt--) flat.push(v);
    }
    if (flat.length !== w * h) throw new Error(`size mismatch ${flat.length} != ${w * h}`);
    const data = reshape_XMajor(flat, w, h);
    sanitizePalette2D(data);
    return { width: w, height: h, data };
}
const shareCodeFromTemplate = (t) => Base64URL.enc(buildShareBytes(t.width, t.height, t.data));
const templateFromShareCode = (code) => {
    const decoded = parseShareBytes(new Uint8Array(Base64URL.dec(code)));
    sanitizePalette2D(decoded.data);
    return decoded;
};

// ---------- Template load/save ----------

function loadTemplatesFromDisk() {
    if (!existsSync(TEMPLATES_PATH)) {
        templates = {};
        return;
    }
    const raw = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf8'));
    const out = {};
    for (const id in raw) {
        const e = raw[id] || {};
        const te = e.template || {};
        let { width, height, data, shareCode } = te;

        try {
            if (!data && shareCode) {
                const dec = templateFromShareCode(shareCode);
                width = dec.width;
                height = dec.height;
                data = dec.data;
            }
            if (!width || !height || !Array.isArray(data)) throw new Error('missing data');

            out[id] = {
                ...e,
                template: {
                    width,
                    height,
                    data,
                    shareCode: shareCode || shareCodeFromTemplate({ width, height, data }),
                },
            };
        } catch (err) {
            console.error(`[templates] ⚠️ skip ${id}: ${err.message}`);
        }
    }
    templates = out;
}
loadTemplatesFromDisk();

function saveTemplatesCompressed() {
    const toSave = {};
    for (const id in templates) {
        try {
            const t = templates[id];
            const { width, height, data } = t.template;
            const shareCode = t.template.shareCode || shareCodeFromTemplate({ width, height, data });
            toSave[id] = {
                name: t.name,
                coords: t.coords,
                canBuyCharges: t.canBuyCharges,
                canBuyMaxCharges: t.canBuyMaxCharges,
                antiGriefMode: t.antiGriefMode,
                eraseMode: t.eraseMode,
                outlineMode: t.outlineMode,
                skipPaintedPixels: t.skipPaintedPixels,
                enableAutostart: t.enableAutostart,
                userIds: t.userIds,
                template: { width, height, shareCode }, // compact on disk
            };
        } catch (e) {
            console.error(`[templates] ⚠️ skip ${id}: ${e.message}`);
        }
    }
    writeFileSync(TEMPLATES_PATH, JSON.stringify(toSave, null, 2));
}
const saveTemplates = saveTemplatesCompressed;

// ---------- Settings ----------

let currentSettings = {
    accountCooldown: 20_000,
    purchaseCooldown: 5_000,
    keepAliveCooldown: MS.ONE_HOUR,
    dropletReserve: 0,
    antiGriefStandby: 600_000,
    drawingDirection: 'ttb',
    drawingOrder: 'linear',
    chargeThreshold: 0.5,
    pixelSkip: 1,
    proxyEnabled: false,
    proxyRotationMode: 'sequential', // 'sequential' | 'random'
    logProxyUsage: false,
    openBrowserOnStart: true,
};
if (existsSync(SETTINGS_FILE)) {
    currentSettings = { ...currentSettings, ...loadJSON(SETTINGS_FILE) };
    // Sanitize keepAliveCooldown to prevent issues from old/bad settings files
    if (currentSettings.keepAliveCooldown < MS.FIVE_MIN) {
        console.log(
            `[SYSTEM] WARNING: keepAliveCooldown is set to a very low value (${duration(
                currentSettings.keepAliveCooldown
            )}). Adjusting to 1 hour.`
        );
        currentSettings.keepAliveCooldown = MS.ONE_HOUR;
    }
}
const saveSettings = () => saveJSON(SETTINGS_FILE, currentSettings);

// ---------- Server state ----------

const activeBrowserUsers = new Set();
// Cache last-known user status to avoid 409s when user is briefly busy
const STATUS_CACHE_TTL = 10 * 60_000; // 10 minutes
const statusCache = new Map(); // id -> { data, ts }
const setStatusCache = (id, data) => {
    try { statusCache.set(String(id), { data, ts: Date.now() }); } catch {}
};
const getStatusCache = (id) => {
    const e = statusCache.get(String(id));
    if (!e) return null;
    if (Date.now() - e.ts > STATUS_CACHE_TTL) {
        statusCache.delete(String(id));
        return null;
    }
    return e.data;
};
const waitForNotBusy = async (id, timeoutMs = 5_000) => {
    const t0 = Date.now();
    while (activeBrowserUsers.has(id) && Date.now() - t0 < timeoutMs) {
        await sleep(200);
    }
    return !activeBrowserUsers.has(id);
};
const activeTemplateUsers = new Set();
const templateQueue = [];
let activePaintingTasks = 0;

// ---------- Token manager ----------

const TokenManager = {
    tokenQueue: [],
    tokenPromise: null,
    resolvePromise: null,
    isTokenNeeded: false,
    TOKEN_EXPIRATION_MS: MS.TWO_MIN,

    _purgeExpiredTokens() {
        const now = Date.now();
        const size0 = this.tokenQueue.length;
        this.tokenQueue = this.tokenQueue.filter((t) => now - t.receivedAt < this.TOKEN_EXPIRATION_MS);
        const removed = size0 - this.tokenQueue.length;
        if (removed > 0) log('SYSTEM', 'wplacer', `TOKEN_MANAGER: 🗑️ Discarded ${removed} expired token(s).`);
    },
    getToken(templateName = 'Unknown') {
        this._purgeExpiredTokens();
        if (this.tokenQueue.length > 0) return Promise.resolve(this.tokenQueue.shift().token);
        if (!this.tokenPromise) {
            log('SYSTEM', 'wplacer', `TOKEN_MANAGER: ⏳ Template "${templateName}" is waiting for a token.`);
            this.isTokenNeeded = true;
            this.tokenPromise = new Promise((resolve) => {
                this.resolvePromise = resolve;
            });
        }
        return this.tokenPromise;
    },
    setToken(t) {
        const newToken = { token: t, receivedAt: Date.now() };
        if (this.resolvePromise) {
            log('SYSTEM', 'wplacer', `TOKEN_MANAGER: ✅ Token received, immediately consumed by waiting task.`);
            this.resolvePromise(newToken.token);
            this.tokenPromise = null;
            this.resolvePromise = null;
            this.isTokenNeeded = false;
        } else {
            this.tokenQueue.push(newToken);
            log('SYSTEM', 'wplacer', `TOKEN_MANAGER: ✅ Token received. Queue size: ${this.tokenQueue.length}`);
        }
    },
    invalidateToken() {
        // This is now handled by the consumer (getToken), but we keep it in case of explicit invalidation needs.
        const invalidated = this.tokenQueue.shift();
        if (invalidated) {
            log('SYSTEM', 'wplacer', `TOKEN_MANAGER: 🔄 Invalidating token. ${this.tokenQueue.length} left.`);
        }
    },
};

// ---------- Error logging helper ----------

function logUserError(error, id, name, context) {
    const message = error?.message || 'Unknown error.';
    if (
        error?.name === 'NetworkError' ||
        message.includes('(500)') ||
        message.includes('(1015)') ||
        message.includes('(502)') ||
        error?.name === 'SuspensionError'
    ) {
        log(id, name, `❌ Failed to ${context}: ${message}`);
    } else {
        log(id, name, `❌ Failed to ${context}`, error);
    }
}

// ---------- TemplateManager ----------

class TemplateManager {
    constructor({
        templateId,
        name,
        templateData,
        coords,
        canBuyCharges,
        canBuyMaxCharges,
        antiGriefMode,
        eraseMode,
        outlineMode,
        skipPaintedPixels,
        enableAutostart,
        userIds,
    }) {
        this.templateId = templateId;
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
        this.status = 'Waiting to be started.';
        this.masterId = this.userIds[0];
        this.masterName = users[this.masterId]?.name || 'Unknown';
        this.sleepAbortController = null;

        this.totalPixels = this.template.data.flat().filter((p) => p !== 0).length;
        this.pixelsRemaining = this.totalPixels;
        this.currentPixelSkip = currentSettings.pixelSkip;

        this.initialRetryDelay = MS.THIRTY_SEC;
        this.maxRetryDelay = MS.FIVE_MIN;
        this.currentRetryDelay = this.initialRetryDelay;

        this.userQueue = [...this.userIds];
    }

    /* Sleep that can be interrupted when settings change. */
    cancellableSleep(ms) {
        return new Promise((resolve) => {
            const controller = new AbortController();
            this.sleepAbortController = controller;
            const timeout = setTimeout(() => {
                if (this.sleepAbortController === controller) this.sleepAbortController = null;
                resolve();
            }, ms);
            controller.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                if (this.sleepAbortController === controller) this.sleepAbortController = null;
                resolve();
            });
        });
    }
    interruptSleep() {
        if (this.sleepAbortController) {
            log('SYSTEM', 'wplacer', `[${this.name}] ⚙️ Settings changed, waking.`);
            this.sleepAbortController.abort();
        }
    }

    /* Optional purchase of max-charge upgrades. */
    async handleUpgrades(wplacer) {
        if (!this.canBuyMaxCharges) return;
        await wplacer.loadUserInfo();
        const affordableDroplets = wplacer.userInfo.droplets - currentSettings.dropletReserve;
        const amountToBuy = Math.floor(affordableDroplets / 500);
        if (amountToBuy > 0) {
            try {
                await wplacer.buyProduct(70, amountToBuy);
                await sleep(currentSettings.purchaseCooldown);
                await wplacer.loadUserInfo();
            } catch (error) {
                logUserError(error, wplacer.userInfo.id, wplacer.userInfo.name, 'purchase max charge upgrades');
            }
        }
    }

    async handleChargePurchases(wplacer) {
        if (!this.canBuyCharges) return;
        const userInfo = wplacer.userInfo;
        const affordableDroplets = userInfo.droplets - currentSettings.dropletReserve;

        if (affordableDroplets < 500) {
            return;
        }
        
        const amountToBuy = Math.floor(affordableDroplets / 500);

        if (amountToBuy > 0) {
            try {
                log(userInfo.id, userInfo.name, `[${this.name}] 💰 Attempting to buy ${amountToBuy} charge pack(s) based on available droplets...`);
                await wplacer.buyProduct(80, amountToBuy);
                await sleep(currentSettings.purchaseCooldown);
                await wplacer.loadUserInfo(); 
            } catch (error) {
                logUserError(error, userInfo.id, userInfo.name, 'purchase charges');
            }
        }
    }

    async _performPaintTurn(wplacer, colorFilter = null) {
        let paintedTotal = 0;
        let done = false;
        while (!done && this.running) {
            try {
                wplacer.token = await TokenManager.getToken(this.name);
                // Pull latest pawtect token if available
                wplacer.pawtect = globalThis.__wplacer_last_pawtect || null;
                const painted = await wplacer.paint(this.currentPixelSkip, colorFilter);
                paintedTotal += painted;
                done = true;
            } catch (error) {
                if (error.name === 'SuspensionError') {
                    const until = new Date(error.suspendedUntil).toLocaleString();
                    
                    // Difference between a BAN and a SUSPENSION of the account.
                    if (error.durationMs > 0) log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🛑 Account suspended until ${until}.`);
                    else log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🛑 Account BANNED PERMANENTLY, banned due to ${error.reason}.`)
                    
                    /*
                    
                    If a BAN has been issued, instead of setting suspendedUntil to wpalcer's suspendedUntil (current date in ms),
                    set it to a HUGE number to avoid modifying any logic in the rest of the code, and still perform properly with
                    the banned account.
                    
                    */
                    users[wplacer.userInfo.id].suspendedUntil = error.durationMs > 0 ? error.suspendedUntil : Number.MAX_SAFE_INTEGER;
                    saveUsers();
                    throw error;
                }
                if (error.message === 'REFRESH_TOKEN') {
                    log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🔄 Token expired. Next token...`);
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

    async _findWorkingUserAndCheckPixels() {
        // Iterate through all users in the queue to find one that works.
        for (let i = 0; i < this.userQueue.length; i++) {
            const userId = this.userQueue.shift();
            this.userQueue.push(userId); // Immediately cycle user to the back of the queue.

            if (!users[userId] || (users[userId].suspendedUntil && Date.now() < users[userId].suspendedUntil)) {
                continue; // Skip suspended or non-existent users.
            }

            const wplacer = new WPlacer({
                template: this.template,
                coords: this.coords,
                globalSettings: currentSettings,
                templateSettings: {
                    eraseMode: this.eraseMode,
                    outlineMode: this.outlineMode,
                    skipPaintedPixels: this.skipPaintedPixels,
                },
                templateName: this.name,
            });

            try {
                log('SYSTEM', 'wplacer', `[${this.name}] Checking template status with user ${users[userId].name}...`);
                await wplacer.login(users[userId].cookies);
                await wplacer.loadTiles();
                const mismatchedPixels = wplacer._getMismatchedPixels(1, null); // Check all pixels, no skip, no color filter.
                log('SYSTEM', 'wplacer', `[${this.name}] Check complete. Found ${mismatchedPixels.length} mismatched pixels.`);
                return { wplacer, mismatchedPixels }; // Success
            } catch (error) {
                logUserError(error, userId, users[userId].name, 'cycle pixel check');
                // This user failed, loop will continue to the next one.
            }
        }
        return null; // No working users were found in the entire queue.
    }

    async start() {
        this.running = true;
        this.status = 'Started.';
        log('SYSTEM', 'wplacer', `▶️ Starting template "${this.name}"...`);
        activePaintingTasks++;

        try {
            while (this.running) {
                this.status = 'Checking for pixels...';
                log('SYSTEM', 'wplacer', `[${this.name}] 💓 Starting new check cycle...`);

                const checkResult = await this._findWorkingUserAndCheckPixels();
                if (!checkResult) {
                    log('SYSTEM', 'wplacer', `[${this.name}] ❌ No working users found for pixel check. Retrying in 30s.`);
                    await this.cancellableSleep(30_000);
                    continue;
                }

                this.pixelsRemaining = checkResult.mismatchedPixels.length;

                if (this.pixelsRemaining === 0) {
                    if (this.antiGriefMode) {
                        this.status = 'Monitoring for changes.';
                        log('SYSTEM', 'wplacer', `[${this.name}] 🖼️ Template complete. Monitoring... Recheck in ${duration(currentSettings.antiGriefStandby)}.`);
                        await this.cancellableSleep(currentSettings.antiGriefStandby);
                        continue;
                    } else {
                        log('SYSTEM', 'wplacer', `[${this.name}] ✅ Template finished.`);
                        this.status = 'Finished.';
                        this.running = false;
                        break;
                    }
                }

                this.currentRetryDelay = this.initialRetryDelay;

                let colorsToPaint;
                const isColorMode = currentSettings.drawingOrder === 'color';
                if (isColorMode) {
                    const mismatchedColors = new Set(checkResult.mismatchedPixels.map(p => p.color));
                    const allTemplateColors = this.template.data.flat().filter(c => c > 0);
                    const colorCounts = allTemplateColors.reduce((acc, color) => ({ ...acc, [color]: (acc[color] || 0) + 1 }), {});
                    
                    const customOrder = getColorOrderForTemplate(this.templateId);
                    let sortedColors = [...new Set(allTemplateColors)];

                    if (customOrder && customOrder.length > 0) {
                        const orderMap = new Map(customOrder.map((id, index) => [id, index]));
                        sortedColors.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999));
                    } else {
                        sortedColors.sort((a, b) => (a === 1 ? -1 : b === 1 ? 1 : colorCounts[a] - colorCounts[b]));
                    }
                    
                    colorsToPaint = sortedColors.filter(c => mismatchedColors.has(c));
                    if (this.eraseMode && mismatchedColors.has(0)) {
                        colorsToPaint.push(0);
                    }
                } else {
                    colorsToPaint = [null];
                }

                let needsLongCooldown = false;

                for (const color of colorsToPaint) {
                    if (!this.running) break;

                    const passPixels = checkResult.mismatchedPixels.filter(p => color === null || p.color === color);
                    if (passPixels.length === 0) continue;

                    for (this.currentPixelSkip = currentSettings.pixelSkip; this.currentPixelSkip >= 1; this.currentPixelSkip /= 2) {
                        if (!this.running) break;
                        
                        const pixelsInThisPass = passPixels.filter(p => (p.localX + p.localY) % this.currentPixelSkip === 0);
                        if (pixelsInThisPass.length === 0) continue;

                        log('SYSTEM', 'wplacer', `[${this.name}] Starting pass (1/${this.currentPixelSkip}) for color ${isColorMode ? (COLOR_NAMES[color] || 'Erase') : 'All'}`);
                        
                        let passComplete = false;
                        while (this.running && !passComplete) {
                            if (this.userQueue.length === 0) {
                                log('SYSTEM', 'wplacer', `[${this.name}] ⏳ No valid users in queue. Waiting...`);
                                await this.cancellableSleep(5000);
                                this.userQueue = [...this.userIds];
                                continue;
                            }

                            const readyUsers = [];
                            const now = Date.now();

                            for (const userId of this.userQueue) {
                                if (!users[userId] || (users[userId].suspendedUntil && now < users[userId].suspendedUntil)) {
                                    continue;
                                }

                                if (ChargeCache.stale(userId, now)) {
                                    if (!activeBrowserUsers.has(userId)) {
                                        activeBrowserUsers.add(userId);
                                        const w = new WPlacer({});
                                        try { 
                                            const info = await w.login(users[userId].cookies);
                                            users[userId].droplets = info.droplets;
                                        } catch (e) { 
                                            logUserError(e, userId, users[userId].name, 'opportunistic resync'); 
                                        } finally { 
                                            activeBrowserUsers.delete(userId); 
                                        }
                                    }
                                }

                                const predicted = ChargeCache.predict(userId, now);
                                if (!predicted) continue;

                                const threshold = Math.max(1, Math.floor(predicted.max * currentSettings.chargeThreshold));
                                let potentialCharges = predicted.count;

                                // Factor in purchasable charges
                                if (this.canBuyCharges && users[userId].droplets) {
                                    const affordableDroplets = users[userId].droplets - currentSettings.dropletReserve;
                                    if (affordableDroplets >= 500) {
                                        const purchasable = Math.floor(affordableDroplets / 500) * 30;
                                        potentialCharges += purchasable;
                                    }
                                }
                                
                                if (potentialCharges >= threshold) {
                                    readyUsers.push({ userId, potentialCharges: Math.min(predicted.max, potentialCharges) });
                                }
                            }

                            let bestUser = null;
                            if (readyUsers.length > 0) {
                                readyUsers.sort((a, b) => b.potentialCharges - a.potentialCharges);
                                bestUser = readyUsers[0];
                            }
                            
                            if (bestUser) {
                                const { userId } = bestUser;
                                activeBrowserUsers.add(userId);
                                const wplacer = new WPlacer({ template: this.template, coords: this.coords, globalSettings: currentSettings, templateSettings: this, templateName: this.name });
                                
                                try {
                                    const userInfo = await wplacer.login(users[userId].cookies);
                                    this.status = `Running user ${userInfo.name} | Pass (1/${this.currentPixelSkip})`;

                                    await this.handleChargePurchases(wplacer);

                                    const chargesBeforePaint = wplacer.userInfo.charges;
                                    log(userInfo.id, userInfo.name, `[${this.name}] 🔋 Best user selected. Ready with charges: ${Math.floor(chargesBeforePaint.count)}/${chargesBeforePaint.max}.`);

                                    await this._performPaintTurn(wplacer, color);
                                    await this.handleUpgrades(wplacer);

                                    users[userId].droplets = wplacer.userInfo.droplets;

                                } catch (error) {
                                    if (error.name !== 'SuspensionError') logUserError(error, userId, users[userId].name, 'perform paint turn');
                                } finally {
                                    activeBrowserUsers.delete(userId);
                                    this.userQueue.push(this.userQueue.splice(this.userQueue.indexOf(userId), 1)[0]);
                                }

                                const postPaintCheck = await this._findWorkingUserAndCheckPixels();
                                if (postPaintCheck) {
                                    const remainingPassPixels = postPaintCheck.mismatchedPixels.filter(p => (color === null || p.color === color) && (p.localX + p.localY) % this.currentPixelSkip === 0);
                                    if (remainingPassPixels.length === 0) {
                                        log('SYSTEM', 'wplacer', `[${this.name}] ✅ Pass (1/${this.currentPixelSkip}) complete.`);
                                        passComplete = true;
                                    }
                                }
                                if (this.running && !passComplete && currentSettings.accountCooldown > 0) {
                                    log('SYSTEM', 'wplacer', `[${this.name}] ⏱️ Waiting for cooldown (${duration(currentSettings.accountCooldown)}).`);
                                    await this.cancellableSleep(currentSettings.accountCooldown);
                                }

                            } else {
                                const cooldowns = this.userQueue.map(id => {
                                    const p = ChargeCache.predict(id, now);
                                    if (!p || p.count >= p.max) return Infinity;
                                    const th = Math.max(1, Math.floor(p.max * currentSettings.chargeThreshold));

                                    if (p.count >= th) {
                                        return Math.max(0, (p.max - p.count)) * (p.cooldownMs ?? 30_000);
                                    }
                                    return Math.max(0, (th - p.count) * (p.cooldownMs ?? 30_000));
                                });

                                let waitTime = (cooldowns.length > 0 ? Math.min(...cooldowns) : 60_000) + 2000;
                                if (waitTime < currentSettings.accountCooldown) {
                                    log('SYSTEM', 'wplacer', `[${this.name}] ⚠️ Calculated wait time (${duration(waitTime)}) is unusually short. Defaulting to account cooldown to prevent rapid looping.`);
                                    waitTime = currentSettings.accountCooldown;
                                }

                                this.status = 'Waiting for charges.';
                                log('SYSTEM', 'wplacer', `[${this.name}] ⏳ No users ready. Waiting ~${duration(waitTime)}.`);
                                await this.cancellableSleep(waitTime);
                                log('SYSTEM', 'wplacer', `[${this.name}] 🫃 Woke up. Re-evaluating...`);
                                needsLongCooldown = true;
                                break;
                            }
                        }
                        if (needsLongCooldown) break;
                    }
                    if (needsLongCooldown) break;
                }
            }
        } finally {
            activePaintingTasks--;
            if (this.status !== 'Finished.') this.status = 'Stopped.';
            this.userIds.forEach((id) => activeTemplateUsers.delete(id));
            processQueue();
        }
    }
}


// ---------- Express setup ----------

const app = express();
app.use(cors());
app.use(express.static('public'));
app.use(express.json({ limit: JSON_LIMIT }));

// Autostart cache
const autostartedTemplates = [];

// ---------- Queue processor ----------

const processQueue = () => {
    for (let i = 0; i < templateQueue.length; i++) {
        const templateId = templateQueue[i];
        const manager = templates[templateId];
        if (!manager) {
            templateQueue.splice(i, 1);
            i--;
            continue;
        }
        const busy = manager.userIds.some((id) => activeTemplateUsers.has(id));
        if (!busy) {
            templateQueue.splice(i, 1);
            manager.userIds.forEach((id) => activeTemplateUsers.add(id));
            manager.start().catch((e) => log(templateId, manager.masterName, 'Error starting queued template', e));
            break;
        }
    }
};

// --- Color Ordering ---

// Default color order sorted by id
let defaultColorOrder = Object.values(palette).sort((a, b) => a - b);

// Store color orders - initialize from disk
let colorOrdering = loadColorOrdering();

// Extract unique colors from template data
function getColorsInTemplate(templateData) {
    if (!templateData?.data) return [];

    const uniqueColors = new Set();

    // Flatten and filter in one pass
    templateData.data.flat().forEach(colorId => {
        if (colorId > 0) uniqueColors.add(colorId);
    });

    return Array.from(uniqueColors).sort((a, b) => a - b);
}

// Load color ordering from disk
function loadColorOrdering() {
    const orderingPath = path.join(DATA_DIR, 'color_ordering.json');

    if (existsSync(orderingPath)) {
        try {
            const data = JSON.parse(readFileSync(orderingPath, 'utf8'));
            return {
                global: data.global || [...defaultColorOrder],
                templates: data.templates || {}
            };
        } catch (e) {
            console.error('Error loading color ordering:', e.message);
        }
    }

    return {
        global: [...defaultColorOrder],
        templates: {}
    };
}

// Save color ordering to disk
function saveColorOrdering() {
    const orderingPath = path.join(DATA_DIR, 'color_ordering.json');

    try {
        writeFileSync(orderingPath, JSON.stringify(colorOrdering, null, 2));
        console.log('Color ordering saved successfully');
    } catch (e) {
        console.error('Error saving color ordering:', e.message);
        throw e; // Re-throw so calling code knows it failed
    }
}

// Helper to get color order for specific context
function getColorOrder(templateId = null) {
    return templateId && colorOrdering.templates[templateId]
        ? colorOrdering.templates[templateId]
        : colorOrdering.global;
}

// Helper to set color order for specific context
function setColorOrder(order, templateId = null) {
    if (templateId) {
        colorOrdering.templates[templateId] = [...order];
    } else {
        colorOrdering.global = [...order];
    }
    saveColorOrdering();
}

const validateColorIds = (order) => {
    const validIds = new Set(Object.values(palette));
    return order.filter(id => Number.isInteger(id) && validIds.has(id));
};

// ---------- API ----------

// --- Logs API ---
import { createReadStream, statSync } from 'node:fs';

// Helper: stream file from offset
function streamLogFile(res, filePath, lastSize) {
    try {
        const stats = statSync(filePath);
        const size = stats.size;
        if (lastSize && lastSize < size) {
            // Send only new data
            const stream = createReadStream(filePath, { start: lastSize });
            stream.pipe(res);
        } else {
            // Send whole file
            const stream = createReadStream(filePath);
            stream.pipe(res);
        }
    } catch (e) {
        res.status(500).end();
    }
}

// Simple polling endpoint for logs (returns full file, or new data if client provides lastSize)
app.get('/logs', (req, res) => {
    const filePath = path.join(DATA_DIR, 'logs.log');
    const lastSize = req.query.lastSize ? parseInt(req.query.lastSize, 10) : 0;
    streamLogFile(res, filePath, lastSize);
});

app.get('/errors', (req, res) => {
    const filePath = path.join(DATA_DIR, 'errors.log');
    const lastSize = req.query.lastSize ? parseInt(req.query.lastSize, 10) : 0;
    streamLogFile(res, filePath, lastSize);
});

app.get('/token-needed', (_req, res) => res.json({ needed: TokenManager.isTokenNeeded }));
app.post('/t', (req, res) => {
    const { t, pawtect, fp } = req.body || {};
    if (!t) return res.sendStatus(HTTP_STATUS.BAD_REQ);
    // Store Turnstile token as usual
    TokenManager.setToken(t);
    // Also keep latest pawtect in memory for pairing with paints
    try {
        if (pawtect && typeof pawtect === 'string') {
            globalThis.__wplacer_last_pawtect = pawtect;
        }
        if (fp && typeof fp === 'string') {
            globalThis.__wplacer_last_fp = fp;
        }
    } catch {}
    res.sendStatus(HTTP_STATUS.OK);
});

// Users
app.get('/users', (_req, res) => res.json(users));

app.post('/user', async (req, res) => {
    if (!req.body?.cookies || !req.body.cookies.j) return res.sendStatus(HTTP_STATUS.BAD_REQ);
    const wplacer = new WPlacer({});
    try {
        const userInfo = await wplacer.login(req.body.cookies);
        let banned = users[userInfo.id]?.suspendedUntil; // Save any previous suspendedUntil property
        users[userInfo.id] = {
            name: userInfo.name,
            cookies: req.body.cookies,
            expirationDate: req.body.expirationDate,
        };

        if (banned && banned > new Date())
            users[userInfo.id].suspendedUntil = banned // Restore the suspsendedUntil property from users file if is still suspended

        saveUsers();
        res.json(userInfo);
    } catch (error) {
        logUserError(error, 'NEW_USER', 'N/A', 'add new user');
        res.status(HTTP_STATUS.SRV_ERR).json({ error: error.message });
    }
});

app.delete('/user/:id', async (req, res) => {
    const userId = req.params.id;
    if (!userId || !users[userId]) return res.sendStatus(HTTP_STATUS.BAD_REQ);

    const deletedName = users[userId].name;
    delete users[userId];
    saveUsers();
    log('SYSTEM', 'Users', `🗑️ Deleted user ${deletedName}#${userId}.`);

    let templatesModified = false;
    for (const templateId in templates) {
        const manager = templates[templateId];
        const before = manager.userIds.length;
        manager.userIds = manager.userIds.filter((id) => id !== userId);
        manager.userQueue = manager.userQueue.filter((id) => id !== userId);
        if (manager.userIds.length < before) {
            templatesModified = true;
            log('SYSTEM', 'Templates', `🗑️ Removed user ${deletedName}#${userId} from template "${manager.name}".`);
            if (manager.masterId === userId) {
                manager.masterId = manager.userIds[0] || null;
                manager.masterName = manager.masterId ? users[manager.masterId].name : null;
            }
            if (manager.userIds.length === 0 && manager.running) {
                manager.running = false;
                log('SYSTEM', 'wplacer', `[${manager.name}] 🛑 Template stopped, no users left.`);
            }
        }
    }
    if (templatesModified) saveTemplates();
    res.sendStatus(HTTP_STATUS.OK);
});

app.get('/user/status/:id', async (req, res) => {
    const { id } = req.params;
    if (!users[id]) return res.status(HTTP_STATUS.CONFLICT).json({ error: 'User not found' });

    // If busy, wait briefly; if still busy, try to return cached status
    if (activeBrowserUsers.has(id)) {
        const ok = await waitForNotBusy(id, 5_000);
        if (!ok) {
            const cached = getStatusCache(id);
            if (cached) return res.status(HTTP_STATUS.OK).json({ ...cached, cached: true });
            return res.status(HTTP_STATUS.CONFLICT).json({ error: 'User is busy' });
        }
    }

    activeBrowserUsers.add(id);
    const wplacer = new WPlacer({});
    try {
        const userInfo = await wplacer.login(users[id].cookies);
        setStatusCache(id, userInfo);
        res.status(HTTP_STATUS.OK).json(userInfo);
    } catch (error) {
        logUserError(error, id, users[id].name, 'validate cookie');
        res.status(HTTP_STATUS.SRV_ERR).json({ error: error.message });
    } finally {
        activeBrowserUsers.delete(id);
    }
});

app.post('/users/status', async (_req, res) => {
    const userIds = Object.keys(users);
    const results = {};

    const USER_TIMEOUT_MS = MS.THIRTY_SEC;
    const withTimeout = (p, ms, label) =>
        Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms))]);

    const checkUser = async (id) => {
        if (activeBrowserUsers.has(id)) {
            results[id] = { success: false, error: 'User is busy.' };
            return;
        }
        activeBrowserUsers.add(id);
        const wplacer = new WPlacer({});
        try {
            const userInfo = await wplacer.login(users[id].cookies);
            setStatusCache(id, userInfo);
            results[id] = { success: true, data: userInfo };
        } catch (error) {
            logUserError(error, id, users[id].name, 'bulk check');
            results[id] = { success: false, error: error.message };
        } finally {
            activeBrowserUsers.delete(id);
        }
    };

    for (const uid of userIds) {
        try {
            await withTimeout(checkUser(uid), USER_TIMEOUT_MS, `user ${uid}`);
        } catch (err) {
            results[uid] = { success: false, error: err.message };
        }
    }
    res.json(results);
});

// Templates
app.get('/templates', (req, res) => {
    const templateList = {};

    for (const id in templates) {
        const manager = templates[id];
        try {
            // Create a safe share code
            let shareCode;
            try {
                shareCode = manager.template.shareCode || shareCodeFromTemplate(manager.template);
            } catch (shareCodeError) {
                console.warn(`Could not generate share code for template ${id}: ${shareCodeError.message}`);
                shareCode = null; // Don't include invalid share code
            }

            templateList[id] = {
                id: id,
                name: manager.name,
                coords: manager.coords,
                canBuyCharges: manager.canBuyCharges,
                canBuyMaxCharges: manager.canBuyMaxCharges,
                antiGriefMode: manager.antiGriefMode,
                eraseMode: manager.eraseMode,
                outlineMode: manager.outlineMode,
                skipPaintedPixels: manager.skipPaintedPixels,
                enableAutostart: manager.enableAutostart,
                userIds: manager.userIds,
                running: manager.running,
                status: manager.status,
                masterId: manager.masterId,
                masterName: manager.masterName,
                totalPixels: manager.totalPixels,
                pixelsRemaining: manager.pixelsRemaining,
                currentPixelSkip: manager.currentPixelSkip,
                template: {
                    width: manager.template.width,
                    height: manager.template.height,
                    data: manager.template.data,
                    shareCode: shareCode
                }
            };
        } catch (error) {
            console.warn(`Error processing template ${id} for API response: ${error.message}`);
        }
    }

    res.json(templateList);
});

app.post('/templates/import', (req, res) => {
    const { id, name, coords, code } = req.body || {};
    if (!id || !code) return res.status(HTTP_STATUS.BAD_REQ).json({ error: 'id and code required' });
    const tmpl = templateFromShareCode(code);
    templates[id] = {
        templateId: id,
        name: name || `Template ${id}`,
        coords: coords || [0, 0],
        canBuyCharges: false,
        canBuyMaxCharges: false,
        antiGriefMode: false,
        eraseMode: false,
        outlineMode: false,
        skipPaintedPixels: false,
        enableAutostart: false,
        userIds: [],
        template: { ...tmpl, shareCode: code },
        running: false,
        status: 'idle',
        pixelsRemaining: tmpl.width * tmpl.height,
        totalPixels: tmpl.width * tmpl.height,
    };
    saveTemplatesCompressed();
    res.json({ ok: true });
});

app.post('/template', (req, res) => {
    const {
        templateName,
        template,
        coords,
        userIds,
        canBuyCharges,
        canBuyMaxCharges,
        antiGriefMode,
        eraseMode,
        outlineMode,
        skipPaintedPixels,
        enableAutostart,
    } = req.body || {};
    if (!templateName || !template || !coords || !userIds || !userIds.length)
        return res.sendStatus(HTTP_STATUS.BAD_REQ);
    if (Object.values(templates).some((t) => t.name === templateName))
        return res.status(HTTP_STATUS.CONFLICT).json({ error: 'A template with this name already exists.' });

    const templateId = Date.now().toString();
    templates[templateId] = new TemplateManager({
        templateId: templateId,
        name: templateName,
        templateData: template,
        coords,
        canBuyCharges,
        canBuyMaxCharges,
        antiGriefMode,
        eraseMode,
        outlineMode,
        skipPaintedPixels,
        enableAutostart,
        userIds,
    });
    saveTemplates();
    res.status(HTTP_STATUS.OK).json({ id: templateId });
});

app.delete('/template/:id', (req, res) => {
    const { id } = req.params;
    if (!id || !templates[id] || templates[id].running) return res.sendStatus(HTTP_STATUS.BAD_REQ);
    delete templates[id];
    saveTemplates();
    res.sendStatus(HTTP_STATUS.OK);
});

app.put('/template/edit/:id', (req, res) => {
    const { id } = req.params;
    if (!templates[id]) return res.sendStatus(HTTP_STATUS.BAD_REQ);
    const manager = templates[id];
    const {
        templateName,
        coords,
        userIds,
        canBuyCharges,
        canBuyMaxCharges,
        antiGriefMode,
        eraseMode,
        outlineMode,
        skipPaintedPixels,
        enableAutostart,
        template,
    } = req.body || {};

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
        manager.totalPixels = manager.template.data.flat().filter((p) => p > 0).length;
    }
    manager.masterId = manager.userIds[0];
    manager.masterName = users[manager.masterId].name;
    saveTemplatesCompressed();
    res.sendStatus(HTTP_STATUS.OK);
});

app.put('/template/:id', (req, res) => {
    const { id } = req.params;
    if (!id || !templates[id]) return res.sendStatus(HTTP_STATUS.BAD_REQ);
    const manager = templates[id];

    if (req.body.running && !manager.running) {
        // STARTING a template
        const busy = manager.userIds.some((uid) => activeTemplateUsers.has(uid));
        if (busy) {
            if (!templateQueue.includes(id)) {
                templateQueue.push(id);
                manager.status = 'Queued';
                log('SYSTEM', 'wplacer', `[${manager.name}] ⏳ Template queued as its users are busy.`);
            }
        } else {
            manager.userIds.forEach((uid) => activeTemplateUsers.add(uid));
            manager.start().catch((e) => log(id, manager.masterName, 'Error starting template', e));
        }
    } else if (!req.body.running && manager.running) {
        // STOPPING a template
        log('SYSTEM', 'wplacer', `[${manager.name}] 🛑 Template stopped by user.`);
        manager.running = false;
        const idx = templateQueue.indexOf(id);
        if (idx > -1) templateQueue.splice(idx, 1);

        manager.userIds.forEach((uid) => activeTemplateUsers.delete(uid));
        processQueue(); // Always process queue after stopping
    }
    res.sendStatus(HTTP_STATUS.OK);
});

// Settings
app.get('/settings', (_req, res) => res.json({ ...currentSettings, proxyCount: loadedProxies.length }));
app.put('/settings', (req, res) => {
    const prev = { ...currentSettings };
    currentSettings = { ...prev, ...req.body };
    saveSettings();
    if (prev.chargeThreshold !== currentSettings.chargeThreshold) {
        for (const id in templates) if (templates[id].running) templates[id].interruptSleep();
    }
    res.sendStatus(HTTP_STATUS.OK);
});

// Proxies
app.post('/reload-proxies', (_req, res) => {
    loadProxies();
    res.status(HTTP_STATUS.OK).json({ success: true, count: loadedProxies.length });
});

// Canvas proxy (returns data URI)
// Return raw PNG; short cache for smoother previews in the UI
app.get('/canvas', async (req, res) => {
    const { tx, ty } = req.query;
    if (isNaN(parseInt(tx)) || isNaN(parseInt(ty))) return res.sendStatus(HTTP_STATUS.BAD_REQ);
    try {
        const proxyUrl = getNextProxy();
        const imp = new Impit({ ignoreTlsErrors: true, ...(proxyUrl ? { proxyUrl } : {}) });
        const r = await imp.fetch(TILE_URL(tx, ty));
        if (!r.ok) return res.sendStatus(r.status);
        const buffer = Buffer.from(await r.arrayBuffer());
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=30');
        res.send(buffer);
    } catch (error) {
        res.status(HTTP_STATUS.SRV_ERR).json({ error: error.message });
    }
});

// Palette API for UI to stay in sync with server palette and names
// Used by the UI to sync palette on startup
app.get('/palette', (_req, res) => {
    try {
        const colors = Object.entries(palette).map(([rgb, id]) => ({
            id,
            rgb,
            name: COLOR_NAMES[id] || null,
        }));
        res.json({ colors });
    } catch (e) {
        console.warn('[palette] failed:', e?.message || e);
        res.status(HTTP_STATUS.SRV_ERR).json({ error: 'Failed to get palette' });
    }
});

// Color ordering endpoints
// Get color ordering
app.get('/color-ordering', (req, res) => {
    const { templateId } = req.query;

    if (templateId && templates[templateId]) {
        const availableColors = getColorsInTemplate(templates[templateId].template);
        const currentOrder = getColorOrder(templateId).filter(id => availableColors.includes(id));
        res.json({ order: currentOrder, availableColors, filteredByTemplate: true });
    } else {
        res.json({
            order: colorOrdering.global,
            availableColors: Object.values(palette),
            filteredByTemplate: false
        });
    }
});

// Update global color ordering
app.put('/color-ordering/global', (req, res) => {
    const validOrder = validateColorIds(req.body.order || []);

    if (!validOrder.length) {
        return res.status(400).json({ error: 'No valid color IDs provided' });
    }

    setColorOrder(validOrder);
    res.json({ success: true });
});

// Update template-specific color ordering
app.put('/color-ordering/template/:templateId', (req, res) => {
    const { templateId } = req.params;
    const template = templates[templateId];

    if (!template) {
        return res.status(400).json({ error: 'Template not found' });
    }

    const validOrder = validateColorIds(req.body.order || []);
    if (!validOrder.length) {
        return res.status(400).json({ error: 'No valid color IDs provided' });
    }

    setColorOrder(validOrder, templateId);
    log('SYSTEM', 'color-ordering', `Template "${template.name}" color order updated (${validOrder.length} colors)`);
    res.json({ success: true });
});

// Reset template color ordering
app.delete('/color-ordering/template/:templateId', (req, res) => {
    const { templateId } = req.params;

    if (colorOrdering.templates[templateId]) {
        delete colorOrdering.templates[templateId];
        saveColorOrdering();

        const templateName = templates[templateId]?.name || 'Unknown';
        log('SYSTEM', 'color-ordering', `Template "${templateName}" color order reset to global`);
    }

    res.json({ success: true });
});

// Get template colors
app.get('/template/:id/colors', (req, res) => {
    const template = templates[req.params.id];

    if (!template) {
        return res.status(400).json({ error: 'Template not found' });
    }

    const colorsInTemplate = getColorsInTemplate(template.template);
    const colorInfo = colorsInTemplate.map(colorId => ({
        id: colorId,
        name: COLOR_NAMES[colorId] || `Color ${colorId}`,
        rgb: Object.keys(palette).find(key => palette[key] === colorId) || null
    }));

    res.json({
        templateId: req.params.id,
        templateName: template.name,
        colors: colorInfo,
        totalUniqueColors: colorsInTemplate.length
    });
});

// ---------- One-time migration: old -> compressed ----------

function migrateOldTemplatesIfNeeded() {
    if (!existsSync(TEMPLATES_PATH)) return;
    let raw;
    try {
        raw = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf8'));
    } catch {
        return;
    }

    let changed = false;
    const out = {};
    for (const id in raw) {
        const e = raw[id] || {};
        const te = e.template || {};
        try {
            if (!te.data || te.shareCode) {
                out[id] = e;
                continue;
            } // already new or missing data
            const width = te.width,
                height = te.height,
                data = te.data;
            const code = shareCodeFromTemplate({ width, height, data });
            out[id] = { ...e, template: { width, height, shareCode: code } };
            changed = true;
            console.log(`[migrate] compressed template ${id} (${e.name || 'unnamed'})`);
        } catch (err) {
            console.error(`[migrate] ⚠️ skip ${id}: ${err.message}`);
            out[id] = e;
        }
    }
    if (changed) {
        writeFileSync(TEMPLATES_PATH, JSON.stringify(out, null, 2));
        console.log(`[migrate] ✅ templates.json updated to compressed format`);
    }
}

// ---------- Keep-Alive System ----------
const runKeepAlive = async () => {
    log('SYSTEM', 'KeepAlive', '🔄 Starting hourly keep-alive check...');

    const trulyActiveUserIds = new Set();
    for (const templateId in templates) {
        const manager = templates[templateId];
        if (manager.running && manager.status !== 'Monitoring for changes.') {
            manager.userIds.forEach((id) => trulyActiveUserIds.add(id));
        }
    }

    const allUserIds = Object.keys(users);
    const usersToCheck = allUserIds.filter((id) => !trulyActiveUserIds.has(id));

    if (usersToCheck.length === 0) {
        log('SYSTEM', 'KeepAlive', '✅ No idle or anti-grief users to check. All users are in active painting cycles.');
        return;
    }

    log('SYSTEM', 'KeepAlive', `Found ${usersToCheck.length} idle or anti-grief users to check out of ${allUserIds.length} total users.`);

    let successCount = 0;
    let failCount = 0;

    for (const id of usersToCheck) {
        if (users[id].suspendedUntil && Date.now() < users[id].suspendedUntil) {
            log(id, users[id].name, '🚫 Keep-alive check skipped (account suspended).');
            continue;
        }
        const wplacer = new WPlacer({});
        try {
            // The login method performs a /me request, which is what we need.
            await wplacer.login(users[id].cookies);
            log(id, users[id].name, '✔️ Keep-alive check successful.');
            successCount++;
        } catch (error) {
            logUserError(error, id, users[id].name, 'keep-alive check');
            failCount++;
        }
        await sleep(2000); // Stagger requests to avoid rate-limiting
    }

    log('SYSTEM', 'KeepAlive', `✅ Keep-alive check finished. Successful: ${successCount}, Failed: ${failCount}.`);
};

// ---------- Startup ----------
const diffVer = (v1, v2) => {
  const [a1, b1, c1] = v1.split(".").map(Number);
  const [a2, b2, c2] = v2.split(".").map(Number);
  return a1 !== a2 ? (a1 - a2) * 100 : b1 !== b2 ? (b1 - b2) * 10 : c1 - c2;
};
(async () => {
    console.clear();
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
    console.log(gradient(["#EF8F20", "#CB3D27", "#A82421"])(`                           ████
                          ▒▒███
 █████ ███ █████ ████████  ▒███   ██████    ██████   ██████  ████████
▒▒███ ▒███▒▒███ ▒▒███▒▒███ ▒███  ▒▒▒▒▒███  ███▒▒███ ███▒▒███▒▒███▒▒███
 ▒███ ▒███ ▒███  ▒███ ▒███ ▒███   ███████ ▒███ ▒▒▒ ▒███████  ▒███ ▒▒▒
 ▒▒███████████   ▒███ ▒███ ▒███  ███▒▒███ ▒███  ███▒███▒▒▒   ▒███
  ▒▒████▒████    ▒███████  █████▒▒████████▒▒██████ ▒▒██████  █████
   ▒▒▒▒ ▒▒▒▒     ▒███▒▒▒  ▒▒▒▒▒  ▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒   ▒▒▒▒▒▒  ▒▒▒▒▒
                 ▒███
                 █████
                ▒▒▒▒▒                                          v${version}`));
    // check versions (dont delete this ffs)
    try {
        const githubPackage = await fetch("https://raw.githubusercontent.com/wplacer/wplacer/refs/heads/main/package.json");
        const githubVersion = (await githubPackage.json()).version;
        const diff = diffVer(version, githubVersion);
        if (diff !== 0) console.warn(`${diff < 0 ? "⚠️ Outdated version! Please update using \"git pull\"." : "🤖 Unreleased."}\n  GitHub: ${githubVersion}\n  Local: ${version} (${diff})`);
    } catch {
        console.warn("⚠️ Could not check for updates.");
    };

    migrateOldTemplatesIfNeeded();

    // normalize template entries so memory always has {width,height,data,shareCode}
    const ensureTemplateData = (te) => {
        if (te?.data && Array.isArray(te.data)) {
            const w = Number(te.width) >>> 0,
                h = Number(te.height) >>> 0;
            if (!w || !h) throw new Error('invalid template dimensions');
            const data = ensureXMajor(te.data, w, h);
            sanitizePalette2D(data);
            return {
                width: w,
                height: h,
                data,
                shareCode: te.shareCode ?? shareCodeFromTemplate({ width: w, height: h, data }),
            };
        };
        if (te?.shareCode) {
            const dec = templateFromShareCode(te.shareCode);
            return { width: dec.width, height: dec.height, data: dec.data, shareCode: te.shareCode };
        };
        throw new Error('template missing data/shareCode');
    };

    const loadedTemplates = loadJSON(TEMPLATES_PATH);
    templates = {};

    for (const id in loadedTemplates) {
        try {
            const t = loadedTemplates[id];
            const templateData = ensureTemplateData(t.template);
            if (t.userIds.every((uid) => users[uid])) {
                templates[id] = new TemplateManager({
                    templateId: id,
                    name: t.name,
                    templateData,
                    coords: t.coords,
                    canBuyCharges: t.canBuyCharges,
                    canBuyMaxCharges: t.canBuyMaxCharges,
                    antiGriefMode: t.antiGriefMode,
                    eraseMode: t.eraseMode,
                    outlineMode: t.outlineMode,
                    skipPaintedPixels: t.skipPaintedPixels,
                    enableAutostart: t.enableAutostart,
                    userIds: t.userIds,
                });
                if (t.enableAutostart) autostartedTemplates.push(id);
            } else console.warn(`⚠️ Template "${t.name}" not loaded because assigned user(s) are missing.`);
        } catch (e) {
            console.error(`⚠️ Skipping template ${id}: ${e.message}`);
        };
    };

    //Load color ordering on startup
    colorOrdering = loadColorOrdering();

    loadProxies();
    console.log(`✅ Loaded ${Object.keys(templates).length} templates, ${Object.keys(users).length} users, ${loadedProxies.length} proxies.`);

    const probe = Array.from(new Set([APP_PRIMARY_PORT, ...APP_FALLBACK_PORTS]));
    function tryListen(idx = 0) {
        if (idx >= probe.length) {
            console.error('❌ No available port found.');
            process.exit(1);
        }
        const port = probe[idx];
        const server = app.listen(port, APP_HOST);
            // --- Attach WebSocket server for logs ---
            if (!wsLogServer) {
                wsLogServer = new WebSocketServer({ server, path: '/ws-logs' });

                wsLogServer.on('connection', (ws, req) => {
                    // URL: ws://host/ws-logs?type=logs|errors
                    const url = new URL(req.url, `http://${req.headers.host}`);
                    const type = url.searchParams.get('type') === 'errors' ? 'errors' : 'logs';
                    wsClients[type].add(ws);
                    // Send initial log history (last 200 lines)
                    try {
                        const file = path.join(DATA_DIR, type + '.log');
                        const data = readFileSync(file, 'utf8');
                        const lines = data.split(/\r?\n/).filter(Boolean);
                        ws.send(JSON.stringify({ initial: lines.slice(-200) }));
                    } catch {}
                    ws.on('close', () => wsClients[type].delete(ws));
                });

                // Watch logs.log and errors.log for changes
                const logFiles = [
                    { file: path.join(DATA_DIR, 'logs.log'), type: 'logs' },
                    { file: path.join(DATA_DIR, 'errors.log'), type: 'errors' }
                ];
                for (const { file, type } of logFiles) {
                    let lastSize = 0;
                    try { lastSize = statSync(file).size; } catch {}
                    watch(file, { persistent: false }, (event) => {
                        if (event === 'change') {
                            try {
                                const stats = statSync(file);
                                // Handle truncation/rotation
                                if (stats.size < lastSize) lastSize = 0;
                                if (stats.size > lastSize) {
                                    const start = lastSize;
                                    const endSize = stats.size;
                                    const stream = createReadStream(file, { start });
                                    let buffer = '';
                                    stream.on('data', (chunk) => { buffer += chunk.toString(); });
                                    stream.on('end', () => {
                                        buffer.split(/\r?\n/).filter(Boolean).forEach((line) => broadcastLog(type, line));
                                        lastSize = endSize;
                                    });
                                    stream.on('error', (err) => {
                                        console.warn('[logs] tail error:', err?.message || err);
                                    });
                                }
                            } catch {}
                        }
                    });
                }
            }
        server.on('listening', () => {
            const url = `http://localhost:${port}`;
            console.log(`✅ Server listening on ${url}`);
            console.log('   Open the web UI in your browser to start.');
            if (currentSettings.openBrowserOnStart) openBrowser(url);

            setInterval(runKeepAlive, currentSettings.keepAliveCooldown);
            log('SYSTEM', 'KeepAlive', `🔄 User session keep-alive started. Interval: ${duration(currentSettings.keepAliveCooldown)}.`);

            autostartedTemplates.forEach((id) => {
                const manager = templates[id];
                if (!manager) return;
                log('SYSTEM', 'wplacer', `[${manager.name}] 🚀 Autostarting template...`);
                if (manager.antiGriefMode) {
                    manager.start().catch((e) => log(id, manager.masterName, 'Error autostarting template', e));
                } else {
                    const busy = manager.userIds.some((uid) => activeTemplateUsers.has(uid));
                    if (busy) {
                        if (!templateQueue.includes(id)) {
                            templateQueue.push(id);
                            manager.status = 'Queued';
                        }
                    } else {
                        manager.userIds.forEach((uid) => activeTemplateUsers.add(uid));
                        manager.start().catch((e) => log(id, manager.masterName, 'Error autostarting template', e));
                    };
                };
            });
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${port} in use. Trying ${probe[idx + 1]}...`);
                tryListen(idx + 1);
            } else if (err.code === 'EACCES') {
                const nextIdx = Math.max(idx + 1, probe.indexOf(APP_FALLBACK_PORTS[0]));
                console.error(`❌ Permission denied on ${port}. Trying ${probe[nextIdx]}...`);
                tryListen(nextIdx);
            } else {
                console.error('❌ Server error:', err);
                process.exit(1);
            };
        });
    };
    tryListen(0);
})();
