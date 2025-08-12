// ==UserScript==
// @name         wplacer
// @version      1.0.0
// @description  Send token to local server
// @namespace    https://github.com/luluwaffless/
// @author       luluwaffless
// @icon         https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/icons/favicon.png
// @updateURL    https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/client.js
// @downloadURL  https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/client.js
// @match        https://wplace.live/*
// @connect      localhost
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(() => {
    // listener and sender of the token to the server
    window.addEventListener("message", (event) => {
        if (!event.data || event.data.type !== "WPLACER_TOKEN") return;
        const token = event.data.token;
        console.log("✅ CAPTCHA Token Received");
        GM_xmlhttpRequest({
            method: "POST",
            url: "http://localhost/t",
            data: JSON.stringify({ t: token }),
            headers: { "Content-Type": "application/json" },
            onload: (res) => console.log("Server response:", res.responseText),
            onerror: (err) => console.error("Request failed:", err)
        });
    });

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
})();