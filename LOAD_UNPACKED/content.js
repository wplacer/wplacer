// --- Constants ---
const RELOAD_FLAG = 'wplacer_reload_in_progress';

// --- Main Logic ---
console.log("✅ wplacer: Content script loaded.");

// Check if this load was triggered by our extension
if (sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.removeItem(RELOAD_FLAG);
    console.log("wplacer: Page reloaded to capture a new token.");
}

const sentTokens = new Set();
const pending = { turnstile: null, pawtect: null };

const trySendPair = () => {
    if (!pending.turnstile || !pending.pawtect) return;
    const t = pending.turnstile;
    const p = pending.pawtect || null;
    postToken(t, p);
    pending.turnstile = null;
    pending.pawtect = null;
};

// Generate a random hex fingerprint (default 32 chars)
const generateRandomHex = (length = 32) => {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
};

// Random integer in [0, max)
const randomInt = (max) => Math.floor(Math.random() * Math.max(1, Number(max) || 1));

// Create a per-load fingerprint and expose it for page usage
try {
    const fp = generateRandomHex(32);
    window.wplacerFP = fp;
    sessionStorage.setItem('wplacer_fp', fp);
    console.log('wplacer: fingerprint generated:', fp);
} catch {}

const postToken = (token, pawtectToken) => {
    if (!token || typeof token !== 'string' || sentTokens.has(token)) {
        return;
    }
    sentTokens.add(token);
    console.log(`✅ wplacer: CAPTCHA Token Captured. Sending to server.`);
    const fp = window.wplacerFP || sessionStorage.getItem('wplacer_fp') || generateRandomHex(32);
    chrome.runtime.sendMessage({
        type: "SEND_TOKEN",
        token: token,
        pawtect: pawtectToken,
        fp
    });
};

// Ask background to inject pawtect fetch hook into page (bypasses CSP)
try {
    if (!window.__wplacerPawtectRequested) {
        window.__wplacerPawtectRequested = true;
        chrome.runtime.sendMessage({ action: 'injectPawtect' });
        console.log('wplacer: requested pawtect hook injection.');
    }
} catch {}

// Auto-trigger a harmless pixel POST in page context to seed pawtect on load
try {
    if (!sessionStorage.getItem('wplacer_seeded')) {
        const fp = window.wplacerFP || sessionStorage.getItem('wplacer_fp') || generateRandomHex(32);
        const seedBody = { colors: [0], coords: [randomInt(1000), randomInt(1000)], fp, t: 'wplacer_seed' };
        chrome.runtime.sendMessage({ action: 'seedPawtect', bodyStr: JSON.stringify(seedBody) });
        sessionStorage.setItem('wplacer_seeded', '1');
    }
} catch {}

// --- Event Listeners ---

// 1. Listen for messages from the Cloudflare Turnstile iframe (primary method)
window.addEventListener('message', (event) => {
    if (event.origin !== "https://challenges.cloudflare.com" || !event.data) {
        return;
    }
    try {
        const token = event.data.token || event.data.response || event.data['cf-turnstile-response'];
        if (token) {
            pending.turnstile = token;
            // Kick off pawtect compute seeded with this turnstile token
            const fp = window.wplacerFP || sessionStorage.getItem('wplacer_fp') || generateRandomHex(32);
            const body = { colors: [0], coords: [1, 1], fp, t: token };
            try {
                chrome.runtime.sendMessage({
                    action: 'computePawtectForT',
                    url: 'https://backend.wplace.live/s0/pixel/1/1',
                    bodyStr: JSON.stringify(body)
                });
            } catch {}
            // If a pawtect token already arrived, pair immediately; otherwise, give compute a brief window
            if (window.wplacerPawtectToken) {
                pending.pawtect = window.wplacerPawtectToken;
                try { delete window.wplacerPawtectToken; } catch {}
            }
            // Only send when both are present
            trySendPair();
        }
    } catch {
        // Ignore errors from parsing message data
    }
}, true);

// 1b. Listen for pawtect helper token messages (from page context)
window.addEventListener('message', (event) => {
    try {
        if (event.source !== window) return;
        const data = event.data;
        if (data && data.type === 'WPLACER_PAWTECT_TOKEN' && typeof data.token === 'string') {
            pending.pawtect = data.token;
            window.wplacerPawtectToken = data.token;
            console.log('✅ wplacer: Pawtect token captured from', data.origin || 'unknown', 'waiting/pairing...');
            trySendPair();
        }
    } catch {}
}, true);

// 2. Listen for commands from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reloadForToken") {
        console.log("wplacer: Received reload command from background script. Reloading now...");
        sessionStorage.setItem(RELOAD_FLAG, 'true');
        location.reload();
    }
});
