//we're pulling ports
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

// --- Function to send the user cookie to the server ---
function sendCookie(callback) {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 500;

    // Helper to promisify the chrome.cookies.get function
    const getCookie = (details) => new Promise(resolve => chrome.cookies.get(details, cookie => resolve(cookie)));

    const tryGetCookies = () => {
        attempts++;
        
        const jCookiePromise = getCookie({ url: "https://backend.wplace.live", name: "j" });
        const sCookiePromise = getCookie({ url: "https://backend.wplace.live", name: "s" });

        Promise.all([jCookiePromise, sCookiePromise]).then(([jCookie, sCookie]) => {
            if (jCookie) {
                const cookies = { j: jCookie.value };
                if (sCookie) { // Fine whatever
                    cookies.s = sCookie.value;
                }

                fetch(`http://127.0.0.1:${port}/user`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cookies })
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
        fetch(`http://127.0.0.1:${port}/t`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ t: request.token })
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