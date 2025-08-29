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
let pendingRefreshTimeout = null;
let lastQueueSize = 0;

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
            // Check current queue size before initiating refresh
            if (lastQueueSize >= 4) {
                console.log(`⛔ wplacer: Server needs token but queue is sufficient (${lastQueueSize}), ignoring`);
                return;
            }
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
    if (request.action === "quickLogout") {
        quickLogout(sendResponse);
        return true; // Required for async response
    }
    if (request.type === "SEND_TOKEN") {
        getServerUrl("/t").then(url => {
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ t: request.token })
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error(`Server responded with status: ${response.status}`);
            })
            .then(data => {
                const queueSize = data.queueSize || 0;
                lastQueueSize = queueSize;
                
                console.log(`✅ wplacer: Token sent to server. Queue size: ${queueSize}`);
                
                // Queue too high
                if (queueSize >= 10) {
                    console.log(`🚨 wplacer: EMERGENCY STOP - Queue extremely high (${queueSize})`);
                    return; // No more refreshes
                }
                
                // Clear pending refreshes
                if (queueSize >= 4 && pendingRefreshTimeout) {
                    clearTimeout(pendingRefreshTimeout);
                    pendingRefreshTimeout = null;
                    console.log("🛑 wplacer: Cancelled pending refresh - queue too high");
                }
                
                // Dynamic refresh logic based on queue size
                let refreshDelay = 0;
                let shouldRefresh = true;
                
                if (queueSize <= 1) {
                    refreshDelay = 500; // 0.5s - build up quickly
                } else if (queueSize === 2) {
                    refreshDelay = 8000; // 8s - moderate
                } else if (queueSize === 3) {
                    refreshDelay = 30000; // 30s - maintenance
                } else {
                    shouldRefresh = false; // Stop refreshing
                }
                
                if (shouldRefresh) {
                    // Cancel any existing timeout
                    if (pendingRefreshTimeout) {
                        clearTimeout(pendingRefreshTimeout);
                    }
                    
                    console.log(`⏰ wplacer: Scheduling refresh in ${refreshDelay}ms (queue: ${queueSize})`);
                    
                    pendingRefreshTimeout = setTimeout(() => {
                        // Double-check queue hasn't grown
                        if (lastQueueSize <= 3) {
                            console.log(`🔄 wplacer: Executing scheduled refresh (queue was: ${lastQueueSize})`);
                            initiateReload();
                        } else {
                            console.log(`⛔ wplacer: Refresh cancelled - queue grew to ${lastQueueSize}`);
                        }
                        pendingRefreshTimeout = null;
                    }, refreshDelay);
                }
            })
            .catch(error => {
                console.error("wplacer: Error processing token response:", error.message);
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
    console.log("✅ wplacer: Auto-refresh system initialized.");
    console.log("🔄 wplacer: Token queue management active with dynamic refresh control.");
};

chrome.runtime.onStartup.addListener(() => {
    console.log("wplacer: Browser startup.");
    initializeAlarms();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("wplacer: Extension installed/updated.");
    initializeAlarms();
});