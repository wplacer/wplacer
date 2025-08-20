const getServerUrl = async (path) => {
    return new Promise((resolve) => {
        chrome.storage.local.get(['wplacerPort'], (result) => {
            const port = result.wplacerPort || 80;
            resolve(`http://127.0.0.1:${port}${path}`);
        });
    });
};

// --- Function to send the user cookie to the server ---
async function sendCookie(callback) {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 500;

    const getCookie = (details) => new Promise(resolve => chrome.cookies.get(details, cookie => resolve(cookie)));

    const tryGetCookies = () => {
        attempts++;
        
        const jCookiePromise = getCookie({ url: "https://backend.wplace.live", name: "j" });
        const sCookiePromise = getCookie({ url: "https://backend.wplace.live", name: "s" });

        Promise.all([jCookiePromise, sCookiePromise]).then(async ([jCookie, sCookie]) => {
            if (jCookie) {
                const cookies = { j: jCookie.value };
                if (sCookie) {
                    cookies.s = sCookie.value;
                }
                const expirationDate = jCookie.expirationDate;
                const url = await getServerUrl("/user");

                fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cookies, expirationDate })
                })
                .then(response => {
                    if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
                    return response.json();
                })
                .then(userInfo => {
                    if (callback) callback({ success: true, name: userInfo.name });
                })
                .catch(error => {
                    if (callback) callback({ success: false, error: "Could not connect to the wplacer server. Is it running?" });
                });
            } else if (attempts < maxAttempts) {
                setTimeout(tryGetCookies, retryDelay);
            } else {
                if (callback) callback({ success: false, error: "Required cookie 'j' not found. Are you logged into wplace.live?" });
            }
        });
    };
    tryGetCookies();
}

// --- Listen for manual clicks from the popup ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendCookie") {
        sendCookie(sendResponse);
        return true; // Indicates an asynchronous response
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
});

// --- Automatically send the cookie when the user navigates to wplace.live ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://wplace.live")) {
        console.log("wplacer: wplace.live tab loaded. Automatically sending cookie.");
        sendCookie((response) => {
            if (response.success) {
                console.log(`wplacer: Auto-sent cookie for user ${response.name}.`);
            } else {
                console.warn(`wplacer: Auto-send failed: ${response.error}`);
            }
        });
    }
});

// --- Create a recurring alarm for the keep alive check ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("wplacer: Extension installed/updated. Creating keep-alive alarm.");
    chrome.alarms.create('cookieRefreshAlarm', {
        delayInMinutes: 1,
        periodInMinutes: 20
    });
});

chrome.runtime.onStartup.addListener(() => {
    console.log("wplacer: Browser startup. Creating keep-alive alarm.");
    chrome.alarms.create('cookieRefreshAlarm', {
        delayInMinutes: 1,
        periodInMinutes: 20
    });
});

// --- Listen for the alarm to fire ---
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cookieRefreshAlarm') {
        console.log("wplacer: Keep-alive alarm triggered. Sending cookie to refresh session.");
        sendCookie((response) => {
            if (response.success) {
                console.log(`wplacer: Periodic cookie refresh successful for ${response.name}.`);
            } else {
                console.warn(`wplacer: Periodic cookie refresh failed: ${response.error}`);
            }
        });
    }
});