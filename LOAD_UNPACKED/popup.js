document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const hostInput = document.getElementById('host');
    const portInput = document.getElementById('port');

    chrome.storage.local.get(['wplacerHost', 'wplacerPort'], (result) => {
        hostInput.value = result.wplacerHost || '127.0.0.1';
        portInput.value = result.wplacerPort || 80;
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        const host = hostInput.value;
        const port = portInput.value;
        chrome.storage.local.set({ 
            wplacerHost: host,
            wplacerPort: parseInt(port, 10) 
        }, () => {
            statusEl.textContent = `Settings saved. Server at ${host}:${port}.`;
        });
    });

    document.getElementById('sendCookieBtn').addEventListener('click', () => {
        statusEl.textContent = 'Sending...';
        
        chrome.runtime.sendMessage({ action: "sendCookie" }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = `Success! Added/updated user: ${response.name}.`;
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });
});