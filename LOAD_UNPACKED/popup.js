document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const portInput = document.getElementById('port');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const sendCookieBtn = document.getElementById('sendCookieBtn');

    let initialPort = 80;

    // Load current settings
    chrome.storage.local.get(['wplacerPort'], (result) => {
        initialPort = result.wplacerPort || 80;
        portInput.value = initialPort;
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const port = parseInt(portInput.value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            statusEl.textContent = 'Error: Invalid port number.';
            return;
        }

        chrome.storage.local.set({ wplacerPort: port }, () => {
            statusEl.textContent = `Settings saved. Server on port ${port}.`;
            // Inform background script if port changed, so it can reconnect SSE
            if (port !== initialPort) {
                chrome.runtime.sendMessage({ action: "settingsUpdated" });
                initialPort = port;
            }
        });
    });

    // Manually send cookie
    sendCookieBtn.addEventListener('click', () => {
        statusEl.textContent = 'Sending cookie to server...';
        chrome.runtime.sendMessage({ action: "sendCookie" }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = `Success! User: ${response.name}.`;
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });
});