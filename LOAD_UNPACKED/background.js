// --- Constants ---
const POLL_ALARM_NAME = 'wplacer-poll-alarm';
const COOKIE_ALARM_NAME = 'wplacer-cookie-alarm';

// --- Core Functions ---
const getSettings = async () => {
    const result = await chrome.storage.local.get(['wplacerPort']);
    return {
        port: result.wplacerPort || 80,
        host: '127.0.0.1'
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
        const url = await getServerUrl("/token-needed");
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`wplacer: Server poll failed with status: ${response.status}`);
            return;
        }
        const data = await response.json();
        if (data.needed) {
            console.log("wplacer: Server requires a token. Initiating reload.");
            await initiateReload();
        }
    } catch (error) {
        console.error("wplacer: Could not connect to the server to poll for tokens.", error.message);
    }
};

const initiateReload = async () => {
    try {
        const tabs = await chrome.tabs.query({ url: "https://wplace.live/*" });
        if (tabs.length === 0) {
            console.warn("wplacer: Token requested, but no wplace.live tabs are open.");
            return;
        }
        const targetTab = tabs.find(t => t.active) || tabs[0];
        console.log(`wplacer: Sending reload command to tab #${targetTab.id}`);
        await chrome.tabs.sendMessage(targetTab.id, { action: "reloadForToken" });
    } catch (error) {
        // It's possible the content script isn't loaded yet, so we can try a direct reload as a fallback.
        console.error("wplacer: Error sending reload message to tab, falling back to direct reload.", error);
        const targetTab = (await chrome.tabs.query({ url: "https://wplace.live/*" }))[0];
        if (targetTab) {
            chrome.tabs.reload(targetTab.id);
        }
    }
};

// --- User/Cookie Management ---
const sendCookie = async (callback) => {
    const getCookie = (details) => new Promise(resolve => chrome.cookies.get(details, cookie => resolve(cookie)));

    const [jCookie, sCookie] = await Promise.all([
        getCookie({ url: "https://wplace.live", name: "j" }),
        getCookie({ url: "https://wplace.live", name: "s" })
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

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendCookie") {
        sendCookie(sendResponse);
        return true; // Required for async response
    }
    if (request.type === "SEND_TOKEN") {
        getServerUrl("/t").then(url => {
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ t: request.token })
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