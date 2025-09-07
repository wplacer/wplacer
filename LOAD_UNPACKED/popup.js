document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const portInput = document.getElementById('port');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const sendCookieBtn = document.getElementById('sendCookieBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let initialPort = 80;

    // Load current settings
    chrome.storage.local.get(['wplacerPort'], (result) => {
        initialPort = result.wplacerPort || 80;
        portInput.value = initialPort;
    });

    // Save settings (delegated to background)
    saveBtn.addEventListener('click', () => {
        const port = parseInt(portInput.value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            statusEl.textContent = 'Error: Invalid port number.';
            return;
        }
        chrome.runtime.sendMessage({ action: 'saveSettings', port }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response && response.success) {
                statusEl.textContent = `Settings saved. Server on port ${port}.`;
                initialPort = port;
            } else {
                statusEl.textContent = `Error: ${(response && response.error) || 'Failed to save settings.'}`;
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

    // Quick logout
    logoutBtn.addEventListener('click', () => {
        statusEl.textContent = 'Logging out...';
        chrome.runtime.sendMessage({ action: "quickLogout" }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = 'Logout successful. Site data cleared.';
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });
});
