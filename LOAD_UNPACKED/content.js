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


// --- Function to run a leader election and reload the page ---
const initiateReloadElection = () => {
    const REFRESH_LOCK_KEY = 'wplacer_refresh_lock';
    const ELECTION_CANDIDATE_KEY = 'wplacer_election_candidate';
    const LOCK_DURATION_MS = 30000; // Increased to 30s
    const ELECTION_WAIT_MS = 250;

    const now = Date.now();
    const lock = localStorage.getItem(REFRESH_LOCK_KEY);

    if (lock && (now - parseInt(lock, 10)) < LOCK_DURATION_MS) {
        console.log("wplacer: A refresh is already in progress. Standing by.");
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

// --- Function to attempt triggering the Turnstile API ---
const attemptApiReset = () => {
    const scriptToInject = `
        if (window.turnstile && typeof window.turnstile.reset === 'function') {
            console.log('✅ wplacer: Triggering Turnstile reset via API.');
            window.turnstile.reset();
            window.postMessage({ type: 'WPLACER_API_RESULT', success: true }, '*');
        } else {
            console.warn('wplacer: Turnstile API not found. Will fall back to page reload.');
            window.postMessage({ type: 'WPLACER_API_RESULT', success: false }, '*');
        }
    `;

    const handleApiResponse = (event) => {
        if (event.source === window && event.data.type === 'WPLACER_API_RESULT') {
            window.removeEventListener('message', handleApiResponse);
            if (event.data.success) {
                console.log("wplacer: API reset command sent successfully. Waiting for new token.");
            } else {
                console.log("wplacer: API not available, falling back to reload election.");
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
            console.log("wplacer: Received token request from server. Attempting API reset first.");
            attemptApiReset();
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