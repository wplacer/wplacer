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
    const es = new EventSource(`http://127.0.0.1:80/events`);
    es.addEventListener("request-token", () => {
        console.log("wplacer: Received token request from server.");

        // --- Leader Election
        const REFRESH_LOCK_KEY = 'wplacer_refresh_lock';
        const ELECTION_CANDIDATE_KEY = 'wplacer_election_candidate';
        const LOCK_DURATION_MS = 20000;
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
    });
} catch (e) { 
    console.error("wplacer: Failed to connect to event source. On-demand token refresh will not work.", e);
}