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


// --- Run a leader election and reload the page ---
const initiateReloadElection = () => {
    const REFRESH_LOCK_KEY = 'wplacer_refresh_lock';
    const ELECTION_CANDIDATE_KEY = 'wplacer_election_candidate';
    const LOCK_DURATION_MS = 30000;
    const ELECTION_WAIT_MS = 250;

    const now = Date.now();
    const lock = localStorage.getItem(REFRESH_LOCK_KEY);

    if (lock && (now - parseInt(lock, 10)) < LOCK_DURATION_MS) {
        console.log("wplacer: A refresh is already in progress by another tab. Standing by.");
        return;
    }

    const myCandidateId = Math.random();
    localStorage.setItem(ELECTION_CANDIDATE_KEY, JSON.stringify({ id: myCandidateId, ts: now }));

    setTimeout(() => {
        try {
            const winnerData = localStorage.getItem(ELECTION_CANDIDATE_KEY);
            if (!winnerData) return;

            const winner = JSON.parse(winnerData);

            if (winner.id === myCandidateId) {
                console.log("wplacer: This tab won the election and is handling the refresh.");
                localStorage.setItem(REFRESH_LOCK_KEY, Date.now().toString());
                location.reload();
            } else {
                console.log("wplacer: Another tab won the election. Standing by.");
            }
        } catch (e) {
            console.error("wplacer: Error during leader election.", e);
        }
    }, ELECTION_WAIT_MS);
};

// --- Function to attempt triggering the Turnstile API, with reload as a fallback ---
const requestNewToken = () => {
    // This script is injected into the main page's context to access window.turnstile
    const scriptToInject = `
        if (window.turnstile && typeof window.turnstile.reset === 'function') {
            console.log('✅ wplacer: Attempting to trigger Turnstile reset via API.');
            window.turnstile.reset();
            window.postMessage({ type: 'WPLACER_API_ATTEMPT', success: true }, '*');
        } else {
            console.warn('wplacer: Turnstile API not found on this page.');
            window.postMessage({ type: 'WPLACER_API_ATTEMPT', success: false }, '*');
        }
    `;

    const handleApiResponse = (event) => {
        if (event.source === window && event.data.type === 'WPLACER_API_ATTEMPT') {
            window.removeEventListener('message', handleApiResponse); // Clean up listener
            if (event.data.success) {
                console.log("wplacer: API reset command sent. Waiting for new token from message listener.");
            } else {
                // If the API was not found, this tab will enter the election to reload.
                console.log("wplacer: API not available, entering reload election.");
                initiateReloadElection();
            }
        }
    };
    window.addEventListener('message', handleApiResponse, false);

    const scriptElement = document.createElement('script');
    scriptElement.textContent = scriptToInject;
    document.head.appendChild(scriptElement);
    document.head.removeChild(scriptElement);
};


// --- Initialize SSE connection with dynamic URL ---
const initializeSse = (serverUrl) => {
    try {
        const eventsUrl = new URL('/events', serverUrl).href;
        const es = new EventSource(eventsUrl);
        es.addEventListener("request-token", () => {
            console.log("wplacer: Received token request from server.");
            requestNewToken();
        });
        console.log(`wplacer: Connected to event source at ${eventsUrl}`);
    } catch (e) { 
        console.error("wplacer: Failed to connect to event source. On-demand token refresh will not work.", e);
    }
};

// Get server config from background script and then initialize
chrome.runtime.sendMessage({ action: "get-config" }, (serverUrl) => {
    if (chrome.runtime.lastError) {
        console.error("wplacer: Could not get server config from background script.", chrome.runtime.lastError.message);
    } else if (serverUrl) {
        initializeSse(serverUrl);
    } else {
        console.error("wplacer: Background script did not return a server URL.");
    }
});