//pulling ports
let port = 80

// firefox polyfills "chrome.storage.*" 
// so it should work on gecko based browsers!
chrome.storage.local.get(null,function (obj){
// edge case error handling cuz theres always one!
    if (obj.port == null)
        chrome.storage.local.set({"port":"80"},function (){
        console.log("Storage Succesful");
    });
    port = obj.port
});


console.log("✅ wplacer: Content script loaded. Listening for Turnstile tokens.");
const sentInPage = new Set();

const postToken = (token, from) => {
    if (!token || typeof token !== 'string' || token.length < 20 || sentInPage.has(token)) return;
    sentInPage.add(token);
    console.log(`✅ wplacer: CAPTCHA Token Captured (${from})`);
    chrome.runtime.sendMessage({ type: "SEND_TOKEN", token: token });
};

// --- Primary Method: Listen for messages from the Cloudflare Turnstile iframe ---
window.addEventListener('message', (e) => {
    try {
        if (e.origin !== "https://challenges.cloudflare.com") return;
        const data = e.data;
        let token = null;
        if (data && typeof data === 'object') {
            token = data.token || data.response || data['cf-turnstile-response'];
        }
        if (token) {
            postToken(token, 'postMessage');
        }
    } catch { /* ignore */ }
}, true);

// --- Secondary Method: Server-Sent Events (SSE) to trigger a refresh on demand ---
try {
    const es = new EventSource(`http://127.0.0.1:${port}/events`);
    es.addEventListener("request-token", () => {
        console.log("wplacer: Received token request from server.");
        
        // Leader election to prevent all tabs from refreshing
        const lock = localStorage.getItem('wplacer_refresh_lock');
        const now = Date.now();

        if (lock && (now - parseInt(lock, 10)) < 5000) {
            console.log("wplacer: Another tab is already handling the refresh. Standing by.");
            return;
        }

        localStorage.setItem('wplacer_refresh_lock', now.toString());
        console.log("wplacer: This tab is handling the refresh.");
        location.reload();
    });
} catch (e) { 
    console.error("wplacer: Failed to connect to event source. On-demand token refresh will not work.", e);
}