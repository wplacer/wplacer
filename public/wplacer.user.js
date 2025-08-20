// ==UserScript==
// @name         wplacer
// @version      1.6.3
// @description  Send token to local server
// @namespace    https://github.com/luluwaffless/
// @homepageURL  https://github.com/luluwaffless/wplacer
// @author       luluwaffless & Jinx & ur-lucky
// @icon         https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/icons/favicon.png
// @updateURL    https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/wplacer.user.js
// @downloadURL  https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/wplacer.user.js
// @match        https://wplace.live/*
// @connect      localhost
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(() => {
    const host = GM_getValue("wplacer_server_host", "127.0.0.1:80");
    const sent = new Set();

    function sendTokenToServer(token) {
        if (!token || sent.has(token)) return;
        sent.add(token);
        console.log("✅ wplacer: Sending token to server...");
        GM_xmlhttpRequest({
            method: "POST",
            url: `http://${host}/t`,
            data: JSON.stringify({ t: token }),
            headers: { "Content-Type": "application/json" },
            onload: (res) => console.log("✅ wplacer: Server response:", res.responseText),
            onerror: (err) => console.error("❌ wplacer: Request failed:", err)
        });
    }

    window.addEventListener("message", (event) => {
        const d = event?.data;
        if (d?.type === "WPLACER_TOKEN" && d.token) {
            sendTokenToServer(d.token);
        }
    });

    const promptForHost = () => {
        const newHost = prompt('Please enter your server\'s IP and port (example: "127.0.0.1:80"):', host);
        if (newHost && /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d):\d{1,5}$/.test(newHost)) {
            GM_setValue("wplacer_server_host", newHost);
            location.reload();
        } else {
            alert("Invalid IP address or port. Please try again.");
            promptForHost();
        }
    };

    GM_xmlhttpRequest({
        method: "GET",
        url: `http://${host}/ping`,
        onload: (res) => {
            if (res.responseText !== "Pong!") return;
            console.log("✅ wplacer: Server connection successful. Injecting script.");

            const script = document.createElement("script");
            script.id = "wplacer-injected";
            script.textContent = `(function () {
                console.log("✅ wplacer: Hello from the injected script! Listening for Turnstile tokens.");
                const host = "${host}";
                const sentInPage = new Set();

                const postToken = (token, from) => {
                    if (!token || typeof token !== 'string' || token.length < 20 || sentInPage.has(token)) return;
                    sentInPage.add(token);
                    console.log(\`✅ wplacer: CAPTCHA Token Captured (\${from})\`);
                    window.postMessage({ type: "WPLACER_TOKEN", token }, "*");
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

                // --- Secondary Method: Server-Sent Events (SSE) to check for existing tokens ---
                try {
                    const es = new EventSource(\`http://\${host}/events\`);
                    es.addEventListener("request-token", () => {
                        console.log("wplacer: Received token request from server. Checking for existing token...");
                        const input = document.querySelector('input[name="cf-turnstile-response"]');
                        if (input?.value) {
                            postToken(input.value, "sse-request");
                        } else {
                            console.log("wplacer: No existing token found on page. Waiting for next automatic token generation.");
                        }
                    });
                } catch (e) { console.error("wplacer: Failed to connect to event source:", e) }

            })();`;
            document.documentElement.appendChild(script);
        },
        onerror: () => {
            const userConfirm = confirm("Is your wplacer local server running? Click OK if yes, otherwise Cancel.");
            if (userConfirm) promptForHost();
            else console.warn("⚠️ wplacer: Server is not running. Please start your local server.");
        }
    });
})();