// ==UserScript==
// @name         wplacer
// @version      1.4.0
// @description  Send token to local server
// @namespace    https://github.com/luluwaffless/
// @homepageURL  https://github.com/luluwaffless/wplacer
// @author       luluwaffless
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
    const host = GM_getValue("wplacer_server_host", "localhost");
    // listener and sender of the token to the server
    window.addEventListener("message", (event) => {
        if (!event.data || event.data.type !== "WPLACER_TOKEN") return;
        const token = event.data.token;
        console.log("✅ CAPTCHA Token Received");
        GM_xmlhttpRequest({
            method: "POST",
            url: `http://${host}/t`,
            data: JSON.stringify({ t: token }),
            headers: { "Content-Type": "application/json" },
            onload: (res) => console.log("Server response:", res.responseText),
            onerror: (err) => console.error("Request failed:", err)
        });
    });

    // check if local server is on
    // prompt function
    const p = () => {
        const newHost = prompt("Please enter your server's IP and port (example: \"localhost\", \"192.168.0.1\", \"127.0.0.1:3000\"):", host);
        if (newHost && newHost.match(/^(localhost(?::\d{1,5})?|\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?)$/)) {
            GM_setValue("wplacer_server_host", newHost);
            location.reload();
        } else {
            alert("Invalid IP address or port. Please try again.");
            p();
        };
    };
    GM_xmlhttpRequest({
        method: "GET",
        url: `http://${host}/ping`,
        onload: (res) => {
            console.log("Server response:", res.responseText)
            if (res.responseText === "Pong!") {
                // inject script to hear for post requests
                const script = document.createElement('script');
                script.id = "wplacer";
                script.textContent = `(() => {
    console.log("✅ Hello Wplace!");
    const origFetch = window.fetch;
    window.fetch = async (url, options) => {
        try {
            if (typeof url === 'string' && url.includes('https://backend.wplace.live/s0/pixel/') && options && options.method === "POST" && options.body.startsWith("{") && options.body.endsWith("}")) {
                const payload = JSON.parse(options.body);
                if (payload.t) {
                    console.log("✅ CAPTCHA Token Captured:", payload.t);
                    window.postMessage({ type: "WPLACER_TOKEN", token: payload.t }, "*");
                };
            };
        } catch (e) {
            console.error(e);
        };
        return origFetch(url, options);
    };
})();`;
                document.documentElement.appendChild(script);
            }
        },
        onerror: () => {
            // confirm host is correct
            const userConfirm = confirm("Is your Wplacer local server running? Click OK if yes, otherwise Cancel.");
            if (userConfirm) p();
            else console.warn("Wplacer server is not running. Please start your local server.");
        }
    });
})();
