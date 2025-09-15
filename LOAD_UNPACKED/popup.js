document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const statusEl = document.getElementById('status');
    const statusDot = document.getElementById('statusDot');
    const portInput = document.getElementById('port');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const sendCookieBtn = document.getElementById('sendCookieBtn');
    const clearPawtectBtn = document.getElementById('clearPawtectBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const autoReloadCheckbox = document.getElementById('autoReload');
    const autoClearCheckbox = document.getElementById('autoClear');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    let initialPort = 80;
    let tokenWaitingStatus = false;

    // Load current settings
    chrome.storage.local.get(['wplacerPort', 'autoReload', 'autoClear'], (result) => {
        initialPort = result.wplacerPort || 80;
        portInput.value = initialPort;
        
        // Set auto reload and auto clear settings (default to true if not set)
        const autoReload = result.autoReload !== undefined ? result.autoReload : true;
        const autoClear = result.autoClear !== undefined ? result.autoClear : true;
        
        autoReloadCheckbox.checked = autoReload;
        autoClearCheckbox.checked = autoClear;
    });
    
    // Tab switching functionality
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Check token waiting status
    const checkTokenStatus = () => {
        chrome.runtime.sendMessage({ action: "getTokenStatus" }, (response) => {
            if (chrome.runtime.lastError) return;
            
            if (response && response.waiting) {
                statusDot.classList.remove('active');
                statusDot.classList.add('waiting');
                tokenWaitingStatus = true;
                statusEl.textContent = `Waiting for token (${response.waitTime}s)...`;
            } else {
                statusDot.classList.remove('waiting');
                statusDot.classList.add('active');
                tokenWaitingStatus = false;
                statusEl.textContent = 'Ready. Tokens will be sent automatically.';
            }
        });
    };
    
    // Listen for token status updates from background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "tokenStatusChanged") {
            if (message.waiting) {
                statusDot.classList.remove('active');
                statusDot.classList.add('waiting');
                tokenWaitingStatus = true;
                statusEl.textContent = `Waiting for token (${message.waitTime}s)...`;
            } else {
                statusDot.classList.remove('waiting');
                statusDot.classList.add('active');
                tokenWaitingStatus = false;
                statusEl.textContent = 'Ready. Tokens will be sent automatically.';
            }
        } else if (message.action === "statusUpdate") {
            // Update status message from background script
            statusEl.textContent = message.status;
            
            // If it's a success message, add a visual indicator
            if (message.status.includes("successfully") || message.status.includes("reloaded")) {
                statusEl.classList.add('success');
                setTimeout(() => {
                    statusEl.classList.remove('success');
                }, 2000);
            }
        }
    });
    
    // Check status initially and every 2 seconds
    checkTokenStatus();
    setInterval(checkTokenStatus, 2000);

    // Save settings
    saveBtn.addEventListener('click', () => {
        const port = parseInt(portInput.value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            statusEl.textContent = 'Error: Invalid port number.';
            return;
        }

        setButtonLoading(saveBtn, true);
        
        chrome.storage.local.set({ 
            wplacerPort: port,
            autoReload: autoReloadCheckbox.checked,
            autoClear: autoClearCheckbox.checked
        }, () => {
            setButtonLoading(saveBtn, false);
            statusEl.textContent = `Settings saved. Server on port ${port}.`;
            
            // Visual feedback for success
            saveBtn.style.backgroundColor = 'var(--success-color)';
            setTimeout(() => {
                saveBtn.style.backgroundColor = '';
            }, 1000);
            
            // Inform background script if settings changed
            chrome.runtime.sendMessage({ 
                action: "settingsUpdated",
                portChanged: port !== initialPort
            });
            initialPort = port;
        });
    });
    
    // Auto reload setting change
    autoReloadCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ autoReload: autoReloadCheckbox.checked });
    });
    
    // Auto clear setting change
    autoClearCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ autoClear: autoClearCheckbox.checked });
    });

    // Helper function to show loading state on buttons
    const setButtonLoading = (button, isLoading) => {
        if (isLoading) {
            button.classList.add('loading');
        } else {
            button.classList.remove('loading');
        }
    };

    // Manually send cookie
    sendCookieBtn.addEventListener('click', () => {
        statusEl.textContent = 'Sending cookie to server...';
        setButtonLoading(sendCookieBtn, true);
        
        chrome.runtime.sendMessage({ action: "sendCookie" }, (response) => {
            setButtonLoading(sendCookieBtn, false);
            
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = `Success! User: ${response.name}.`;
                // Visual feedback for success
                sendCookieBtn.style.backgroundColor = 'var(--success-color)';
                setTimeout(() => {
                    sendCookieBtn.style.backgroundColor = '';
                }, 1000);
            } else {
                statusEl.textContent = `Error: ${response.error}`;
                // Visual feedback for error
                sendCookieBtn.style.backgroundColor = 'var(--error-color)';
                setTimeout(() => {
                    sendCookieBtn.style.backgroundColor = '';
                }, 1000);
            }
        });
    });

    // Quick logout
    logoutBtn.addEventListener('click', () => {
        statusEl.textContent = 'Logging out...';
        setButtonLoading(logoutBtn, true);
        
        chrome.runtime.sendMessage({ action: "quickLogout" }, (response) => {
            setButtonLoading(logoutBtn, false);
            
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = 'Logout successful. Site data cleared.';
                // Visual feedback for success
                logoutBtn.style.backgroundColor = 'var(--success-color)';
                setTimeout(() => {
                    logoutBtn.style.backgroundColor = '';
                }, 1000);
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });
    
    // Clear Pawtect Cache
    clearPawtectBtn.addEventListener('click', () => {
        statusEl.textContent = 'Clearing token cache...';
        setButtonLoading(clearPawtectBtn, true);
        
        chrome.runtime.sendMessage({ action: "clearPawtectCache" }, (response) => {
            setButtonLoading(clearPawtectBtn, false);
            
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = 'Token cache cleared successfully.';
                // Visual feedback for success
                clearPawtectBtn.style.backgroundColor = 'var(--success-color)';
                setTimeout(() => {
                    clearPawtectBtn.style.backgroundColor = '';
                }, 1000);
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });
});