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

const postToken = (token) => {
    if (!token || typeof token !== 'string' || sentTokens.has(token)) {
        return;
    }
    sentTokens.add(token);
    console.log(`✅ wplacer: CAPTCHA Token Captured. Sending to server.`);
    chrome.runtime.sendMessage({ type: "SEND_TOKEN", token: token });
};

// --- Event Listeners ---

// 1. Listen for messages from the Cloudflare Turnstile iframe (primary method)
window.addEventListener('message', (event) => {
    if (event.origin !== "https://challenges.cloudflare.com" || !event.data) {
        return;
    }
    try {
        const token = event.data.token || event.data.response || event.data['cf-turnstile-response'];
        if (token) {
            postToken(token);
        }
    } catch {
        // Ignore errors from parsing message data
    }
}, true);

// 2. Listen for commands from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reloadForToken") {
        console.log("wplacer: Received reload command from background script. Reloading now...");
        sessionStorage.setItem(RELOAD_FLAG, 'true');
        location.reload();
    }
});