// --- Constants ---
const POLL_ALARM_NAME = 'wplacer-poll-alarm';
const COOKIE_ALARM_NAME = 'wplacer-cookie-alarm';
const TOKEN_WAIT_THRESHOLD_MS = 30000; // 30 seconds threshold for token waiting

// --- State Variables ---
let tokenWaitStartTime = null;
let autoReloadEnabled = true;
let autoClearEnabled = true;

// --- Core Functions ---
const getSettings = async () => {
    const result = await chrome.storage.local.get(['wplacerPort', 'autoReload', 'autoClear']);
    // Update global settings
    autoReloadEnabled = result.autoReload !== undefined ? result.autoReload : true;
    autoClearEnabled = result.autoClear !== undefined ? result.autoClear : true;
    
    return {
        port: result.wplacerPort || 80,
        host: '127.0.0.1',
        autoReload: autoReloadEnabled,
        autoClear: autoClearEnabled
    };
};

const getServerUrl = async (path = '') => {
    const { host, port } = await getSettings();
    return `http://${host}:${port}${path}`;
};

// --- Token Refresh Logic ---
const pollForTokenRequest = async () => {
    console.log("wplacer: Polling server for token request...");
    try {
        // Get latest settings
        const settings = await getSettings();
        
        const url = await getServerUrl("/token-needed");
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.warn(`wplacer: Server poll failed with status: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        if (data.needed) {
            console.log("wplacer: Server requires a token.");
            
            // Start tracking token wait time if not already tracking
            if (!tokenWaitStartTime) {
                tokenWaitStartTime = Date.now();
                console.log("wplacer: Started tracking token wait time.");
                
                // Notify popup about token waiting status
                chrome.runtime.sendMessage({
                    action: "tokenStatusChanged",
                    waiting: true,
                    waitTime: 0
                }).catch(() => {});
            } else {
                // Check if we've been waiting too long for a token and auto-clear is enabled
                const waitTime = Date.now() - tokenWaitStartTime;
                const waitTimeSeconds = Math.floor(waitTime / 1000);
                
                // Update popup with current wait time
                chrome.runtime.sendMessage({
                    action: "tokenStatusChanged",
                    waiting: true,
                    waitTime: waitTimeSeconds
                }).catch(() => {});
                
                if (waitTime > TOKEN_WAIT_THRESHOLD_MS && settings.autoClear) {
                    console.log(`wplacer: Token wait time exceeded threshold (${waitTime}ms). Clearing pawtect cache before reload.`);
                    await clearPawtectCache();
                    tokenWaitStartTime = Date.now(); // Reset the timer
                }
            }
            
            // Only initiate reload if auto-reload is enabled
if (settings.autoReload) {
    console.log("wplacer: Auto-reload enabled. Initiating reload.");
    await initiateReload();
    
    // If auto-clear is also enabled and we've been waiting for a while, clear the cache
    if (settings.autoClear && (Date.now() - tokenWaitStartTime) > TOKEN_WAIT_THRESHOLD_MS / 2) {
        console.log("wplacer: Auto-clear enabled and waiting for token. Clearing cache after reload.");
        await clearPawtectCache();
    }
} else {
    console.log("wplacer: Auto-reload disabled. Skipping reload.");
}
        } else {
            // Reset token wait timer if no token is needed
            if (tokenWaitStartTime) {
                console.log("wplacer: Token no longer needed. Resetting wait timer.");
                tokenWaitStartTime = null;
                
                // Notify popup that token is no longer needed
                chrome.runtime.sendMessage({
                    action: "tokenStatusChanged",
                    waiting: false
                }).catch(() => {});
            }
        }
    } catch (error) {
        console.error("wplacer: Could not connect to the server to poll for tokens.", error.message);
    }
};

const initiateReload = async () => {
    try {
        // First notify the popup that we're reloading
        chrome.runtime.sendMessage({ 
            action: "statusUpdate", 
            status: "Reloading page..."
        }).catch(() => {});
        
        const tabs = await chrome.tabs.query({ url: "https://wplace.live/*" });
        if (tabs.length === 0) {
            console.warn("wplacer: Token requested, but no wplace.live tabs are open.");
            chrome.runtime.sendMessage({ 
                action: "statusUpdate", 
                status: "No wplace.live tabs found to reload."
            }).catch(() => {});
            return;
        }
        const targetTab = tabs.find(t => t.active) || tabs[0];
        console.log(`wplacer: Sending reload command to tab #${targetTab.id}`);
        await chrome.tabs.sendMessage(targetTab.id, { action: "reloadForToken" });
        
        // Notify popup that reload is complete
        setTimeout(() => {
            chrome.runtime.sendMessage({ 
                action: "statusUpdate", 
                status: "Page reloaded successfully."
            }).catch(() => {});
        }, 1500); // Give the page time to reload
    } catch (error) {
        // It's possible the content script isn't loaded yet, so we can try a direct reload as a fallback.
        console.error("wplacer: Error sending reload message to tab, falling back to direct reload.", error);
        const targetTab = (await chrome.tabs.query({ url: "https://wplace.live/*" }))[0];
        if (targetTab) {
            chrome.tabs.reload(targetTab.id);
            // Notify popup that reload is complete
            setTimeout(() => {
                chrome.runtime.sendMessage({ 
                    action: "statusUpdate", 
                    status: "Page reloaded successfully."
                }).catch(() => {});
            }, 1500);
        } else {
            chrome.runtime.sendMessage({ 
                action: "statusUpdate", 
                status: "No wplace.live tabs found to reload."
            }).catch(() => {});
        }
    }
};

// --- User/Cookie Management ---
const sendCookie = async (callback) => {
    const getCookie = (details) => new Promise(resolve => chrome.cookies.get(details, cookie => resolve(cookie)));

    const [jCookie, sCookie] = await Promise.all([
        getCookie({ url: "https://backend.wplace.live", name: "j" }),
        getCookie({ url: "https://backend.wplace.live", name: "s" })
    ]);

    if (!jCookie) {
        if (callback) callback({ success: false, error: "Cookie 'j' not found. Are you logged in?" });
        return;
    }

    const cookies = { j: jCookie.value };
    if (sCookie) cookies.s = sCookie.value;
    const url = await getServerUrl("/user");

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, expirationDate: jCookie.expirationDate })
        });
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
        const userInfo = await response.json();
        if (callback) callback({ success: true, name: userInfo.name });
    } catch (error) {
        if (callback) callback({ success: false, error: "Could not connect to the wplacer server." });
    }
};

const clearPawtectCache = (callback) => {
    console.log("wplacer: Clearing pawtect cache...");
    return new Promise((resolve) => {
        chrome.tabs.query({ url: "https://wplace.live/*" }, (tabs) => {
            if (tabs && tabs.length > 0) {
                let completedTabs = 0;
                tabs.forEach(tab => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        func: () => {
                            console.log("wplacer: Removing wplacerPawtectChunk from localStorage");
                            localStorage.removeItem('wplacerPawtectChunk');
                            window.__wplacerPawtectChunk = null;
                            return true;
                        }
                    }, (results) => {
                        const success = results && results[0] && results[0].result === true;
                        console.log(`wplacer: Cleared pawtect cache for tab ${tab.id}: ${success ? 'success' : 'failed'}`);
                        chrome.tabs.reload(tab.id);
                        completedTabs++;
                        if (completedTabs === tabs.length) {
                            if (callback) callback({ success: true });
                            resolve(true);
                        }
                    });
                });
            } else {
                console.log("wplacer: No wplace.live tabs found to clear pawtect cache");
                if (callback) callback({ success: false, error: "No wplace.live tabs open" });
                resolve(false);
            }
        });
    });
};

const quickLogout = (callback) => {
    const origin = "https://backend.wplace.live/";
    console.log(`wplacer: Clearing browsing data for ${origin}`);
    chrome.browsingData.remove({
        origins: [origin]
    }, {
        cache: true,
        cookies: true,
        fileSystems: true,
        indexedDB: true,
        localStorage: true,
        pluginData: true,
        serviceWorkers: true,
        webSQL: true
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("wplacer: Error clearing browsing data.", chrome.runtime.lastError);
            if (callback) callback({ success: false, error: "Failed to clear data." });
        } else {
            console.log("wplacer: Browsing data cleared successfully. Reloading wplace.live tabs.");
            chrome.tabs.query({ url: "https://wplace.live/*" }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    tabs.forEach(tab => chrome.tabs.reload(tab.id));
                }
            });
            if (callback) callback({ success: true });
        }
    });
};

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendCookie") {
        sendCookie(sendResponse);
        return true; // Required for async response
    }
    if (request.action === "clearPawtectCache") {
        clearPawtectCache(sendResponse);
        return true; // Required for async response
    }
    if (request.action === "getTokenStatus") {
        if (tokenWaitStartTime) {
            const waitTimeMs = Date.now() - tokenWaitStartTime;
            const waitTimeSec = Math.floor(waitTimeMs / 1000);
            sendResponse({ waiting: true, waitTime: waitTimeSec });
        } else {
            sendResponse({ waiting: false, waitTime: 0 });
        }
        return true;
    }
    if (request.action === "settingsUpdated") {
        // Reload settings
        getSettings().then(() => {
            console.log("wplacer: Settings updated. Auto-reload:", autoReloadEnabled, "Auto-clear:", autoClearEnabled);
            // If port changed, we need to reconnect SSE
            if (request.portChanged) {
                console.log("wplacer: Port changed. Reconnecting SSE.");
                // Any port-specific reconnection logic here
            }
            sendResponse({ success: true });
        });
        return true;
    }
    if (request.action === "injectPawtect") {
        // Inject a small page-world script to hook fetch and compute pawtect when posting to pixel endpoint
        try {
            if (sender.tab?.id) {
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    world: 'MAIN',
                    func: () => {
                        if (window.__wplacerPawtectHooked) return;
                        window.__wplacerPawtectHooked = true;

                        const backend = 'https://backend.wplace.live';
                        const resolvePawtectChunkUrl = async () => {
                            try {
                                if (window.__wplacerPawtectChunk && typeof window.__wplacerPawtectChunk === 'string') return window.__wplacerPawtectChunk;
                                const cached = localStorage.getItem('wplacerPawtectChunk');
                                if (cached) { window.__wplacerPawtectChunk = cached; return cached; }

                                const urls = new Set();
                                // script tags
                                Array.from(document.querySelectorAll('script[src]')).forEach(s => { try { urls.add(new URL(s.src, location.href).href); } catch { } });
                                // modulepreload and script links (SvelteKit)
                                Array.from(document.querySelectorAll('link[rel="modulepreload"][href], link[as="script"][href]')).forEach(l => { try { urls.add(new URL(l.href, location.href).href); } catch { } });
                                // performance entries already loaded
                                try {
                                    (performance.getEntriesByType('resource') || []).forEach(e => {
                                        if (e && typeof e.name === 'string') urls.add(e.name);
                                    });
                                } catch { }

                                const scripts = Array.from(urls).filter(src => /\/_app\/immutable\/chunks\/.*\.js(\?.*)?$/i.test(src));
                                console.log('wplacer: pawtect chunk candidates', scripts);

                                for (const src of scripts) {
                                    try {
                                        const text = await fetch(src, { credentials: 'omit' }).then(r => r.text());
                                        if (/get_pawtected_endpoint_payload|pawtect/i.test(text)) {
                                            localStorage.setItem('wplacerPawtectChunk', src);
                                            window.__wplacerPawtectChunk = src;
                                            return src;
                                        }
                                    } catch { }
                                }
                                return null;
                            } catch { return null; }
                        };
                        const importModule = async () => {
                            const discovered = await resolvePawtectChunkUrl();
                            console.log('wplacer: pawtect chunk discovered', discovered);

                            const candidates = [];
                            if (discovered) candidates.push(discovered);
                            candidates.push(new URL('/_app/immutable/chunks/BdJF80pX.js', location.origin).href);
                            candidates.push('https://wplace.live/_app/immutable/chunks/BdJF80pX.js');
                            let lastErr;
                            for (const url of candidates) {
                                try { return await import(url); } catch (e) { lastErr = e; }
                            }
                            console.warn('pawtect: module import failed', lastErr?.message || lastErr);
                            return null;
                        };

                        const computePawtect = async (url, bodyStr) => {
                            const mod = await importModule();
                            if (!mod || typeof mod._ !== 'function') return null;
                            const wasm = await mod._();
                            try {
                                const me = await fetch(`${backend}/me`, { credentials: 'include' }).then(r => r.ok ? r.json() : null);
                                if (me?.id && typeof mod.i === 'function') mod.i(me.id);
                            } catch { }
                            if (typeof mod.r === 'function') mod.r(url);
                            const enc = new TextEncoder();
                            const dec = new TextDecoder();
                            const bytes = enc.encode(bodyStr);
                            const inPtr = wasm.__wbindgen_malloc(bytes.length, 1);
                            new Uint8Array(wasm.memory.buffer, inPtr, bytes.length).set(bytes);
                            console.log('wplacer: pawtect compute start', { url, bodyLen: bodyStr.length });
                            const out = wasm.get_pawtected_endpoint_payload(inPtr, bytes.length);
                            let token;
                            if (Array.isArray(out)) {
                                const [outPtr, outLen] = out;
                                token = dec.decode(new Uint8Array(wasm.memory.buffer, outPtr, outLen));
                                try { wasm.__wbindgen_free(outPtr, outLen, 1); } catch { }
                            } else if (typeof out === 'string') {
                                token = out;
                            } else if (out && typeof out.ptr === 'number' && typeof out.len === 'number') {
                                token = dec.decode(new Uint8Array(wasm.memory.buffer, out.ptr, out.len));
                                try { wasm.__wbindgen_free(out.ptr, out.len, 1); } catch { }
                            } else {
                                console.warn('wplacer: unexpected pawtect out shape', typeof out);
                                token = null;
                            }
                            console.log('wplacer: pawtect compute done, tokenLen:', token ? token.length : 0);
                            window.postMessage({ type: 'WPLACER_PAWTECT_TOKEN', token, origin: 'pixel' }, '*');
                            return token;
                        };

                        const originalFetch = window.fetch.bind(window);
                        window.fetch = async (...args) => {
                            try {
                                const input = args[0];
                                const init = args[1] || {};
                                const req = new Request(input, init);
                                if (req.method === 'POST' && /\/s0\/pixel\//.test(req.url)) {
                                    // Prefer using init.body when it's already a string to avoid consuming streams
                                    const raw = typeof init.body === 'string' ? init.body : null;
                                    if (raw) {
                                        console.log('wplacer: hook(fetch) pixel POST detected (init.body)', req.url, 'len', raw.length);
                                        computePawtect(req.url, raw);
                                    } else {
                                        try {
                                            const clone = req.clone();
                                            const text = await clone.text();
                                            console.log('wplacer: hook(fetch) pixel POST detected (clone)', req.url, 'len', text.length);
                                            computePawtect(req.url, text);
                                        } catch { }
                                    }
                                }
                            } catch { }
                            return originalFetch(...args);
                        };
                        // Also hook XHR in case the site uses XMLHttpRequest
                        try {
                            const origOpen = XMLHttpRequest.prototype.open;
                            const origSend = XMLHttpRequest.prototype.send;
                            XMLHttpRequest.prototype.open = function (method, url) {
                                try {
                                    this.__wplacer_url = new URL(url, location.href).href;
                                    this.__wplacer_method = String(method || '');
                                } catch { }
                                return origOpen.apply(this, arguments);
                            };
                            XMLHttpRequest.prototype.send = function (body) {
                                try {
                                    if ((this.__wplacer_method || '').toUpperCase() === 'POST' && /\/s0\/pixel\//.test(this.__wplacer_url || '')) {
                                        const url = this.__wplacer_url;
                                        const maybeCompute = (raw) => { if (raw && typeof raw === 'string') computePawtect(url, raw); };
                                        if (typeof body === 'string') {
                                            console.log('wplacer: hook(XHR) pixel POST detected (string)', url, 'len', body.length);
                                            maybeCompute(body);
                                        } else if (body instanceof ArrayBuffer) {
                                            try { const s = new TextDecoder().decode(new Uint8Array(body)); console.log('wplacer: hook(XHR) pixel POST detected (ArrayBuffer)', url, 'len', s.length); maybeCompute(s); } catch { }
                                        } else if (body && typeof body === 'object' && 'buffer' in body && body.buffer instanceof ArrayBuffer) {
                                            // e.g., Uint8Array
                                            try { const s = new TextDecoder().decode(new Uint8Array(body.buffer)); console.log('wplacer: hook(XHR) pixel POST detected (TypedArray)', url, 'len', s.length); maybeCompute(s); } catch { }
                                        } else if (body && typeof body.text === 'function') {
                                            // Blob or similar
                                            try { body.text().then(s => { console.log('wplacer: hook(XHR) pixel POST detected (Blob)', url, 'len', (s || '').length); maybeCompute(s); }).catch(() => { }); } catch { }
                                        }
                                    }
                                } catch { }
                                return origSend.apply(this, arguments);
                            };
                        } catch { }
                        console.log('wplacer: pawtect fetch hook installed');
                    }
                });
            }
        } catch (e) {
            console.error('wplacer: failed to inject pawtect hook', e);
        }
        sendResponse({ ok: true });
        return true;
    }
    if (request.action === 'seedPawtect') {
        try {
            if (sender.tab?.id) {
                const bodyStr = String(request.bodyStr || '{"colors":[0],"coords":[1,1],"fp":"seed","t":"seed"}');
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    world: 'MAIN',
                    func: (rawBody) => {
                        (async () => {
                            try {
                                const backend = 'https://backend.wplace.live';
                                const url = `${backend}/s0/pixel/1/1`;
                                const resolvePawtectChunkUrl = async () => {
                                    try {
                                        if (window.__wplacerPawtectChunk && typeof window.__wplacerPawtectChunk === 'string') return window.__wplacerPawtectChunk;
                                        const cached = localStorage.getItem('wplacerPawtectChunk');
                                        if (cached) { window.__wplacerPawtectChunk = cached; return cached; }
                                        const urls = new Set();
                                        Array.from(document.querySelectorAll('script[src]')).forEach(s => { try { urls.add(new URL(s.src, location.href).href); } catch { } });
                                        Array.from(document.querySelectorAll('link[rel="modulepreload"][href], link[as="script"][href]')).forEach(l => { try { urls.add(new URL(l.href, location.href).href); } catch { } });
                                        try { (performance.getEntriesByType('resource') || []).forEach(e => { if (e && typeof e.name === 'string') urls.add(e.name); }); } catch { }
                                        const scripts = Array.from(urls).filter(src => /\/_app\/immutable\/chunks\/.*\.js(\?.*)?$/i.test(src));
                                        for (const src of scripts) {
                                            try { const text = await fetch(src, { credentials: 'omit' }).then(r => r.text()); if (/get_pawtected_endpoint_payload|pawtect/i.test(text)) { localStorage.setItem('wplacerPawtectChunk', src); window.__wplacerPawtectChunk = src; return src; } } catch { }
                                        }
                                        return null;
                                    } catch { return null; }
                                };
                                const discovered = await resolvePawtectChunkUrl();
                                const mod = discovered ? await import(discovered) : await import('/_app/immutable/chunks/BdJF80pX.js');
                                const wasm = await mod._();
                                try {
                                    const me = await fetch(`${backend}/me`, { credentials: 'include' }).then(r => r.ok ? r.json() : null);
                                    if (me?.id && typeof mod.i === 'function') mod.i(me.id);
                                } catch { }
                                if (typeof mod.r === 'function') mod.r(url);
                                const enc = new TextEncoder();
                                const dec = new TextDecoder();
                                const bytes = enc.encode(rawBody);
                                const inPtr = wasm.__wbindgen_malloc(bytes.length, 1);
                                new Uint8Array(wasm.memory.buffer, inPtr, bytes.length).set(bytes);
                                const out = wasm.get_pawtected_endpoint_payload(inPtr, bytes.length);
                                let token;
                                if (Array.isArray(out)) {
                                    const [outPtr, outLen] = out;
                                    token = dec.decode(new Uint8Array(wasm.memory.buffer, outPtr, outLen));
                                    try { wasm.__wbindgen_free(outPtr, outLen, 1); } catch { }
                                } else if (typeof out === 'string') {
                                    token = out;
                                } else if (out && typeof out.ptr === 'number' && typeof out.len === 'number') {
                                    token = dec.decode(new Uint8Array(wasm.memory.buffer, out.ptr, out.len));
                                    try { wasm.__wbindgen_free(out.ptr, out.len, 1); } catch { }
                                }
                                window.postMessage({ type: 'WPLACER_PAWTECT_TOKEN', token, origin: 'seed' }, '*');
                            } catch { }
                        })();
                    },
                    args: [bodyStr]
                });
            }
        } catch { }
        sendResponse({ ok: true });
        return true;
    }
    if (request.action === 'computePawtectForT') {
        try {
            if (sender.tab?.id) {
                const turnstile = typeof request.bodyStr === 'string' ? (() => { try { return JSON.parse(request.bodyStr).t || ''; } catch { return ''; } })() : '';
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    world: 'MAIN',
                    func: (tValue) => {
                        (async () => {
                            try {
                                const backend = 'https://backend.wplace.live';
                                const resolvePawtectChunkUrl = async () => {
                                    try {
                                        if (window.__wplacerPawtectChunk && typeof window.__wplacerPawtectChunk === 'string') return window.__wplacerPawtectChunk;
                                        const cached = localStorage.getItem('wplacerPawtectChunk');
                                        if (cached) { window.__wplacerPawtectChunk = cached; return cached; }
                                        const urls = new Set();
                                        Array.from(document.querySelectorAll('script[src]')).forEach(s => { try { urls.add(new URL(s.src, location.href).href); } catch { } });
                                        Array.from(document.querySelectorAll('link[rel="modulepreload"][href], link[as="script"][href]')).forEach(l => { try { urls.add(new URL(l.href, location.href).href); } catch { } });
                                        try { (performance.getEntriesByType('resource') || []).forEach(e => { if (e && typeof e.name === 'string') urls.add(e.name); }); } catch { }
                                        const scripts = Array.from(urls).filter(src => /\/_app\/immutable\/chunks\/.*\.js(\?.*)?$/i.test(src));
                                        for (const src of scripts) {
                                            try { const text = await fetch(src, { credentials: 'omit' }).then(r => r.text()); if (/get_pawtected_endpoint_payload|pawtect/i.test(text)) { localStorage.setItem('wplacerPawtectChunk', src); window.__wplacerPawtectChunk = src; return src; } } catch { }
                                        }
                                        return null;
                                    } catch { return null; }
                                };
                                const discovered = await resolvePawtectChunkUrl();
                                const mod = discovered ? await import(discovered) : await import('/_app/immutable/chunks/BdJF80pX.js');
                                const wasm = await mod._();
                                try {
                                    const me = await fetch(`${backend}/me`, { credentials: 'include' }).then(r => r.ok ? r.json() : null);
                                    if (me?.id && typeof mod.i === 'function') mod.i(me.id);
                                } catch { }
                                // Randomize pixel tile minimally (fixed 1/1) and coords for simplicity
                                const url = `${backend}/s0/pixel/1/1`;
                                if (typeof mod.r === 'function') mod.r(url);
                                const fp = (window.wplacerFP && String(window.wplacerFP)) || (() => {
                                    const b = new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
                                })();
                                const rx = Math.floor(Math.random() * 1000);
                                const ry = Math.floor(Math.random() * 1000);
                                const bodyObj = { colors: [0], coords: [rx, ry], fp, t: String(tValue || '') };
                                const rawBody = JSON.stringify(bodyObj);
                                const enc = new TextEncoder();
                                const dec = new TextDecoder();
                                const bytes = enc.encode(rawBody);
                                const inPtr = wasm.__wbindgen_malloc(bytes.length, 1);
                                new Uint8Array(wasm.memory.buffer, inPtr, bytes.length).set(bytes);
                                const out = wasm.get_pawtected_endpoint_payload(inPtr, bytes.length);
                                let token;
                                if (Array.isArray(out)) {
                                    const [outPtr, outLen] = out;
                                    token = dec.decode(new Uint8Array(wasm.memory.buffer, outPtr, outLen));
                                    try { wasm.__wbindgen_free(outPtr, outLen, 1); } catch { }
                                } else if (typeof out === 'string') {
                                    token = out;
                                } else if (out && typeof out.ptr === 'number' && typeof out.len === 'number') {
                                    token = dec.decode(new Uint8Array(wasm.memory.buffer, out.ptr, out.len));
                                    try { wasm.__wbindgen_free(out.ptr, out.len, 1); } catch { }
                                }
                                window.postMessage({ type: 'WPLACER_PAWTECT_TOKEN', token, origin: 'simple' }, '*');
                            } catch { }
                        })();
                    },
                    args: [turnstile]
                });
            }
        } catch { }
        sendResponse({ ok: true });
        return true;
    }
    if (request.action === "quickLogout") {
        quickLogout(sendResponse);
        return true; // Required for async response
    }
    if (request.type === "SEND_TOKEN") {
        // Reset token wait timer when a token is successfully sent
        if (tokenWaitStartTime) {
            console.log("wplacer: Token received. Resetting wait timer.");
            tokenWaitStartTime = null;
        }
        
        getServerUrl("/t").then(url => {
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    t: request.token,
                    pawtect: request.pawtect || null,
                    fp: request.fp || null,
                    colors: request.colors || null // Add support for color ordering
                })
            });
        });
    }
    return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith("https://wplace.live")) {
        console.log("wplacer: wplace.live tab loaded. Sending cookie.");
        sendCookie(response => console.log(`wplacer: Cookie send status: ${response.success ? 'Success' : 'Failed'}`));
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === COOKIE_ALARM_NAME) {
        console.log("wplacer: Periodic alarm triggered. Sending cookie.");
        sendCookie(response => console.log(`wplacer: Periodic cookie refresh: ${response.success ? 'Success' : 'Failed'}`));
    } else if (alarm.name === POLL_ALARM_NAME) {
        pollForTokenRequest();
    }
});

// --- Initialization ---
const initializeAlarms = () => {
    // Poll for token requests every 45 seconds. This is the main keep-alive for the service worker.
    chrome.alarms.create(POLL_ALARM_NAME, {
        delayInMinutes: 0.1,
        periodInMinutes: 0.75 // 45 seconds
    });
    // Refresh cookies less frequently.
    chrome.alarms.create(COOKIE_ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: 20
    });
    console.log("wplacer: Alarms initialized.");
};

chrome.runtime.onStartup.addListener(() => {
    console.log("wplacer: Browser startup.");
    initializeAlarms();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("wplacer: Extension installed/updated.");
    initializeAlarms();
});
