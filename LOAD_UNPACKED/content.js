// --- Constants ---
const RELOAD_FLAG = 'wplacer_reload_in_progress';
const GEN_REQUEST_TYPE = 'WPLACER_TURNSTILE_REQUEST';
const GEN_TOKEN_TYPE = 'WPLACER_TURNSTILE_TOKEN';
const OVERLAY_ID = 'wplacer-overlay-root';
const LAUNCHER_ID = 'wplacer-overlay-launcher';
const OVERLAY_CLOSED_FLAG = 'wplacer_overlay_closed';
const PERIODIC_GEN_MS = 20000; // 20s periodic generation

// --- Main Logic ---
console.log("✅ wplacer: Content script loaded.");

// Inject the page-level Turnstile generator so it runs in the page context
(function injectGenerator() {
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('turnstile_inject.js');
        script.async = false;
        (document.head || document.documentElement).appendChild(script);
        script.onload = () => script.remove();
    } catch (e) {
        console.warn('wplacer: Failed to inject generator script', e);
    }
})();

// Inject pawtect helper on load and allow manual reinject via Ctrl+Shift+P
let pawtectInjected = false;
const injectPawtectHelper = () => {
    if (pawtectInjected) return;
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('pawtect_inject.js');
        script.async = true;
        (document.head || document.documentElement).appendChild(script);
        pawtectInjected = true;
        console.log('wplacer: pawtect helper injected.');
    } catch (e) {
        console.warn('wplacer: Failed to inject pawtect helper', e);
    }
};
if (location.hostname.endsWith('wplace.live')) {
    injectPawtectHelper();
}
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        pawtectInjected = false; // allow re-inject
        injectPawtectHelper();
    }
}, true);

// --- Overlay UI (full-page) ---
// --- Overlay UI (full-page) ---
(() => {
    const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts || false);

    const getPort = () => new Promise((resolve) => {
        try {
            chrome.storage.local.get(['wplacerPort'], (result) => resolve(result?.wplacerPort || 80));
        } catch {
            resolve(80);
        }
    });

    // Move checkOverlayEnabled to the top level of the closure
    const checkOverlayEnabled = async () => {
        try {
            return new Promise((resolve) => {
                chrome.storage.local.get(['enableOverlay'], (result) => {
                    // Default to true if setting doesn't exist
                    const enabled = result.enableOverlay !== undefined ? result.enableOverlay : true;
                    console.log('wplacer: Overlay enabled from extension settings:', enabled);
                    resolve(enabled);
                });
            });
        } catch (e) {
            console.log('wplacer: Could not check overlay settings, defaulting to enabled', e);
            return true; // Default to enabled if there's an error
        }
    };

    const createLauncher = () => {
        if (document.getElementById(LAUNCHER_ID)) return;
        const btn = document.createElement('button');
        btn.id = LAUNCHER_ID;
        btn.textContent = 'Open wplacer';
        btn.style.cssText = [
            'position:fixed',
            'bottom: 20px',
            'left: 80px',
            'z-index:2147483646',
            'padding:10px 16px',
            'border-radius:10px',
            'border:none',
            'background:linear-gradient(135deg, #ff7a1a, #ff5f1a)',
            'color:#fff',
            'font:600 14px/1 "Segoe UI",sans-serif',
            'box-shadow:0 6px 18px rgba(255, 122, 26, 0.4)',
            'cursor:pointer',
            'transition:all 0.3s ease',
            'outline:none'
        ].join(';');
        
        on(btn, 'mouseover', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 8px 20px rgba(255, 122, 26, 0.5)';
        });
        
        on(btn, 'mouseout', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 6px 18px rgba(255, 122, 26, 0.4)';
        });
        btn.title = 'Open wplacer overlay (Ctrl+Shift+W)';
        on(btn, 'click', () => {
            checkOverlayEnabled().then(enabled => {
                if (enabled) {
                    sessionStorage.removeItem(OVERLAY_CLOSED_FLAG);
                    ensureOverlay(true);
                } else {
                    console.log('wplacer: Overlay is disabled in settings, not showing');
                }
            });
        });
        document.body.appendChild(btn);
    };

    const removeLauncher = () => {
        const el = document.getElementById(LAUNCHER_ID);
        if (el) try { el.remove(); } catch {}
    };

    const showOverlay = () => {
        const root = document.getElementById(OVERLAY_ID);
        if (root) root.style.display = 'block';
        removeLauncher();
    };

    const hideOverlay = () => {
        const root = document.getElementById(OVERLAY_ID);
        if (root) root.style.display = 'none';
        createLauncher();
    };

    const removeOverlay = () => {
        const root = document.getElementById(OVERLAY_ID);
        if (root) try { root.remove(); } catch {}
        createLauncher();
    };

    const createOverlay = async () => {
        if (document.getElementById(OVERLAY_ID)) return;
        const port = await getPort();
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:50000',
            'background:#0b0b0f',
            'display:block',
            'box-shadow:0 0 20px rgba(0,0,0,0.5)',
            'transition:all 0.3s ease'
        ].join(';');

        const bar = document.createElement('div');
        bar.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'height:40px',
            'display:flex',
            'align-items:center',
            'justify-content:space-between',
            'padding:0 15px',
            'background:linear-gradient(to right, #1a1a2e, #16213e)',
            'color:#fff',
            'font:600 14px/1 "Segoe UI",sans-serif',
            'border-bottom:1px solid rgba(255,255,255,0.15)',
            'box-shadow:0 2px 5px rgba(0,0,0,0.2)'
        ].join(';');
        const title = document.createElement('div');
        title.textContent = 'wplacer overlay';
        const controls = document.createElement('div');

        const btnStyle = [
            'margin-left:10px',
            'padding:6px 12px',
            'border-radius:6px',
            'border:1px solid rgba(255,255,255,0.3)',
            'background:rgba(255,255,255,0.1)',
            'color:#fff',
            'cursor:pointer',
            'font-weight:500',
            'transition:all 0.2s ease',
            'outline:none'
        ].join(';');
        
        const btnHoverStyle = [
            'background:rgba(255,255,255,0.2)',
            'border-color:rgba(255,255,255,0.4)'
        ].join(';');

        const minimizeBtn = document.createElement('button');
        minimizeBtn.textContent = 'Minimize';
        minimizeBtn.style.cssText = btnStyle;
        on(minimizeBtn, 'click', () => hideOverlay());
        on(minimizeBtn, 'mouseover', () => minimizeBtn.style.cssText = btnStyle + ';' + btnHoverStyle);
        on(minimizeBtn, 'mouseout', () => minimizeBtn.style.cssText = btnStyle);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = btnStyle;
        on(closeBtn, 'click', () => {
            sessionStorage.setItem(OVERLAY_CLOSED_FLAG, '1');
            removeOverlay();
        });
        on(closeBtn, 'mouseover', () => closeBtn.style.cssText = btnStyle + ';' + btnHoverStyle);
        on(closeBtn, 'mouseout', () => closeBtn.style.cssText = btnStyle);

        controls.appendChild(minimizeBtn);
        controls.appendChild(closeBtn);
        bar.appendChild(title);
        bar.appendChild(controls);

        const iframe = document.createElement('iframe');
        iframe.src = `http://127.0.0.1:${port}/`;
        iframe.style.cssText = [
            'position:absolute',
            'top:40px',
            'left:0',
            'right:0',
            'bottom:0',
            'width:100%',
            'height:calc(100% - 40px)',
            'border:0',
            'background:#0b0b0f'
        ].join(';');

        const fallback = document.createElement('div');
        fallback.style.cssText = [
            'position:absolute',
            'top:40px',
            'left:0',
            'right:0',
            'bottom:0',
            'display:none',
            'align-items:center',
            'justify-content:center',
            'color:#fff',
            'font:500 13px/1.4 "Segoe UI",sans-serif',
            'padding:20px',
            'text-align:center'
        ].join(';');
        fallback.innerHTML = `
            <div>
                <div style="opacity:.8;margin-bottom:8px;">Could not load embedded UI (possibly blocked by CSP).</div>
                <a href="http://127.0.0.1:${port}/" target="_blank" rel="noopener noreferrer" style="color:#ff9a4d;text-decoration:none;border-bottom:1px dotted #ff9a4d;">Open wplacer in a new tab</a>
            </div>
        `;

        on(iframe, 'error', () => { fallback.style.display = 'flex'; });
        on(iframe, 'load', () => { fallback.style.display = 'none'; });

        overlay.appendChild(bar);
        overlay.appendChild(iframe);
        overlay.appendChild(fallback);
        document.documentElement.appendChild(overlay);
    };

    const ensureOverlay = async (forceShow) => {
        // Only on wplace.live pages
        if (!location.hostname.endsWith('wplace.live')) return;
        
        // Check if overlay is enabled in extension settings first
        const enabled = await checkOverlayEnabled();
        
        if (!enabled) {
            console.log('wplacer: Overlay is disabled in settings, destroying overlay if it exists');
            // If overlay exists and setting is disabled, destroy it completely
            const existingOverlay = document.getElementById(OVERLAY_ID);
            if (existingOverlay) {
                try { existingOverlay.remove(); } catch {}
                console.log('wplacer: Existing overlay destroyed due to disabled setting');
            }
            return;
        }
        
        // If user closed this session and not forcing, show launcher
        if (!forceShow && sessionStorage.getItem(OVERLAY_CLOSED_FLAG) === '1') {
            createLauncher();
            return;
        }
        
        // Create and show overlay since it's enabled
        await createOverlay();
        showOverlay();
    };

    // Show overlay on first load only if enabled and not previously closed this session
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ensureOverlay(false);
        });
    } else {
        ensureOverlay(false);
    }

    // Keyboard toggle Ctrl+Shift+W
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'W' || e.key === 'w')) {
            const root = document.getElementById(OVERLAY_ID);
            if (root && root.style.display !== 'none') {
                hideOverlay();
            } else {
                checkOverlayEnabled().then(enabled => {
                    if (enabled) {
                        ensureOverlay(true);
                    } else {
                        console.log('wplacer: Overlay is disabled in settings, not showing');
                        createLauncher();
                    }
                });
            }
        }
    }, true);
})();

// Check if this load was triggered by our extension
if (sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.removeItem(RELOAD_FLAG);
    console.log("wplacer: Page reloaded to capture a new token.");
}

const sentTokens = new Set();
const pending = {
    turnstile: null,
    pawtect: null
};

// Generate a random hex fingerprint (default 32 chars)
const generateRandomHex = (length = 32) => {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
};

// Create a per-load fingerprint and expose it for page usage
try {
    const fp = generateRandomHex(32);
    window.wplacerFP = fp;
    sessionStorage.setItem('wplacer_fp', fp);
    console.log('wplacer: fingerprint generated:', fp);
} catch {}

// Try to get the current color order from the page
const getCurrentColorOrder = () => {
    try {
        // Check for color order in window/global objects (fastest method)
        if (window.app && window.app.palette && Array.isArray(window.app.palette.colors)) {
            return window.app.palette.colors;
        }
        
        // Try to find color order in localStorage
        const storedPalette = localStorage.getItem('wplace_palette');
        if (storedPalette) {
            try {
                const palette = JSON.parse(storedPalette);
                if (Array.isArray(palette)) {
                    return palette;
                }
            } catch {}
        }
        
        // Look for color palette elements in the DOM (slowest method)
        const colorPalette = document.querySelector('[data-testid="palette"]');
        if (colorPalette) {
            const colorButtons = colorPalette.querySelectorAll('button');
            if (colorButtons && colorButtons.length > 0) {
                const colors = [];
                colorButtons.forEach(button => {
                    const colorIndex = button.getAttribute('data-color-index') || 
                                      button.getAttribute('data-index') || 
                                      button.getAttribute('data-id');
                    if (colorIndex && !isNaN(parseInt(colorIndex))) {
                        colors.push(parseInt(colorIndex));
                    }
                });
                if (colors.length > 0) {
                    return colors;
                }
            }
        }
    } catch (e) {
        console.error('wplacer: Error getting color order:', e);
    }
    return null;
};

const postToken = (token, pawtectToken) => {
    // Skip if token is invalid or already sent
    if (!token || typeof token !== 'string' || sentTokens.has(token)) {
        return;
    }
    sentTokens.add(token);
    console.log(`✅ wplacer: CAPTCHA Token Captured. Sending to server.`);
    // Get fingerprint from available sources
    const fp = window.wplacerFP || sessionStorage.getItem('wplacer_fp') || generateRandomHex(32);
    
    // Get current color order
    const colors = getCurrentColorOrder();
    if (colors) {
        console.log('wplacer: Sending token with color order:', colors);
    }
    
    // Store in pending object if it's a turnstile token
    if (!pawtectToken) {
        pending.turnstile = token;
        // Try to send as a pair if we have both tokens
        trySendPair();
    }
    
    chrome.runtime.sendMessage({
        type: "SEND_TOKEN",
        token: token,
        pawtect: pawtectToken,
        fp,
        colors
    });
};

// Try to send token pair if we have both
const trySendPair = () => {
    if (pending.turnstile && pending.pawtect) {
        console.log('wplacer: Sending token pair to background script.');
        chrome.runtime.sendMessage({
            action: "tokenPairReceived",
            turnstile: pending.turnstile,
            pawtect: pending.pawtect
        });
        
        // Clear pending after sending
        pending.turnstile = null;
        pending.pawtect = null;
    }
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
        // Ensure token is always a string
            const token = String(event.data.token || event.data.response || event.data['cf-turnstile-response'] || '');
        if (token) {
            pending.turnstile = token;
            // Kick off pawtect compute seeded with this turnstile token
            const fp = window.wplacerFP || sessionStorage.getItem('wplacer_fp') || generateRandomHex(32);
            // Ensure all values are properly typed
            const body = { colors: [0], coords: [1, 1], fp: String(fp), t: String(token) };
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

// Listen for pawtect token message (for visibility in DevTools)
window.addEventListener('message', (event) => {
    try {
        if (event.source === window && event.data && event.data.type === 'WPLACER_PAWTECT_TOKEN') {
            const token = event.data.token || null;
            const fp = event.data.fp || null;
            console.log('✅ wplacer: Pawtect token:', token);
            if (fp) console.log('✅ wplacer: Pawtect fp:', fp);
            try {
                chrome.runtime.sendMessage({ action: 'applyPawtect', token, fp });
            } catch {}
        }
    } catch {}
}, true);

// 2. Listen for commands from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reloadForToken") {
        console.log("wplacer: Received reload command from background script. Reloading now...");
        sessionStorage.setItem(RELOAD_FLAG, 'true');
        location.reload();
    } else if (request.action === 'generateToken') {
        console.log('wplacer: Received generateToken command. Attempting in-page Turnstile execution...');
        requestInPageTokenWithTimeout(55000, true);
    }
});

// --- Periodic token generation (without backend request trigger) ---
let periodicTimer = null;
let periodicBusy = false;

const requestInPageTokenWithTimeout = (timeoutMs = 55000, fallbackToReload = false) => {
    // Ask the injected script to generate a token and handle timeout
    let done = false;
    const timeout = setTimeout(() => {
        if (done) return;
        done = true;
        if (fallbackToReload) {
            console.warn('wplacer: Token generation timed out, falling back to reload.');
            sessionStorage.setItem(RELOAD_FLAG, 'true');
            location.reload();
        }
    }, timeoutMs);

    const onToken = (event) => {
        if (event.source === window && event.data?.type === GEN_TOKEN_TYPE) {
            window.removeEventListener('message', onToken, true);
            if (done) return;
            done = true;
            clearTimeout(timeout);
            if (event.data.token) {
                postToken(event.data.token);
            } else if (fallbackToReload) {
                console.warn('wplacer: Generator responded without token. Reloading.');
                sessionStorage.setItem(RELOAD_FLAG, 'true');
                location.reload();
            }
        }
    };
    window.addEventListener('message', onToken, true);
    window.postMessage({ type: GEN_REQUEST_TYPE }, '*');
};

const periodicTick = async () => {
    // Only run on wplace.live and when page is visible to reduce overhead
    if (!location.hostname.endsWith('wplace.live')) return;
    if (document.visibilityState !== 'visible') return;
    if (periodicBusy) return;
    periodicBusy = true;
    try {
        requestInPageTokenWithTimeout(15000, true);
    } finally {
        // Release lock slightly after to avoid tight loops
        setTimeout(() => { periodicBusy = false; }, 2000);
    }
};

const startPeriodicGeneration = () => {};

const stopPeriodicGeneration = () => {
    if (!periodicTimer) return;
    try { clearInterval(periodicTimer); } catch {}
    periodicTimer = null;
};

// Start the periodic generator on load for wplace.live pages
if (location.hostname.endsWith('wplace.live')) {
    window.addEventListener('beforeunload', () => stopPeriodicGeneration(), { once: true });
}
