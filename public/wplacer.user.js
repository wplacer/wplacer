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
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(() => {
    const host = GM_getValue("wplacer_server_host", "localhost");

    const sent = new Set();

    function sendTokenToServer(token) {
        if (!token || sent.has(token)) return;
        sent.add(token);
        console.log("✅ CAPTCHA Token Received");
        GM_xmlhttpRequest({
            method: "POST",
            url: `http://${host}/t`,
            data: JSON.stringify({ t: token }),
            headers: { "Content-Type": "application/json" },
            onload: (res) => console.log("Server response:", res.responseText),
            onerror: (err) => console.error("Request failed:", err)
        });
    }

    window.addEventListener("message", (event) => {
        const d = event?.data;
        if (!d || d.type !== "WPLACER_TOKEN" || !d.token) return;
        sendTokenToServer(d.token);
    });

    const promptForHost = () => {
        const newHost = prompt(
            'Please enter your server\'s IP and port (example: "127.0.0.1:80"):',
            host
        );
        if (
            newHost &&
            newHost.match(
                /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d):(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|\d{1,4})$/
            )
        ) {
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
            console.log("Server response:", res.responseText);
            if (res.responseText !== "Pong!") return;

            const script = document.createElement("script");
            script.id = "wplacer";
            script.textContent = `(function () {
  console.log("✅ Hello Wplace!");

  const postToken = (t, from, extra) => {
    try {
      if (!t || typeof t !== "string" || t.length < 10) return;
      window.postMessage({ type: "WPLACER_TOKEN", token: t, from, extra }, "*");
    } catch (e) { /* no-op */ }
  };

try {
  const es = new EventSource("http://__HOST__/events".replace("__HOST__", /* interpolate host here */));
  es.addEventListener("request-token", () => {
    try { const t = window.na?.captcha?.token; if (t) postToken(t, "existing-state"); } catch {}
    try {
      const inp = document.querySelector('input[name="cf-turnstile-response"], input[name*="turnstile" i]');
      if (inp?.value) postToken(inp.value, "existing-input");
    } catch {}
    try { if (window.__lastTurnstileToken) postToken(window.__lastTurnstileToken, "existing-var"); } catch {}
  });
} catch (e) { /* ignore */ }


  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url);
      const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
      const body = (init && init.body) || (typeof input !== 'string' && input && input.body);

      if (url && /\\/s\\d+\\/pixel\\/\\d+\\/\\d+$/i.test(url) && method === "POST" && typeof body === "string" && body[0] === "{" && body[body.length - 1] === "}") {
        try {
          const payload = JSON.parse(body);
          if (payload && payload.t) {
            console.log("✅ CAPTCHA Token Captured (fetch):", payload.t);
            postToken(payload.t, "fetch");
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.error(e);
    }
    return origFetch.apply(this, arguments);
  };

  (function () {
    const seen = new Set();
    const deliver = (token, from, extra) => {
      if (!token || typeof token !== 'string' || token.length < 10 || seen.has(token)) return;
      seen.add(token);
      postToken(token, from, extra);
    };

    window.addEventListener('message', (e) => {
      try {
        const host = (new URL(e.origin)).host;
        if (!/challenges\\.cloudflare\\.com$/i.test(host)) return;

        const data = e.data;
        let token = null;

        if (typeof data === 'string') {
          if (data.startsWith('0.') && data.length > 20) token = data;
        } else if (data && typeof data === 'object') {
          token = data.token || data.c || data.response || data['cf-turnstile-response'] || null;
        }

        if (token) {
          console.log("✅ CAPTCHA Token Captured (postMessage):", token);
          deliver(token, 'postMessage', { origin: e.origin });
        }
      } catch { /* ignore */ }
    }, true);
  })();
})();`;
            document.documentElement.appendChild(script);
        },
        onerror: () => {
            const userConfirm = confirm(
                "Is your Wplacer local server running? Click OK if yes, otherwise Cancel."
            );
            if (userConfirm) promptForHost();
            else console.warn("Wplacer server is not running. Please start your local server.");
        }
    });
})();
