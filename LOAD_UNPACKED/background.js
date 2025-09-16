// --- Constants ---
const TOKEN_WAIT_THRESHOLD_MS = 30000; // 30 seconds threshold for token waiting
const POLL_ALARM_NAME = 'wplacer-poll';
const COOKIE_ALARM_NAME = 'wplacer-cookie';
const POLL_INTERVAL_MS = 30000; // 30 seconds for more responsive polling

// --- State Variables ---
let tokenWaitStartTime = null;
let autoReloadEnabled = true;
let autoClearEnabled = true;
let isReloading = false; // Prevent multiple simultaneous reloads

// --- Core Functions ---
const getSettings = async () => {
    const result = await chrome.storage.local.get(['wplacerPort', 'autoReload', 'autoClear']);
    // Update global settings
    autoReloadEnabled = result.autoReload !== undefined ? result.autoReload : true;
    autoClearEnabled = result.autoClear !== undefined ? result.autoClear : true;
    
    console.log("wplacer: Settings loaded - Auto-reload:", autoReloadEnabled, "Auto-clear:", autoClearEnabled);
    
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
        console.log("wplacer: Server response:", data);
        
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
                
                // Immediately initiate reload if auto-reload is enabled
                if (settings.autoReload && !isReloading) {
                    console.log("wplacer: Token requested by server. Auto-reload enabled. Initiating immediate reload.");
                    await initiateReload();
                }
            } else {
                // Check if we've been waiting too long for a token
                const waitTime = Date.now() - tokenWaitStartTime;
                const waitTimeSeconds = Math.floor(waitTime / 1000);
                
                console.log(`wplacer: Token still needed. Wait time: ${waitTimeSeconds}s`);
                
                // Update popup with current wait time
                chrome.runtime.sendMessage({
                    action: "tokenStatusChanged",
                    waiting: true,
                    waitTime: waitTimeSeconds
                }).catch(() => {});
                
                // Clear cache if we've been waiting too long and auto-clear is enabled
                if (waitTime > TOKEN_WAIT_THRESHOLD_MS && settings.autoClear) {
                    console.log(`wplacer: Token wait time exceeded threshold (${waitTime}ms). Clearing pawtect cache.`);
                    await clearPawtectCache();
                    tokenWaitStartTime = Date.now(); // Reset the timer
                }
                
                // Don't reload again immediately if we just reloaded
                // Instead, wait for the next polling cycle
            }
        } else {
            // Reset token wait timer if no token is needed
            if (tokenWaitStartTime) {
                console.log("wplacer: Token no longer needed. Resetting wait timer.");
                tokenWaitStartTime = null;
                isReloading = false; // Reset reload flag
                
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
    if (isReloading) {
        console.log("wplacer: Reload already in progress, skipping.");
        return;
    }
    
    isReloading = true;
    
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
        console.log(`wplacer: Attempting to reload tab #${targetTab.id}`);
        
        try {
            // Try to send message to content script first
            await chrome.tabs.sendMessage(targetTab.id, { action: "reloadForToken" });
            console.log("wplacer: Reload message sent to content script successfully.");
        } catch (error) {
            // Content script not loaded, use direct reload
            console.log("wplacer: Content script not available, using direct reload.");
            await chrome.tabs.reload(targetTab.id);
        }
        
        // Notify popup that reload is complete
        setTimeout(() => {
            chrome.runtime.sendMessage({ 
                action: "statusUpdate", 
                status: "Page reloaded successfully."
            }).catch(() => {});
            isReloading = false; // Reset reload flag after delay
        }, 3000); // Give more time for page to reload
        
    } catch (error) {
        console.error("wplacer: Error during reload:", error);
        chrome.runtime.sendMessage({ 
            action: "statusUpdate", 
            status: "Reload failed: " + error.message
        }).catch(() => {});
        isReloading = false;
    }
};

// --- Improved Polling with setInterval instead of alarms ---
let pollInterval = null;

const startPolling = () => {
    // Clear any existing interval
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    
    // Start immediate poll
    pollForTokenRequest();
    
    // Set up regular polling
    pollInterval = setInterval(() => {
        pollForTokenRequest();
    }, POLL_INTERVAL_MS);
    
    console.log(`wplacer: Started polling every ${POLL_INTERVAL_MS}ms`);
};

const stopPolling = () => {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log("wplacer: Stopped polling");
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
                            console.log("wplacer: Removing cached pawtect data from localStorage");
                            // Use consistent cache key name
                            localStorage.removeItem('wplacer_pawtect_path');
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

// --- Token Handling ---
const handleTokenPair = async (turnstileToken, pawtectToken, fp, colors, sendResponse) => {
    try {
        // Reset token wait timer when a token pair is successfully received
        if (tokenWaitStartTime) {
            console.log("wplacer: Token pair received. Resetting wait timer.");
            tokenWaitStartTime = null;
        }

        // Send token pair to server
        const url = await getServerUrl("/t");
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                t: turnstileToken,
                pawtect: pawtectToken,
                fp: fp || null,
                colors: colors || null
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        console.log("wplacer: Token pair sent successfully.", data);
        
        if (sendResponse) {
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error("wplacer: Error sending token pair:", error);
        if (sendResponse) {
            sendResponse({ success: false, error: error.message });
        }
    }
};

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("wplacer: Received message:", request);
    
    // Add debug logging for settings
    if (request.action === "getSettings") {
        getSettings().then(settings => {
            console.log("wplacer: Current settings:", settings);
            sendResponse(settings);
        });
        return true;
    }

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
        // Reload settings and restart polling if needed
        getSettings().then(() => {
            console.log("wplacer: Settings updated. Auto-reload:", autoReloadEnabled, "Auto-clear:", autoClearEnabled);
            
            // Restart polling to apply new settings
            startPolling();
            
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
                        
                        // Use consistent cache key from old version for compatibility
                        const CACHE_KEY = 'wplacerPawtectChunk';

                        // Optimized URL resolution - prioritize cached path, but with fallbacks
                        const getOptimizedPawtectUrl = () => {
                            // Check cached path first (from old version key)
                            const cached = localStorage.getItem(CACHE_KEY);
                            if (cached) {
                                console.log('wplacer: Using cached pawtect path:', cached);
                                window.__wplacerPawtectChunk = cached;
                                return cached;
                            }
                            
                            // Check global variable as secondary cache
                            if (window.__wplacerPawtectChunk && typeof window.__wplacerPawtectChunk === 'string') {
                                return window.__wplacerPawtectChunk;
                            }
                            
                            return null;
                        };

                        // Improved discovery that combines old reliability with new optimizations
                        const discoverPawtectChunk = async () => {
                            try {
                                console.log('wplacer: Starting chunk discovery...');
                                
                                const urls = new Set();
                                
                                // Collect URLs from multiple sources (keeping new optimization)
                                Array.from(document.querySelectorAll('script[src]')).forEach(s => {
                                    try { 
                                        urls.add(new URL(s.src, location.href).href); 
                                    } catch { }
                                });
                                
                                Array.from(document.querySelectorAll('link[rel="modulepreload"][href], link[as="script"][href]')).forEach(l => {
                                    try { 
                                        urls.add(new URL(l.href, location.href).href); 
                                    } catch { }
                                });
                                
                                // Add performance entries for already loaded resources
                                try {
                                    performance.getEntriesByType('resource').forEach(entry => {
                                        if (entry?.name) urls.add(entry.name);
                                    });
                                } catch { }
                                
                                // Filter to chunk candidates - be more permissive than new version
                                const chunkCandidates = Array.from(urls).filter(src => 
                                    // Keep original pattern but also include broader matches
                                    /\/_app\/immutable\/chunks\/.*\.js(\?.*)?$/i.test(src) ||
                                    /\/chunks\/.*\.js(\?.*)?$/i.test(src)
                                );
                                
                                console.log(`wplacer: Found ${chunkCandidates.length} chunk candidates`);
                                
                                // Use old version's more reliable content detection
                                for (const url of chunkCandidates) {
                                    try {
                                        const response = await fetch(url, { 
                                            credentials: 'omit',
                                            cache: 'force-cache'
                                        });
                                        
                                        if (!response.ok) continue;
                                        
                                        const text = await response.text();
                                        
                                        // Use old version's simpler but more reliable pattern
                                        if (/get_pawtected_endpoint_payload|pawtect/i.test(text)) {
                                            console.log(`wplacer: Found pawtect chunk: ${url}`);
                                            
                                            // Cache using old version's key
                                            localStorage.setItem(CACHE_KEY, url);
                                            window.__wplacerPawtectChunk = url;
                                            
                                            return url;
                                        }
                                    } catch (error) {
                                        console.warn(`wplacer: Failed to check ${url}:`, error.message);
                                    }
                                }
                                
                                console.warn('wplacer: No pawtect chunk found via discovery');
                                return null;
                                
                            } catch (error) {
                                console.error('wplacer: Chunk discovery failed:', error);
                                return null;
                            }
                        };

                        // Simplified import with better error handling
                        const importModule = async () => {
                            // Fast path: try cached URL first
                            const cachedUrl = getOptimizedPawtectUrl();
                            
                            if (cachedUrl) {
                                try { 
                                    console.log('wplacer: Trying cached path:', cachedUrl);
                                    return await import(cachedUrl); 
                                } catch (e) { 
                                    console.warn('wplacer: Cached path failed:', cachedUrl, e.message);
                                    // Clear bad cache
                                    localStorage.removeItem(CACHE_KEY);
                                    window.__wplacerPawtectChunk = null;
                                }
                            }
                            
                            console.log('wplacer: Cached path failed, starting discovery...');
                            
                            // Discovery path: find the actual chunk
                            const discoveredUrl = await discoverPawtectChunk();
                            
                            if (discoveredUrl) {
                                try {
                                    console.log('wplacer: Trying discovered URL:', discoveredUrl);
                                    return await import(discoveredUrl);
                                } catch (error) {
                                    console.error('wplacer: Discovered URL failed:', error);
                                }
                            }
                            
                            // Final fallback: try some common patterns
                            const fallbackCandidates = [
                                new URL('/_app/immutable/chunks/BdJF80pX.js', location.origin).href,
                                'https://wplace.live/_app/immutable/chunks/BdJF80pX.js'
                            ];
                            
                            for (const url of fallbackCandidates) {
                                try {
                                    console.log('wplacer: Trying fallback:', url);
                                    return await import(url);
                                } catch (e) {
                                    console.warn('wplacer: Fallback failed:', url, e.message);
                                }
                            }
                            
                            console.error('wplacer: All import attempts failed');
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
                                const CACHE_KEY = 'wplacerPawtectChunk';
                                
                                // Simplified module import with old version reliability
                                const importPawtectModule = async () => {
                                    // Try cached path first
                                    const cached = localStorage.getItem(CACHE_KEY);
                                    if (cached) {
                                        try {
                                            console.log('wplacer: seedPawtect using cached:', cached);
                                            return await import(cached);
                                        } catch (e) {
                                            console.warn('wplacer: seedPawtect cached failed:', e.message);
                                            localStorage.removeItem(CACHE_KEY);
                                        }
                                    }
                                    
                                    // Discovery fallback using old version's simple logic
                                    const urls = new Set();
                                    Array.from(document.querySelectorAll('script[src]')).forEach(s => {
                                        try { urls.add(new URL(s.src, location.href).href); } catch { }
                                    });
                                    Array.from(document.querySelectorAll('link[rel="modulepreload"][href], link[as="script"][href]')).forEach(l => {
                                        try { urls.add(new URL(l.href, location.href).href); } catch { }
                                    });
                                    try {
                                        performance.getEntriesByType('resource').forEach(e => {
                                            if (e?.name) urls.add(e.name);
                                        });
                                    } catch { }
                                    
                                    const scripts = Array.from(urls).filter(src => 
                                        /\/_app\/immutable\/chunks\/.*\.js(\?.*)?$/i.test(src) ||
                                        /\/chunks\/.*\.js(\?.*)?$/i.test(src)
                                    );
                                    
                                    for (const src of scripts) {
                                        try {
                                            const text = await fetch(src, { credentials: 'omit' }).then(r => r.text());
                                            if (/get_pawtected_endpoint_payload|pawtect/i.test(text)) {
                                                localStorage.setItem(CACHE_KEY, src);
                                                console.log('wplacer: seedPawtect discovered:', src);
                                                return await import(src);
                                            }
                                        } catch { }
                                    }
                                    
                                    // Final fallbacks
                                    const fallbacks = [
                                        new URL('/_app/immutable/chunks/BdJF80pX.js', location.origin).href,
                                        'https://wplace.live/_app/immutable/chunks/BdJF80pX.js'
                                    ];
                                    for (const url of fallbacks) {
                                        try { return await import(url); } catch { }
                                    }
                                    return null;
                                };
                                
                                const mod = await importPawtectModule();
                                if (!mod) throw new Error('Could not import pawtect module');
                                
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
                            } catch (e) {
                                console.error('wplacer: seedPawtect failed:', e);
                            }
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
                const turnstile = typeof request.bodyStr === 'string' ? (() => { 
                    try { return JSON.parse(request.bodyStr).t || ''; } catch { return ''; } 
                })() : '';
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    world: 'MAIN',
                    func: (tValue) => {
                        (async () => {
                            try {
                                const backend = 'https://backend.wplace.live';
                                const CACHE_KEY = 'wplacerPawtectChunk';
                                
                                // Same simplified import logic
                                const importPawtectModule = async () => {
                                    // Try cached path first
                                    const cached = localStorage.getItem(CACHE_KEY);
                                    if (cached) {
                                        try {
                                            console.log('wplacer: computePawtectForT using cached:', cached);
                                            return await import(cached);
                                        } catch (e) {
                                            console.warn('wplacer: computePawtectForT cached failed:', e.message);
                                            localStorage.removeItem(CACHE_KEY);
                                        }
                                    }
                                    
                                    // Discovery fallback
                                    const urls = new Set();
                                    Array.from(document.querySelectorAll('script[src]')).forEach(s => {
                                        try { urls.add(new URL(s.src, location.href).href); } catch { }
                                    });
                                    Array.from(document.querySelectorAll('link[rel="modulepreload"][href], link[as="script"][href]')).forEach(l => {
                                        try { urls.add(new URL(l.href, location.href).href); } catch { }
                                    });
                                    try {
                                        performance.getEntriesByType('resource').forEach(e => {
                                            if (e?.name) urls.add(e.name);
                                        });
                                    } catch { }
                                    
                                    const scripts = Array.from(urls).filter(src => 
                                        /\/_app\/immutable\/chunks\/.*\.js(\?.*)?$/i.test(src) ||
                                        /\/chunks\/.*\.js(\?.*)?$/i.test(src)
                                    );
                                    
                                    for (const src of scripts) {
                                        try {
                                            const text = await fetch(src, { credentials: 'omit' }).then(r => r.text());
                                            if (/get_pawtected_endpoint_payload|pawtect/i.test(text)) {
                                                localStorage.setItem(CACHE_KEY, src);
                                                console.log('wplacer: computePawtectForT discovered:', src);
                                                return await import(src);
                                            }
                                        } catch { }
                                    }
                                    
                                    // Final fallbacks
                                    const fallbacks = [
                                        new URL('/_app/immutable/chunks/BdJF80pX.js', location.origin).href,
                                        'https://wplace.live/_app/immutable/chunks/BdJF80pX.js'
                                    ];
                                    for (const url of fallbacks) {
                                        try { return await import(url); } catch { }
                                    }
                                    return null;
                                };
                                
                                const mod = await importPawtectModule();
                                if (!mod) throw new Error('Could not import pawtect module');
                                
                                const wasm = await mod._();
                                try {
                                    const me = await fetch(`${backend}/me`, { credentials: 'include' }).then(r => r.ok ? r.json() : null);
                                    if (me?.id && typeof mod.i === 'function') mod.i(me.id);
                                } catch { }
                                
                                // Randomize pixel tile and coords
                                const url = `${backend}/s0/pixel/1/1`;
                                if (typeof mod.r === 'function') mod.r(url);
                                const fp = (window.wplacerFP && String(window.wplacerFP)) || (() => {
                                    const b = new Uint8Array(16); 
                                    crypto.getRandomValues(b); 
                                    return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
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
                            } catch (e) {
                                console.error('wplacer: computePawtectForT failed:', e);
                            }
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

    if (request.action === "tokenPairReceived") {
        // Handle token pair (both turnstile and pawtect)
        if (request.turnstile && request.pawtect) {
            console.log("wplacer: Token pair received");
            // Reset token wait timer when a token pair is successfully received
            if (tokenWaitStartTime) {
                console.log("wplacer: Token pair received. Resetting wait timer.");
                tokenWaitStartTime = null;
                
                // Notify popup that token is no longer needed
                chrome.runtime.sendMessage({
                    action: "tokenStatusChanged",
                    waiting: false
                }).catch(() => {});
            }
            
            getServerUrl("/t").then(url => {
                fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        t: request.turnstile,
                        pawtect: request.pawtect,
                        fp: request.fp || null,
                        colors: request.colors || null
                    })
                }).then(response => {
                    if (response.ok) {
                        console.log("wplacer: Token pair sent successfully");
                    } else {
                        console.error("wplacer: Failed to send token pair, status:", response.status);
                    }
                }).catch(error => {
                    console.error("wplacer: Error sending token pair:", error);
                });
            });
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: "Missing turnstile or pawtect token" });
        }
        return true; // Required for async response
    }
    return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith("https://wplace.live")) {
        console.log("wplacer: wplace.live tab loaded. Sending cookie and ensuring polling is active.");
        sendCookie(response => console.log(`wplacer: Cookie send status: ${response.success ? 'Success' : 'Failed'}`));
        
        // Ensure polling is active when wplace.live tabs are loaded
        if (!pollInterval) {
            console.log("wplacer: Starting polling because wplace.live tab loaded.");
            startPolling();
        }
    }
});

// --- Initialization ---
const initializeExtension = async () => {
    console.log("wplacer: Initializing extension...");
    
    // Load settings first
    await getSettings();
    
    // Start polling
    startPolling();
    
    // Keep alarm-based cookie refresh
    chrome.alarms.clearAll();
    chrome.alarms.create(COOKIE_ALARM_NAME, {
        periodInMinutes: 20
    });
    
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === COOKIE_ALARM_NAME) {
            console.log("wplacer: Periodic cookie refresh triggered.");
            sendCookie(response => console.log(`wplacer: Periodic cookie refresh: ${response.success ? 'Success' : 'Failed'}`));
        }
    });
    
    console.log("wplacer: Extension initialized.");
};

chrome.runtime.onStartup.addListener(() => {
    console.log("wplacer: Browser startup.");
    initializeExtension();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("wplacer: Extension installed/updated.");
    initializeExtension();
});

// Start polling immediately when script loads
initializeExtension();