document.addEventListener("DOMContentLoaded",function (){
  //here I've checked and set the default to 80

    // firefox polyfills "chrome.storage.*" 
    // so it should work on gecko based browsers!

    // source: trust me bro
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
    chrome.storage.local.get(null,function (obj){
        if (obj.port == null)
          chrome.storage.local.set({"port":"80"},function (){
            console.log("Storage Succesful");
        });

    });
});

// this will listen for a change on the input box
document.getElementById('port').addEventListener('change', () => {
  chrome.storage.local.set({"port":document.getElementById('port').value},function (){
    console.log("Storage Succesful");
});
  console.log(document.getElementById('port').value)
});

// force cookie update
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