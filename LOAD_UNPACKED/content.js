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

    const ELECTION_WAIT_MS = 250;

    const now = Date.now();
    const lock = localStorage.getItem(REFRESH_LOCK_KEY);

    if (lock && (now - parseInt(lock, 10)) < LOCK_DURATION_MS) {
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
        }
    `;

    const handleApiResponse = (event) => {
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