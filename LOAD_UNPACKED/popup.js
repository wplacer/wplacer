document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    chrome.storage.local.get(['wplacerPort'], (result) => {
        document.getElementById('port').value = result.wplacerPort || 80;
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        const port = document.getElementById('port').value;
        chrome.storage.local.set({ wplacerPort: parseInt(port, 10) }, () => {
            statusEl.textContent = `Settings saved. Port is now ${port}.`;
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