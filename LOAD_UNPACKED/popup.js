document.getElementById('sendCookieBtn').addEventListener('click', () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Sending...';
  
  chrome.runtime.sendMessage({ action: "sendCookie" }, (response) => {
    if (chrome.runtime.lastError) {
        statusEl.textContent = 'Error: Could not communicate with the extension.';
        return;
    }
    if (response.success) {
      statusEl.textContent = `Success! Added/updated user: ${response.name}.`;
    } else {
      statusEl.textContent = `Error: ${response.error}`;
    }
  });
});