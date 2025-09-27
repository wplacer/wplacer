// elements
const $ = (id) => document.getElementById(id);
const main = $('main');
const openManageUsers = $('openManageUsers');
const openAddTemplate = $('openAddTemplate');
const openManageTemplates = $('openManageTemplates');
const openSettings = $('openSettings');
const userForm = $('userForm');
const scookie = $('scookie');
const jcookie = $('jcookie');
const submitUser = $('submitUser');
const deleteBannedUsersBtn = $('deleteBannedUsersBtn');
const manageUsers = $('manageUsers');
const manageUsersTitle = $('manageUsersTitle');
const userList = $('userList');
const checkUserStatus = $('checkUserStatus');
const addTemplate = $('addTemplate');
const convert = $('convert');
const details = $('details');
const size = $('size');
const ink = $('ink');
const templateCanvas = $('templateCanvas');
const previewCanvas = $('previewCanvas');
const previewCanvasButton = $('previewCanvasButton');
const previewBorder = $('previewBorder');
const templateForm = $('templateForm');
const templateFormTitle = $('templateFormTitle');
const convertInput = $('convertInput');
const templateName = $('templateName');
const tx = $('tx');
const ty = $('ty');
const px = $('px');
const py = $('py');
const userSelectList = $('userSelectList');
const selectAllUsers = $('selectAllUsers');
const canBuyMaxCharges = $('canBuyMaxCharges');
const canBuyCharges = $('canBuyCharges');
const antiGriefMode = $('antiGriefMode');
const eraseMode = $('eraseMode');
const templateOutlineMode = $('templateOutlineMode');
const templateSkipPaintedPixels = $('templateSkipPaintedPixels');
const enableAutostart = $('enableAutostart');
const submitTemplate = $('submitTemplate');
const manageTemplates = $('manageTemplates');
const templateList = $('templateList');
const startAll = $('startAll');
const stopAll = $('stopAll');
const settings = $('settings');
const openBrowserOnStart = $('openBrowserOnStart');
const drawingDirectionSelect = $('drawingDirectionSelect');
const drawingOrderSelect = $('drawingOrderSelect');
const pixelSkipSelect = $('pixelSkipSelect');
const accountCooldown = $('accountCooldown');
const purchaseCooldown = $('purchaseCooldown');
const accountCheckCooldown = $('accountCheckCooldown');
const dropletReserve = $('dropletReserve');
const antiGriefStandby = $('antiGriefStandby');
const chargeThreshold = $('chargeThreshold');
const totalCharges = $('totalCharges');
const totalMaxCharges = $('totalMaxCharges');
const totalDroplets = $('totalDroplets');
const totalPPH = $('totalPPH');
const messageBoxOverlay = $('messageBoxOverlay');
const messageBoxTitle = $('messageBoxTitle');
const messageBoxContent = $('messageBoxContent');
const messageBoxConfirm = $('messageBoxConfirm');
const messageBoxCancel = $('messageBoxCancel');
const proxyEnabled = $('proxyEnabled');
const proxyFormContainer = $('proxyFormContainer');
const proxyRotationMode = $('proxyRotationMode');
const proxyCount = $('proxyCount');
const reloadProxiesBtn = $('reloadProxiesBtn');
const logProxyUsage = $('logProxyUsage');

// Logs Viewer
const openLogsViewer = $('openLogsViewer');
const logsViewer = $('logsViewer');
const logsContainer = $('logsContainer');
const showLogsBtn = $('showLogsBtn');
const showErrorsBtn = $('showErrorsBtn');
const clearLogsBtn = $('clearLogsBtn');
const logsSearchInput = $('logsSearchInput');
const logsExportBtn = $('logsExportBtn');
const logsTypeFilter = $('logsTypeFilter');

// --- Global State ---
let templateUpdateInterval = null;
let confirmCallback = {};
let currentTab = 'main';
let currentTemplate = { width: 0, height: 0, data: [] };
let showCanvasPreview = true;

// Toast notification system
let toastCounter = 0;
const showToast = (message, type = 'info', duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-primary); cursor: pointer; padding: 0; margin-left: 10px;">×</button>
        </div>
    `;
    toast.style.zIndex = 1000 + toastCounter++;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, duration);
};


let logsWs = null;
let logsMode = 'logs'; // 'logs' or 'errors'
let allLogLines = [];
let filterText = '';
let filterType = '';
// Cap log buffer to N lines to keep UI responsive.
const MAX_LOG_LINES = 2000;
let __logRenderScheduled = false;
// Throttle log rendering to avoid UI jank under high throughput.
function renderLogsSoon() {
    if (__logRenderScheduled) return;
    __logRenderScheduled = true;
    setTimeout(() => {
        __logRenderScheduled = false;
        renderFilteredLogs();
    }, 100);
}

const tabs = {
    main,
    manageUsers,
    addTemplate,
    manageTemplates,
    settings,
    logsViewer,
};

// Lightweight axios fallback using fetch, in case CDN fails to load axios
(() => {
    if (window.axios) return;
    const buildUrl = (url, params) => {
        if (!params) return url;
        const usp = new URLSearchParams(params);
        return url + (url.includes('?') ? '&' : '?') + usp.toString();
    };
    const request = async (method, url, { params, data, headers } = {}) => {
        const u = buildUrl(url, params);
        const init = { method, headers: { 'Content-Type': 'application/json', ...(headers || {}) } };
        if (data !== undefined) init.body = JSON.stringify(data);
        const res = await fetch(u, init);
        let body = null;
        try { body = await res.json(); } catch { body = null; }
        if (!res.ok) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = { status: res.status, data: body };
            throw err;
        }
        return { status: res.status, data: body };
    };
    window.axios = {
        get: (url, config) => request('GET', url, config),
        delete: (url, config) => request('DELETE', url, config),
        post: (url, data, config) => request('POST', url, { ...(config || {}), data }),
        put: (url, data, config) => request('PUT', url, { ...(config || {}), data }),
    };
})();

const showMessage = (title, content, showToastAlso = false) => {
    messageBoxTitle.innerHTML = title;
    messageBoxContent.innerHTML = content;
    messageBoxCancel.classList.add('hidden');
    messageBoxConfirm.textContent = 'OK';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = { close: true };

    // Also show a toast for quick feedback
    if (showToastAlso) {
        const type = title.toLowerCase().includes('error') ? 'error' :
                    title.toLowerCase().includes('success') ? 'success' : 'info';
        showToast(content.replace(/<[^>]*>/g, ''), type, 2000);
    }
};

const showConfirmation = (title, content, onConfirm, closeOnConfirm) => {
    messageBoxTitle.innerHTML = title;
    messageBoxContent.innerHTML = content;
    messageBoxCancel.classList.remove('hidden');
    messageBoxConfirm.textContent = 'Confirm';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = {
        fn: onConfirm,
        close: closeOnConfirm
    };
};

const closeMessageBox = () => {
    messageBoxOverlay.classList.add('hidden');
};

messageBoxConfirm.addEventListener('click', () => {
    if (!confirmCallback) return;
    const { fn: callback, close } = confirmCallback;
    if (close) closeMessageBox();
    if (callback) callback();
});

messageBoxCancel.addEventListener('click', () => {
    closeMessageBox();
    confirmCallback = {};
});

const handleError = (error) => {
    console.error(error);
    let message = 'An unknown error occurred. Check the console for details.';

    if (error?.response && error.response.status === 409) {
        message = 'User is busy or not found. Wait a few seconds and try again, or stop templates using this user.';
    } else if (error.code === 'ERR_NETWORK') {
        message = 'Could not connect to the server. Please ensure the bot is running and accessible.';
    } else if (error.response && error.response.data && error.response.data.error) {
        const errMsg = error.response.data.error;
        if (errMsg.includes('(1015)')) {
            message = 'You are being rate-limited by the server. Please wait a moment before trying again.';
        } else if (errMsg.includes('(500)')) {
            message =
                "Authentication failed. The user's cookie may be expired or invalid. Please try adding the user again with a new cookie.";
        } else if (errMsg.includes('(401)')) {
            message =
                'Authentication failed (401). This may be due to an invalid cookie or the IP/proxy being rate-limited. Please try again later or with a different proxy.';
        } else if (errMsg.includes('(502)')) {
            message =
                "The server reported a 'Bad Gateway' error. It might be temporarily down or restarting. Please try again in a few moments.";
        } else {
            message = errMsg;
        }
    }
    showMessage('Error', message);
};

const changeTab = (tabName) => {
    // Clear any existing intervals
    if (templateUpdateInterval) {
        clearInterval(templateUpdateInterval);
        templateUpdateInterval = null;
    }

    // Clean up dynamic elements from previous tabs
    const dynamicElements = document.querySelectorAll('.template-actions-all, .toast');
    dynamicElements.forEach(el => el.remove());

    // Reset import share code flag when leaving manage templates
    if (currentTab === 'manageTemplates') {
        importShareCode = false;
    }

    // Ensure main menu buttons are properly reset
    if (tabName === 'main') {
        resetMainMenuButtons();
    }

    // Hide all tabs
    Object.values(tabs).forEach((tab) => {
        tab.style.display = 'none';
        // Remove any transition classes
        tab.classList.remove('tab-fade-in', 'tab-fade-out');
    });

    // Show target tab with fade effect
    tabs[tabName].style.display = 'block';
    tabs[tabName].classList.add('tab-fade-in');
    currentTab = tabName;

    // Handle logs viewer
    if (tabName === 'logsViewer') {
        startLogsViewer();
    } else {
        stopLogsViewer();
    }
};

// Reset main menu buttons to their original state
const resetMainMenuButtons = () => {
    const mainButtons = main.querySelectorAll('button');
    mainButtons.forEach(button => {
        // Remove any loading or disabled states
        button.disabled = false;
        button.classList.remove('loading', 'success-feedback', 'error-feedback');

        // Reset button content if it was modified
        const originalContent = {
            'openManageUsers': '<img src="icons/manageUsers.svg" alt="">Manage Users',
            'openAddTemplate': '<img src="icons/addTemplate.svg" alt="">Add Template',
            'openManageTemplates': '<img src="icons/manageTemplates.svg" alt="">Manage Templates',
            'openLogsViewer': '<img src="icons/code.svg" alt="">View Logs',
            'openSettings': '<img src="icons/settings.svg" alt="">Settings'
        };

        const buttonId = button.id;
        if (originalContent[buttonId]) {
            button.innerHTML = originalContent[buttonId];
        }
    });
};


function startLogsViewer() {
    logsMode = 'logs';
    logsContainer.innerHTML = '<span class="logs-placeholder">Connecting to log stream...</span>';
    connectLogsWs();
}

function stopLogsViewer() {
    if (logsWs) {
        logsWs.close();
        logsWs = null;
    }
}

function connectLogsWs() {
    if (logsWs) logsWs.close();
    logsContainer.innerHTML = '<span class="logs-placeholder">Connecting to log stream...</span>';
    let url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws-logs?type=' + logsMode;
    logsWs = new WebSocket(url);
    logsContainer.innerHTML = '';
    allLogLines = [];
    logsWs.onopen = () => {
        logsContainer.innerHTML = '<span class="logs-placeholder">Waiting for logs...</span>';
    };
    logsWs.onmessage = (event) => {
        if (logsContainer.querySelector('.logs-placeholder')) logsContainer.innerHTML = '';
        // If first message is JSON, treat as initial log dump
        try {
            const data = JSON.parse(event.data);
            if (Array.isArray(data.initial)) {
                allLogLines = data.initial.slice(-MAX_LOG_LINES);
                renderLogsSoon();
                return;
            }
        } catch {}
        allLogLines.push(event.data);
        if (allLogLines.length > MAX_LOG_LINES) {
            allLogLines.splice(0, allLogLines.length - MAX_LOG_LINES);
        }
        renderLogsSoon();
    };
    logsWs.onerror = () => {
        logsContainer.innerHTML = '<span class="logs-placeholder">WebSocket error. Try refreshing.</span>';
    };
    logsWs.onclose = () => {
        logsContainer.innerHTML += '<span class="logs-placeholder">Log stream closed.</span>';
    };
}

function getFilteredLogs() {
    let filtered = allLogLines;
    const currentFilterType = filterType;
    const currentFilterText = filterText;

    if (currentFilterType) {
        filtered = filtered.filter(line => {
            if (currentFilterType === 'error') return /error|fail|exception|critical|\bERR\b|\bSRV_ERR\b/i.test(line);
            if (currentFilterType === 'warn') return /warn|deprecated|slow|timeout/i.test(line);
            if (currentFilterType === 'success') return /success|started|running|ok|ready|listening|connected/i.test(line);
            if (currentFilterType === 'info') return /info|log|notice|\bOK\b/i.test(line);
            return true;
        });
    }
    if (currentFilterText) {
        const f = currentFilterText.toLowerCase();
        filtered = filtered.filter(line => line.toLowerCase().includes(f));
    }
    return filtered;
}

function renderFilteredLogs() {
    const filtered = getFilteredLogs();
    logsContainer.innerHTML = filtered.map(renderLogLines).join('\n');
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

if (logsSearchInput) {
    logsSearchInput.addEventListener('input', (e) => {
        filterText = e.target.value;
        renderFilteredLogs();
    });
}
if (logsTypeFilter) {
    logsTypeFilter.addEventListener('change', (e) => {
        filterType = e.target.value;
        renderFilteredLogs();
    });
}
if (logsExportBtn) {
    logsExportBtn.addEventListener('click', () => {
        const filtered = getFilteredLogs();
        // Redact user discriminator: (Name#12345678) => (Name#REDACTED)
        const redacted = filtered.map(line => line.replace(/\(([^#()]+)#\d{5,}\)/g, '($1#REDACTED)'));
        const blob = new Blob([redacted.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = logsMode + '-export.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
    });
}

function renderLogLines(text) {
    return text.split(/\r?\n/).filter(Boolean).map(line => {
        let cls = 'log-line';
        if (/error|fail|exception|critical|\bERR\b|\bSRV_ERR\b/i.test(line)) cls += ' error';
        else if (/warn|deprecated|slow|timeout/i.test(line)) cls += ' warn';
        else if (/success|started|running|ok|ready|listening|connected/i.test(line)) cls += ' success';
        else if (/info|log|notice|\bOK\b/i.test(line)) cls += ' info';
        return `<span class="${cls}">${escapeHtml(line)}</span>`;
    }).join('\n');
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(tag) {
        const charsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return charsToReplace[tag] || tag;
    });
}

openLogsViewer.addEventListener('click', () => changeTab('logsViewer'));
showLogsBtn.addEventListener('click', () => {
    logsMode = 'logs';
    logsContainer.innerHTML = '<span class="logs-placeholder">Switching to logs...</span>';
    connectLogsWs();
});
showErrorsBtn.addEventListener('click', () => {
    logsMode = 'errors';
    logsContainer.innerHTML = '<span class="logs-placeholder">Switching to errors...</span>';
    connectLogsWs();
});
clearLogsBtn.addEventListener('click', () => {
    allLogLines = [];
    logsContainer.innerHTML = '';
});

// --- Logs search/filter/export ---


// users
async function axiosGetWithRetry(url, attempts = 3, delayMs = 2000) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await axios.get(url);
        } catch (err) {
            const status = err?.response?.status;
            // Retry on 409 (busy) and 429 (rate limit)
            if (status === 409 || status === 429) {
                lastErr = err;
                if (i < attempts - 1) {
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
            }
            throw err;
        }
    }
    throw lastErr;
}
const loadUsers = async (f) => {
    try {
        const users = await axios.get('/users');
        if (f) f(users.data);
    } catch (error) {
        handleError(error);
    }
};

userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let jValue = jcookie.value.trim();

    if (!jValue) {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                jcookie.value = text;
                jValue = text.trim();
            }
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            showMessage('Clipboard Error', 'Could not read from clipboard. Please paste the cookie manually.');
            return;
        }
    }

    if (!jValue) {
        showMessage('Error', 'JWT Cookie (j) is required.');
        return;
    }

    try {
        const response = await axios.post('/user', { cookies: { s: scookie.value, j: jValue } });
        if (response.status === 200) {
            showMessage('Success', `Logged in as ${response.data.name} (#${response.data.id})!`);
            userForm.reset();
            openManageUsers.click(); // Refresh the view
        }
    } catch (error) {
        handleError(error);
    }
});

deleteBannedUsersBtn.addEventListener('click', async () => {
    try {
        const response = await axios.get('/users');
        const users = response.data;
        
        const bannedUsers = Object.entries(users).filter(([id, user]) => {
            return user.suspendedUntil && user.suspendedUntil > Date.now() + 3153600000000;
        });

        if (bannedUsers.length === 0) {
            showMessage('No Banned Accounts', 'No permanently banned accounts were found.');
            return;
        }

        const userListHtml = bannedUsers.map(([id, user]) => `<li>${escapeHtml(user.name)} (#${id})</li>`).join('');
        const confirmationMessage = `
            <p>Are you sure you want to delete the following ${bannedUsers.length} permanently banned account(s)?</p>
            <ul style="text-align: left; max-height: 150px; overflow-y: auto;">${userListHtml}</ul>
            <p>This action cannot be undone.</p>
        `;

        showConfirmation('Confirm Deletion', confirmationMessage, async () => {
            let successCount = 0;
            let failCount = 0;
            
            const deletionPromises = bannedUsers.map(([id, user]) => {
                return axios.delete(`/user/${id}`)
                    .then(() => {
                        successCount++;
                    })
                    .catch(err => {
                        failCount++;
                        console.error(`Failed to delete user ${id}:`, err);
                    });
            });

            await Promise.all(deletionPromises);

            showMessage('Deletion Complete', `Successfully deleted ${successCount} account(s).<br>${failCount > 0 ? `Failed to delete ${failCount} account(s). Check console for details.` : ''}`);
            openManageUsers.click(); // Refresh the user list
        }, true);

    } catch (error) {
        handleError(error);
    }
});

// Export and Import J Tokens functionality will be implemented later in the file

const colors = {
    '0,0,0': { id: 1, name: 'Black' },
    '60,60,60': { id: 2, name: 'Dark Gray' },
    '120,120,120': { id: 3, name: 'Gray' },
    '210,210,210': { id: 4, name: 'Light Gray' },
    '255,255,255': { id: 5, name: 'White' },
    '96,0,24': { id: 6, name: 'Dark Red' },
    '237,28,36': { id: 7, name: 'Red' },
    '255,127,39': { id: 8, name: 'Orange' },
    '246,170,9': { id: 9, name: 'Dark Orange' },
    '249,221,59': { id: 10, name: 'Yellow' },
    '255,250,188': { id: 11, name: 'Light Yellow' },
    '14,185,104': { id: 12, name: 'Green' },
    '19,230,123': { id: 13, name: 'Light Green' },
    '135,255,94': { id: 14, name: 'Bright Green' },
    '12,129,110': { id: 15, name: 'Teal' },
    '16,174,166': { id: 16, name: 'Cyan' },
    '19,225,190': { id: 17, name: 'Light Cyan' },
    '40,80,158': { id: 18, name: 'Dark Blue' },
    '64,147,228': { id: 19, name: 'Blue' },
    '96,247,242': { id: 20, name: 'Light Blue' },
    '107,80,246': { id: 21, name: 'Purple' },
    '153,177,251': { id: 22, name: 'Light Purple' },
    '120,12,153': { id: 23, name: 'Dark Purple' },
    '170,56,185': { id: 24, name: 'Magenta' },
    '224,159,249': { id: 25, name: 'Light Magenta' },
    '203,0,122': { id: 26, name: 'Dark Pink' },
    '236,31,128': { id: 27, name: 'Pink' },
    '243,141,169': { id: 28, name: 'Light Pink' },
    '104,70,52': { id: 29, name: 'Brown' },
    '149,104,42': { id: 30, name: 'Dark Brown' },
    '248,178,119': { id: 31, name: 'Tan' },
    '170,170,170': { id: 32, name: 'Medium Gray' },
    '165,14,30': { id: 33, name: 'Maroon' },
    '250,128,114': { id: 34, name: 'Salmon' },
    '228,92,26': { id: 35, name: 'Red Orange' },
    '214,181,148': { id: 36, name: 'Beige' },
    '156,132,49': { id: 37, name: 'Olive' },
    '197,173,49': { id: 38, name: 'Yellow Green' },
    '232,212,95': { id: 39, name: 'Pale Yellow' },
    '74,107,58': { id: 40, name: 'Forest Green' },
    '90,148,74': { id: 41, name: 'Moss Green' },
    '132,197,115': { id: 42, name: 'Mint Green' },
    '15,121,159': { id: 43, name: 'Steel Blue' },
    '187,250,242': { id: 44, name: 'Aqua' },
    '125,199,255': { id: 45, name: 'Sky Blue' },
    '77,49,184': { id: 46, name: 'Indigo' },
    '74,66,132': { id: 47, name: 'Navy Blue' },
    '122,113,196': { id: 48, name: 'Slate Blue' },
    '181,174,241': { id: 49, name: 'Periwinkle' },
    '219,164,99': { id: 50, name: 'Peach' },
    '209,128,81': { id: 51, name: 'Bronze' },
    '255,197,165': { id: 52, name: 'Light Peach' },
    '155,82,73': { id: 53, name: 'Rust' },
    '209,128,120': { id: 54, name: 'Rose' },
    '250,182,164': { id: 55, name: 'Blush' },
    '123,99,82': { id: 56, name: 'Coffee' },
    '156,132,107': { id: 57, name: 'Taupe' },
    '51,57,65': { id: 58, name: 'Charcoal' },
    '109,117,141': { id: 59, name: 'Slate' },
    '179,185,209': { id: 60, name: 'Lavender' },
    '109,100,63': { id: 61, name: 'Khaki' },
    '148,140,107': { id: 62, name: 'Sand' },
    '205,197,158': { id: 63, name: 'Cream' },
};

// --- Palette caches for performance ---
const ID_TO_RGB = new Map(); // id -> [r,g,b]
let PALETTE_ENTRIES = []; // {r,g,b,id,rgbStr}
const closestCache = new Map(); // 'r,g,b' -> nearest 'r,g,b'

function buildPaletteCaches() {
    ID_TO_RGB.clear();
    PALETTE_ENTRIES = [];
    for (const [rgbStr, info] of Object.entries(colors)) {
        const [r, g, b] = rgbStr.split(',').map(Number);
        PALETTE_ENTRIES.push({ r, g, b, id: info.id, rgbStr });
        ID_TO_RGB.set(info.id, [r, g, b]);
    }
    closestCache.clear();
}

async function syncPalette() {
    try {
        const r = await fetch('/palette');
        if (!r.ok) return;
        const data = await r.json();
        if (data && Array.isArray(data.colors)) {
            const merged = {};
            for (const c of data.colors) {
                if (!c || typeof c.rgb !== 'string' || !Number.isInteger(c.id)) continue;
                merged[c.rgb] = { id: c.id, name: c.name || (colors[c.rgb]?.name || `Color ${c.id}`) };
            }
            Object.assign(colors, merged);
            buildPaletteCaches();
        }
    } catch (e) {
        console.debug('palette sync skipped:', e?.message || e);
    }
}

buildPaletteCaches();
syncPalette();

const colorById = (id) => Object.keys(colors).find((key) => colors[key].id === id);
const closest = (color) => {
    const cached = closestCache.get(color);
    if (cached) return cached;
    const [tr, tg, tb] = color.split(',').map(Number);
    let bestKey = PALETTE_ENTRIES.length ? PALETTE_ENTRIES[0].rgbStr : color;
    let best = Infinity;
    for (const p of PALETTE_ENTRIES) {
        const dr = tr - p.r, dg = tg - p.g, db = tb - p.b;
        const d = dr * dr + dg * dg + db * db;
        if (d < best) { best = d; bestKey = p.rgbStr; }
    }
    closestCache.set(color, bestKey);
    return bestKey;
};

const drawTemplate = (template, canvas) => {
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, template.width, template.height);

    const imageData = new ImageData(template.width, template.height);

    for (let x = 0; x < template.width; x++) {
        for (let y = 0; y < template.height; y++) {
            const color = template.data[x][y];
            if (color === 0) continue;

            const i = (y * template.width + x) * 4;

            if (color === -1) {
                // keep your sentinel behavior
                imageData.data[i] = 158;
                imageData.data[i + 1] = 189;
                imageData.data[i + 2] = 255;
                imageData.data[i + 3] = 255;
                continue;
            }

            const rgbArr = ID_TO_RGB.get(color);
            if (!rgbArr) continue;
            const [r, g, b] = rgbArr;
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
};

const loadTemplates = async (f) => {
    try {
        const templates = await axios.get('/templates');
        if (f) f(templates.data);
    } catch (error) {
        handleError(error);
    }
};

const fetchCanvas = async (txVal, tyVal, pxVal, pyVal, width, height) => {
    const TILE_SIZE = 1000;
    const radius = Math.max(0, parseInt(previewBorder.value, 10) || 0);

    const startX = txVal * TILE_SIZE + pxVal - radius;
    const startY = tyVal * TILE_SIZE + pyVal - radius;
    const displayWidth = width + radius * 2;
    const displayHeight = height + radius * 2;
    const endX = startX + displayWidth;
    const endY = startY + displayHeight;

    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    const endTileX = Math.floor((endX - 1) / TILE_SIZE);
    const endTileY = Math.floor((endY - 1) / TILE_SIZE);

    previewCanvas.width = displayWidth;
    previewCanvas.height = displayHeight;
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    for (let txi = startTileX; txi <= endTileX; txi++) {
        for (let tyi = startTileY; tyi <= endTileY; tyi++) {
            try {
                const res = await fetch(`/canvas?tx=${txi}&ty=${tyi}`);
                if (!res.ok) throw new Error(`Canvas tile fetch failed: ${res.status}`);
                const blob = await res.blob();
                const img = new Image();
                const objectUrl = URL.createObjectURL(blob);
                img.src = objectUrl;
                await img.decode();
                const sx = txi === startTileX ? startX - txi * TILE_SIZE : 0;
                const sy = tyi === startTileY ? startY - tyi * TILE_SIZE : 0;
                const ex = txi === endTileX ? endX - txi * TILE_SIZE : TILE_SIZE;
                const ey = tyi === endTileY ? endY - tyi * TILE_SIZE : TILE_SIZE;
                const sw = ex - sx;
                const sh = ey - sy;
                const dx = txi * TILE_SIZE + sx - startX;
                const dy = tyi * TILE_SIZE + sy - startY;
                ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
                URL.revokeObjectURL(objectUrl);
            } catch (error) {
                handleError(error);
                return;
            }
        }
    }

    const baseImage = ctx.getImageData(0, 0, displayWidth, displayHeight);
    const templateCtx = templateCanvas.getContext('2d');
    const templateImage = templateCtx.getImageData(0, 0, width, height);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(templateCanvas, radius, radius);
    ctx.globalAlpha = 1;
    const b = baseImage.data;
    const t = templateImage.data;
    for (let i = 0; i < t.length; i += 4) {
        if (t[i + 3] === 0) continue;

        const templateIdx = i / 4;
        const templateX = templateIdx % width;
        const templateY = Math.floor(templateIdx / width);
        const canvasX = templateX + radius;
        const canvasY = templateY + radius;
        const canvasIdx = (canvasY * displayWidth + canvasX) * 4;

        if (b[canvasIdx + 3] === 0) continue;

        ctx.fillStyle = 'rgba(255,0,0,0.8)';
        ctx.fillRect(canvasX, canvasY, 1, 1);
    }
    previewCanvas.style.display = 'block';
};

const nearestimgdecoder = (imageData, width, height) => {
    const d = imageData.data;
    const matrix = Array.from({ length: width }, () => Array(height).fill(0));
    const uniqueColors = new Set();
    let ink = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const a = d[i + 3];
            if (a === 255) {
                const r = d[i],
                    g = d[i + 1],
                    b = d[i + 2];
                const rgb = `${r},${g},${b}`;
                if (rgb == '158,189,255') {
                    matrix[x][y] = -1;
                } else {
                    const colorObj = colors[rgb] || colors[closest(rgb)];
                    if (colorObj) {
                        matrix[x][y] = colorObj.id;
                        uniqueColors.add(colorObj.id);
                    } else {
                        matrix[x][y] = 0; // fallback if not found
                    }
                }
                ink++;
            } else {
                matrix[x][y] = 0;
            }
        }
    }
    return { matrix, ink, uniqueColors };
};

const processImageFile = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const image = new Image();
        image.src = e.target.result;
        image.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const { matrix, ink , uniqueColors } = nearestimgdecoder(imageData, canvas.width, canvas.height);

            const filteredColors = Array.from(uniqueColors).filter(id => id !== 0 && id !== -1);

            const template = {
                width: canvas.width,
                height: canvas.height,
                ink,
                data: matrix,
                uniqueColors: filteredColors
            };

            canvas.remove();
            callback(template);
        };
    };
    reader.readAsDataURL(file);
};

const processEvent = () => {
    const file = convertInput.files[0];
    if (file) {
        templateName.value = file.name.replace(/\.[^/.]+$/, '');
        processImageFile(file, (template) => {
            currentTemplate = template;
            drawTemplate(template, templateCanvas);
            size.innerHTML = `${template.width}x${template.height}px`;
            ink.innerHTML = template.ink;
            templateCanvas.style.display = 'block';
            previewCanvas.style.display = 'none';
            details.style.display = 'block';

            // Update the color grid to show only colors in this image
            if (template.uniqueColors && template.uniqueColors.length > 0) {
                // Clear current available colors and set to image colors
                availableColors.clear();
                template.uniqueColors.forEach(colorId => availableColors.add(colorId));
                
                // Update the color grid with image-specific colors
                updateColorGridForImage(template.uniqueColors);
                
            } else {
                // Fallback to all colors if no unique colors found
                console.warn('No unique colors found in image, showing all colors');
                availableColors = new Set(Object.values(colors).map(c => c.id));
                resetOrder();
            }
        });
    }
};

convertInput.addEventListener('change', processEvent);

previewCanvasButton.addEventListener('click', async () => {
    const txVal = parseInt(tx.value, 10);
    const tyVal = parseInt(ty.value, 10);
    const pxVal = parseInt(px.value, 10);
    const pyVal = parseInt(py.value, 10);
    if (isNaN(txVal) || isNaN(tyVal) || isNaN(pxVal) || isNaN(pyVal) || currentTemplate.width === 0) {
        showMessage('Error', 'Please convert an image and enter valid coordinates before previewing.');
        return;
    }
    await fetchCanvas(txVal, tyVal, pxVal, pyVal, currentTemplate.width, currentTemplate.height);
});

function pastePinCoordinates(text) {
    const patterns = [
        /Tl X:\s*(\d+),\s*Tl Y:\s*(\d+),\s*Px X:\s*(\d+),\s*Px Y:\s*(\d+)/,
        /^\s*(\d+)[\s,;]+(\d+)[\s,;]+(\d+)[\s,;]+(\d+)\s*$/,
    ];
    for (const p of patterns) {
        const match = p.exec(text);
        if (match) {
            $('tx').value = match[1];
            $('ty').value = match[2];
            $('px').value = match[3];
            $('py').value = match[4];
            return true;
        }
    }
    return false;
}

document.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text');
    if (text && pastePinCoordinates(text)) {
        e.preventDefault();
    }
});

canBuyMaxCharges.addEventListener('change', () => {
    if (canBuyMaxCharges.checked) {
        canBuyCharges.checked = false;
    }
});

canBuyCharges.addEventListener('change', () => {
    if (canBuyCharges.checked) {
        canBuyMaxCharges.checked = false;
    }
});

const resetTemplateForm = () => {
    templateForm.reset();
    templateFormTitle.textContent = 'Add Template';
    submitTemplate.innerHTML = '<img src="icons/addTemplate.svg">Add Template';
    delete templateForm.dataset.editId;
    details.style.display = 'none';
    previewCanvas.style.display = 'none';
    currentTemplate = { width: 0, height: 0, data: [] };

    currentTemplateId = null;
    availableColors.clear();
    initializeGrid(null);
};

templateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEditMode = !!templateForm.dataset.editId;
    if (!isEditMode && (!currentTemplate || currentTemplate.width === 0)) {
        showMessage('Error', 'Please convert an image before creating a template.');
        return;
    }
    const selectedUsers = Array.from(document.querySelectorAll('input[name="user_checkbox"]:checked')).map(
        (cb) => cb.value
    );
    if (selectedUsers.length === 0) {
        showMessage('Error', 'Please select at least one user.');
        return;
    }
    const data = {
        templateName: templateName.value,
        coords: [tx.value, ty.value, px.value, py.value].map(Number),
        userIds: selectedUsers,
        canBuyCharges: canBuyCharges.checked,
        canBuyMaxCharges: canBuyMaxCharges.checked,
        antiGriefMode: antiGriefMode.checked,
        eraseMode: eraseMode.checked,
        outlineMode: templateOutlineMode.checked,
        skipPaintedPixels: templateSkipPaintedPixels.checked,
        enableAutostart: enableAutostart.checked,
    };
    if (currentTemplate && currentTemplate.width > 0) {
        data.template = currentTemplate;
    }
    try {
        let templateId;
        let colorOrderSaved = false;
        
        if (isEditMode) {
            templateId = templateForm.dataset.editId;
            await axios.put(`/template/edit/${templateId}`, data);
            // Save the color ordering for this template
            colorOrderSaved = await saveColorOrder(templateId);
            showMessage('Success', 'Template updated!');
        } else {
            const response = await axios.post('/template', data);
            templateId = response.data.id;
            // Save the color ordering for this template
            colorOrderSaved = await saveColorOrder(templateId);
            showMessage('Success', 'Template created!');
        }
        
        resetTemplateForm();
        openManageTemplates.click();
    } catch (error) {
        handleError(error);
    }
});

startAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: true });
        } catch (error) {
            handleError(error);
        }
    }
    showMessage('Success', 'Finished! Check console for details.');
    openManageTemplates.click();
});

stopAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: false });
        } catch (error) {
            handleError(error);
        }
    }
    showMessage('Success', 'Finished! Check console for details.');
    openManageTemplates.click();
});

// Export J tokens to a text file
const exportJTokens = document.getElementById('exportJTokens');
const importJTokens = document.getElementById('importJTokens');
const importJTokensInput = document.getElementById('importJTokensInput');

exportJTokens.addEventListener('click', async () => {
    try {
        const response = await axios.get('/users');
        const users = response.data;
        
        // Create a text file with one J token per line
        let tokenText = '';
        let tokenCount = 0;
        for (const id in users) {
            if (users[id].cookies?.j) {
                tokenText += users[id].cookies.j + '\n';
                tokenCount++;
            }
        }
        
        if (tokenCount === 0) {
            showMessage('Error', 'No valid J tokens found to export.');
            return;
        }
        
        // Create a download link
        const blob = new Blob([tokenText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'j_tokens.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('Success', `Exported ${tokenCount} J token(s) successfully!`);
    } catch (error) {
        handleError(error);
    }
});

importJTokens.addEventListener('click', () => {
    importJTokensInput.click();
});

importJTokensInput.addEventListener('change', async (event) => { //CREDITS - Motzumoto
    const file = event.target.files[0];
    if (!file) return;
    
    // Set busy state
    importJTokens.disabled = true;
    importJTokens.innerHTML = '<img src="icons/restart.svg" alt="" class="spin"> Importing...';
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target.result;
            // Improved parsing: trim lines, ignore comments, and deduplicate
            const lines = content.split('\n');
            const tokens = [];
            const uniqueTokens = new Set();
            
            for (let line of lines) {
                line = line.trim();
                // Skip empty lines and comments
                if (!line || line.startsWith('#')) continue;
                
                // Add to tokens if not already seen
                if (!uniqueTokens.has(line)) {
                    uniqueTokens.add(line);
                    tokens.push(line);
                }
            }
            
            if (tokens.length === 0) {
                showMessage('Error', 'No valid tokens found in the file.');
                importJTokens.disabled = false;
                importJTokens.innerHTML = '<img src="icons/upload.svg" alt="">Import J Tokens';
                return;
            }
            
            // Get existing users to filter out duplicates on client side
            const existingUsers = await axios.get('/users');
            const existingTokens = new Set();
            for (const userId in existingUsers.data) {
                if (existingUsers.data[userId].cookies?.j) {
                    existingTokens.add(existingUsers.data[userId].cookies.j);
                }
            }
            
            // Filter out tokens that already exist
            const newTokens = tokens.filter(token => !existingTokens.has(token));
            
            if (newTokens.length === 0) {
                showMessage('Warning', 'All tokens in the file already exist in the system.');
                importJTokens.disabled = false;
                importJTokens.innerHTML = '<img src="icons/upload.svg" alt="">Import J Tokens';
                return;
            }
            
            // Process tokens with concurrency control
            const MAX_CONCURRENT = 5; // Process 5 tokens at a time
            let processed = 0;
            let success = 0;
            let failed = 0;
            let skipped = tokens.length - newTokens.length;
            const errors = [];
            const addedUsers = [];
            
            // Helper function to run with limited concurrency
            const runWithConcurrency = async (items, workerFn, maxConcurrent) => {
                const results = [];
                const running = [];
                
                for (const item of items) {
                    const p = Promise.resolve().then(() => workerFn(item));
                    results.push(p);
                    
                    if (maxConcurrent <= items.length) {
                        const e = p.then(() => running.splice(running.indexOf(e), 1));
                        running.push(e);
                        if (running.length >= maxConcurrent) {
                            await Promise.race(running);
                        }
                    }
                }
                
                return Promise.all(results);
            };
            
            // Worker function to process each token
            const processToken = async (token) => {
                try {
                    const response = await axios.post('/users/import', { tokens: [token] });
                    processed++;
                    if (response.data.imported > 0) {
                        success++;
                        if (response.data.userData) {
                            addedUsers.push(`${response.data.userData.name}#${response.data.userData.id}`);
                        }
                    } else {
                        skipped++;
                    }
                } catch (error) {
                    processed++;
                    failed++;
                    errors.push(error.response?.data?.error || error.message);
                }
                
                // Update progress
                const progress = Math.round((processed / newTokens.length) * 100);
                importJTokens.innerHTML = `<img src="icons/restart.svg" alt="" class="spin"> Importing (${progress}%)...`;
            };
            
            // Show confirmation with more details
            showConfirmation(
                'Import J Tokens',
                `Found ${tokens.length} tokens in the file (${skipped} duplicates detected).<br>Do you want to import ${newTokens.length} new tokens?`,
                async () => {
                    try {
                        await runWithConcurrency(newTokens, processToken, MAX_CONCURRENT);
                        
                        // Generate summary
                        let summary = `<b>Import Summary:</b><br>`;
                        summary += `- Input lines: ${lines.length}<br>`;
                        summary += `- Unique tokens: ${tokens.length}<br>`;
                        summary += `- Processed: ${processed}<br>`;
                        summary += `- Success: ${success}<br>`;
                        summary += `- Failed: ${failed}<br>`;
                        summary += `- Skipped: ${skipped}<br>`;
                        
                        if (addedUsers.length > 0) {
                            summary += `<br><b>Added users:</b><br>`;
                            summary += addedUsers.map(u => `- ${u}`).join('<br>');
                        }
                        
                        if (errors.length > 0) {
                            summary += `<br><b>Errors:</b><br>`;
                            summary += errors.slice(0, 5).map(e => `- ${e}`).join('<br>');
                            if (errors.length > 5) {
                                summary += `<br>- ...and ${errors.length - 5} more errors`;
                            }
                        }
                        
                        showMessage('Import Complete', summary);
                        openManageUsers.click(); // Refresh the user list
                    } catch (error) {
                        handleError(error);
                    } finally {
                        importJTokens.disabled = false;
                        importJTokens.innerHTML = '<img src="icons/upload.svg" alt="">Import J Tokens';
                    }
                },
                true,
                () => {
                    // Cancel action
                    importJTokens.disabled = false;
                    importJTokens.innerHTML = '<img src="icons/upload.svg" alt="">Import J Tokens';
                }
            );
        } catch (error) {
            handleError(error);
            importJTokens.disabled = false;
            importJTokens.innerHTML = '<img src="icons/upload.svg" alt="">Import J Tokens';
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset the input
});

openManageUsers.addEventListener('click', () => {
    // Add loading state to button
    const button = openManageUsers;
    const originalContent = button.innerHTML;
    button.innerHTML = '<img src="icons/restart.svg" alt="" class="spin"> Loading...';
    button.disabled = true;

    userList.innerHTML = '';
    userForm.reset();
    totalCharges.textContent = '?';
    totalMaxCharges.textContent = '?';
    totalDroplets.textContent = '?';
    totalPPH.textContent = '?';
    loadUsers((users) => {
        const userCount = Object.keys(users).length;
        manageUsersTitle.textContent = `Existing Users (${userCount})`;
        
        // Calculate totals for all users
        let totalChargesCount = 0;
        let totalMaxChargesCount = 0;
        let totalDropletsCount = 0;
        let totalPixelsPerHour = 0;
        
        for (const id of Object.keys(users)) {
            const user = document.createElement('div');
            user.className = 'user';
            user.id = `user-${id}`;

            const safeName = escapeHtml(String(users[id].name));
            
            // Get pixel data from cache if available
            const pixelData = users[id].pixels;
            const chargeCount = pixelData ? pixelData.count : '?';
            const chargeMax = pixelData ? pixelData.max : '?';
            const percentage = pixelData ? pixelData.percentage.toFixed(1) : '?';
            const isExtrapolated = pixelData?.isExtrapolated ? ' (est)' : '';
            
            // Add to totals if data is available
            if (pixelData) {
                totalChargesCount += pixelData.count;
                totalMaxChargesCount += pixelData.max;
                // Calculate pixels per hour (PPH) - 1 pixel every 30 seconds when charges available
                const pph = pixelData.count > 0 ? 120 : 0; // Only count accounts with charges
                totalPixelsPerHour += pph;
            }
            
            // Get droplets if available
            const droplets = users[id].droplets || '?';
            if (droplets !== '?') {
                totalDropletsCount += droplets;
            }
            
            user.innerHTML = `
                <div class="user-info">
                    <span>${safeName}</span>
                    <span>(#${id})</span>
                    <div class="user-stats">
                        Charges: <b>${chargeCount}</b>/<b>${chargeMax}</b> | Level <b>?</b> <span class="level-progress">(${percentage}%${isExtrapolated})</span><br>
                        Droplets: <b>${droplets}</b>
                    </div>
                </div>
                <div class="user-card-actions">
                    <button class="delete-btn" title="Delete User"><img src="icons/remove.svg"></button>
                    <button class="info-btn" title="Get User Info"><img src="icons/code.svg"></button>
                </div>`;

            user.querySelector('.delete-btn').addEventListener('click', () => {
                showConfirmation(
                    'Delete User',
                    `Are you sure you want to delete ${safeName} (#${id})? This will also remove them from all templates.`,
                    async () => {
                        try {
                            await axios.delete(`/user/${id}`);
                            showMessage('Success', 'User deleted.');
                            openManageUsers.click();
                        } catch (error) {
                            handleError(error);
                        }
                    },
                    true
                );
            });

            user.querySelector('.info-btn').addEventListener('click', async () => {
                try {
                    const response = await axiosGetWithRetry(`/user/status/${id}`, 3, 2000);
                    let { status: isBanned, until } = response.data.ban;
                    let info;
                    if (isBanned == true) {
                        if (until == Number.MAX_SAFE_INTEGER)
                            until = "FOREVER";
                        else
                            until = new Date(until);

                        const safeBannedName = escapeHtml(String(response.data.name));
                        const safeUntil = escapeHtml(String(until));
                        info = `
                        User <b><span style="color: #f97a1f;">${safeBannedName}</span></b> has been <span style="color: #b91919ff;">banned!</span><br>
                        <b>Banned until:</n> <span style="color: #f97a1f;">${safeUntil}</span><br>
                        <br>Would you like to remove the <b>account</b> from the user list?
                        `
                    } else
                        info = `
                        <b>User Name:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.name))}</span><br>
                        <b>Charges:</b> <span style="color: #f97a1f;">${Math.floor(response.data.charges.count)}</span>/<span style="color: #f97a1f;">${response.data.charges.max}</span><br>
                        <b>Droplets:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.droplets))}</span><br>
                        <b>Favorite Locations:</b> <span style="color: #f97a1f;">${response.data.favoriteLocations.length}</span>/<span style="color: #f97a1f;">${response.data.maxFavoriteLocations}</span><br>
                        <b>Flag Equipped:</b> <span style="color: #f97a1f;">${response.data.equippedFlag ? 'Yes' : 'No'}</span><br>
                        <b>Discord:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.discord))}</span><br>
                        <b>Country:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.country))}</span><br>
                        <b>Pixels Painted:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.pixelsPainted))}</span><br>
                        <b>Extra Colors:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.extraColorsBitmap))}</span><br>
                        <b>Alliance ID:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.allianceId))}</span><br>
                        <b>Alliance Role:</b> <span style="color: #f97a1f;">${escapeHtml(String(response.data.allianceRole))}</span><br>
                        <br>Would you like to copy the <b>Raw Json</b> to your clipboard?
                        `;

                    showConfirmation('User Info', info, () => {
                        if (isBanned) user.querySelector('.delete-btn').click();
                        else navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
                    }, !isBanned);
                } catch (error) {
                    handleError(error);
                }
            });
            userList.appendChild(user);
        }
        
        // Update the totals display after processing all users
        totalCharges.textContent = totalChargesCount.toFixed(0);
        totalMaxCharges.textContent = totalMaxChargesCount.toFixed(0);
        totalDroplets.textContent = totalDropletsCount.toFixed(0);
        totalPPH.textContent = totalPixelsPerHour.toFixed(1);

        // Reset button state
        button.innerHTML = originalContent;
        button.disabled = false;
    });
    changeTab('manageUsers');
});

checkUserStatus.addEventListener('click', async () => {
    checkUserStatus.disabled = true;
    checkUserStatus.innerHTML = 'Checking...';
    const userElements = Array.from(document.querySelectorAll('.user'));

    userElements.forEach((userEl) => {
        const infoSpans = userEl.querySelectorAll('.user-info > span');
        infoSpans.forEach((span) => (span.style.color = 'var(--warning-color)'));
    });

    let totalCurrent = 0;
    let totalMax = 0;
    let totalDropletsCount = 0;
    let successfulAccounts = 0;

    try {
        const response = await axios.post('/users/status');
        const statuses = response.data;

        for (const userEl of userElements) {
            const id = userEl.id.split('-')[1];
            const status = statuses[id];

            const infoSpans = userEl.querySelectorAll('.user-info > span');
            const currentChargesEl = userEl.querySelector('.user-stats b:nth-of-type(1)');
            const maxChargesEl = userEl.querySelector('.user-stats b:nth-of-type(2)');
            const currentLevelEl = userEl.querySelector('.user-stats b:nth-of-type(3)');
            const dropletsEl = userEl.querySelector('.user-stats b:nth-of-type(4)');
            const levelProgressEl = userEl.querySelector('.level-progress');

            if (status && status.success && status.data.ban.status == false) {
                const userInfo = status.data;
                const charges = Math.floor(userInfo.charges.count);
                const max = userInfo.charges.max;
                const level = Math.floor(userInfo.level);
                const progress = Math.round((userInfo.level % 1) * 100);

                currentChargesEl.textContent = charges;
                maxChargesEl.textContent = max;
                currentLevelEl.textContent = level;
                dropletsEl.textContent = userInfo.droplets.toLocaleString();
                levelProgressEl.textContent = `(${progress}%)`;
                totalCurrent += charges;
                totalMax += max;
                totalDropletsCount += userInfo.droplets;
                successfulAccounts++;

                infoSpans.forEach((span) => (span.style.color = 'var(--success-color)'));
            } else {
                currentChargesEl.textContent = 'ERR';
                maxChargesEl.textContent = 'ERR';
                currentLevelEl.textContent = '?';
                dropletsEl.textContent = 'ERR';
                levelProgressEl.textContent = '(?%)';
                infoSpans.forEach((span) => (span.style.color = 'var(--error-color)'));
            }
        }
    } catch (error) {
        handleError(error);
        userElements.forEach((userEl) => {
            const infoSpans = userEl.querySelectorAll('.user-info > span');
            infoSpans.forEach((span) => (span.style.color = 'var(--error-color)'));
        });
    }

    totalCharges.textContent = totalCurrent;
    totalMaxCharges.textContent = totalMax;
    totalDroplets.textContent = totalDropletsCount.toLocaleString();
    const pph = successfulAccounts * 120; // 1 pixel per 30s = 2 per min = 120 per hour
    totalPPH.textContent = pph.toLocaleString();

    checkUserStatus.disabled = false;
    checkUserStatus.innerHTML = '<img src="icons/check.svg">Check Account Status';
});

openAddTemplate.addEventListener('click', () => {
    // Add loading state
    const button = openAddTemplate;
    const originalContent = button.innerHTML;
    button.innerHTML = '<img src="icons/restart.svg" alt="" class="spin"> Loading...';
    button.disabled = true;

    resetTemplateForm();
    userSelectList.innerHTML = '';
    loadUsers((users) => {
        if (Object.keys(users).length === 0) {
            userSelectList.innerHTML = '<span>No users added. Please add a user first.</span>';
            return;
        }
        for (const id of Object.keys(users)) {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-select-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `user_${id}`;
            checkbox.name = 'user_checkbox';
            checkbox.value = id;
            const label = document.createElement('label');
            label.htmlFor = `user_${id}`;
            label.textContent = `${users[id].name} (#${id})`;
            userDiv.appendChild(checkbox);
            userDiv.appendChild(label);
            userSelectList.appendChild(userDiv);
        }

        // Reset button state
        button.innerHTML = originalContent;
        button.disabled = false;
    });

    changeTab('addTemplate');
});

selectAllUsers.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#userSelectList input[type="checkbox"]');
    if (checkboxes.length === 0) return;

    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    const targetState = !allSelected;
    checkboxes.forEach(cb => cb.checked = targetState);
});

const createToggleButton = (template, id, buttonsContainer, progressBarText, currentPercent) => {
    const button = document.createElement('button');
    button.className = template.running ? 'destructive-button' : 'primary-button';
    button.innerHTML = `<img src="icons/${template.running ? 'pause' : 'play'}.svg">${template.running ? 'Stop' : 'Start'}`;

    button.addEventListener('click', async (event) => {
        event.preventDefault();
        const shouldBeRunning = !template.running;
        try {
            await axios.put(`/template/${id}`, { running: shouldBeRunning });
            template.running = shouldBeRunning;

            // Update button appearance
            button.className = template.running ? 'destructive-button' : 'primary-button';
            button.innerHTML = `<img src="icons/${template.running ? 'pause' : 'play'}.svg">${template.running ? 'Stop' : 'Start'}`;

            // Update progress bar
            const newStatus = template.running ? 'Started' : 'Stopped';
            progressBarText.textContent = `${currentPercent}% | ${newStatus}`;
            const progressBar = progressBarText.previousElementSibling;
            progressBar.classList.toggle('stopped', !template.running);
        } catch (error) {
            handleError(error);
        }
    });
    return button;
};

const updateTemplateStatus = async () => {
    try {
        const { data: templates } = await axios.get('/templates');
        for (const id in templates) {
            const t = templates[id];
            const templateElement = $(id);
            if (!templateElement) continue;

            const total = t.totalPixels || 1;
            const remaining = t.pixelsRemaining !== null ? t.pixelsRemaining : total;
            const completed = total - remaining;
            const percent = Math.floor((completed / total) * 100);

            const progressBar = templateElement.querySelector('.progress-bar');
            const progressBarText = templateElement.querySelector('.progress-bar-text');
            const pixelCountSpan = templateElement.querySelector('.pixel-count');

            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressBarText) progressBarText.textContent = `${percent}% | ${t.status}`;
            if (pixelCountSpan) pixelCountSpan.textContent = `${completed} / ${total}`;

            if (t.status === 'Finished.') {
                progressBar.classList.add('finished');
                progressBar.classList.remove('stopped');
            } else if (!t.running) {
                progressBar.classList.add('stopped');
                progressBar.classList.remove('finished');
            } else {
                progressBar.classList.remove('stopped', 'finished');
            }
        }
    } catch (error) {
        console.error('Failed to update template statuses:', error);
    }
};

const createTemplateCard = (t, id) => {
    const total = t.totalPixels || 1;
    const remaining = t.pixelsRemaining != null ? t.pixelsRemaining : total;
    const completed = total - remaining;
    const percent = Math.floor((completed / total) * 100);

    const card = document.createElement('div');
    card.id = id;
    card.className = 'template';

    // Header: Name and Pixels
    const info = document.createElement('div');
    info.className = 'template-info';
    info.innerHTML = `
        <span><b>Name:</b> <span class="template-data">${t.name}</span></span>
        <span><b>Pixels:</b> <span class="template-data pixel-count">${completed} / ${total}</span></span>
    `;
    card.appendChild(info);

    // Progress Bar
    const pc = document.createElement('div');
    pc.className = 'progress-bar-container';
    const pb = document.createElement('div');
    pb.className = 'progress-bar';
    pb.style.width = `${percent}%`;
    const pbt = document.createElement('span');
    pbt.className = 'progress-bar-text';
    pbt.textContent = `${percent}% | ${t.status}`;
    if (t.status === 'Finished.') pb.classList.add('finished');
    else if (!t.running) pb.classList.add('stopped');
    pc.append(pb, pbt);
    card.appendChild(pc);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'template-actions';
    actions.appendChild(createToggleButton(t, id, actions, pbt, percent));

    const shareBtn = document.createElement('button');
    shareBtn.className = 'secondary-button';
    shareBtn.innerHTML = '<img src="icons/open.svg">Share';
    shareBtn.addEventListener('click', async () => {
        if (!t.template.shareCode) {
            showMessage('Error', 'No share code available for this template.');
            return;
        }
        await navigator.clipboard.writeText(t.template.shareCode);
        showMessage('Copied!', 'Share code copied to clipboard.');
    });
    actions.appendChild(shareBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'secondary-button';
    editBtn.innerHTML = '<img src="icons/settings.svg">Edit';
    editBtn.addEventListener('click', () => {
        openAddTemplate.click();
        templateFormTitle.textContent = `Edit Template: ${t.name}`;
        submitTemplate.innerHTML = '<img src="icons/edit.svg">Save Changes';
        templateForm.dataset.editId = id;
        templateName.value = t.name;
        [tx.value, ty.value, px.value, py.value] = t.coords;
        canBuyCharges.checked = t.canBuyCharges;
        canBuyMaxCharges.checked = t.canBuyMaxCharges;
        antiGriefMode.checked = t.antiGriefMode;
        eraseMode.checked = t.eraseMode;
        templateOutlineMode.checked = t.outlineMode;
        templateSkipPaintedPixels.checked = t.skipPaintedPixels;
        enableAutostart.checked = t.enableAutostart;
        
        // Load template image and preview
        currentTemplate = t.template;
        drawTemplate(t.template, templateCanvas);
        size.innerHTML = `${t.template.width}x${t.template.height}px`;
        ink.innerHTML = t.template.data.flat().filter(color => color !== 0).length;
        templateCanvas.style.display = 'block';
        details.style.display = 'block';
        
        setTimeout(() => {
            document.querySelectorAll('input[name="user_checkbox"]').forEach((cb) => {
                cb.checked = t.userIds.includes(cb.value);
            });

            // Load grid
            initializeGrid(id);
            
            // Update the color grid to show only colors in this template
            if (t.template && t.template.data) {
                // Get unique colors from template data
                const uniqueColors = new Set();
                for (let x = 0; x < t.template.width; x++) {
                    for (let y = 0; y < t.template.height; y++) {
                        const colorId = t.template.data[x][y];
                        if (colorId !== 0) uniqueColors.add(colorId);
                    }
                }
                
                // Update available colors
                availableColors.clear();
                uniqueColors.forEach(colorId => availableColors.add(colorId));
                
                // Update color grid
                if (uniqueColors.size > 0) {
                    updateColorGridForImage(Array.from(uniqueColors));
                }
            }
        }, 100);
    });
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'destructive-button';
    delBtn.innerHTML = '<img src="icons/remove.svg">Delete';
    delBtn.addEventListener('click', () => {
        showConfirmation('Delete Template', `Are you sure you want to delete "${t.name}"?`, async () => {
            try {
                await axios.delete(`/template/${id}`);
                openManageTemplates.click();
            } catch (e) {
                handleError(e);
            }
        }, true);
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);

    // Canvas Preview per card
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'template-canvas-preview';
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    card.appendChild(canvasContainer);
    drawTemplate(t.template, canvas);
    canvasContainer.style.display = showCanvasPreview ? '' : 'none';

    // Move the canvas preview toggle next to Import Share Code button (topBar)
    // Only add once, and only if topBar exists
    setTimeout(() => {
        const topBar = document.querySelector('.template-actions-all');
        if (topBar && !topBar.querySelector('#canvasPreviewToggleBtn')) {
            const previewToggleBtn = document.createElement('button');
            previewToggleBtn.id = 'canvasPreviewToggleBtn';
            previewToggleBtn.className = 'secondary-button';
            previewToggleBtn.style.marginLeft = '10px';

            const updateBtnTextAndIcon = () => {
                previewToggleBtn.innerHTML = `<img src="icons/manageTemplates.svg" alt=""> ${showCanvasPreview ? 'Disable' : 'Enable'} Canvas Previews`;
            };
            updateBtnTextAndIcon();

            previewToggleBtn.addEventListener('click', () => {
                showCanvasPreview = !showCanvasPreview;
                updateBtnTextAndIcon();
                document.querySelectorAll('.template-canvas-preview').forEach(el => {
                    el.style.display = showCanvasPreview ? '' : 'none';
                });
            });
            // Insert after Import Share Code button
            const importBtn = topBar.querySelector('button');
            if (importBtn) {
                topBar.insertBefore(previewToggleBtn, importBtn.lastChild.nextSibling);
            } else {
                topBar.appendChild(previewToggleBtn);
            }
        }
    }, 0);

    return card;
};

let importShareCode = false;
openManageTemplates.addEventListener('click', () => {
    // Add loading state
    const button = openManageTemplates;
    const originalContent = button.innerHTML;
    button.innerHTML = '<img src="icons/restart.svg" alt="" class="spin"> Loading...';
    button.disabled = true;

    templateList.innerHTML = '';
    if (templateUpdateInterval) clearInterval(templateUpdateInterval);

    if (!importShareCode) {
        const topBar = document.createElement('div');
        topBar.className = 'template-actions-all';
        const importBtnTop = document.createElement('button');
        importBtnTop.className = 'secondary-button';
        importBtnTop.innerHTML = '<img src="icons/addTemplate.svg">Import Share Code';
        importBtnTop.style.marginBottom = '10px';
        importBtnTop.addEventListener('click', async () => {
            const code = prompt('Paste a share code:');
            if (!code) return;
            try {
                const genId = Date.now().toString();
                await axios.post('/templates/import', {
                    id: genId,
                    name: `Imported ${genId}`,
                    coords: [0, 0, 0, 0],
                    code,
                });
                showMessage('Success', 'Template imported successfully.');
                openManageTemplates.click();
            } catch (e) {
                handleError(e);
            }
        });
        topBar.appendChild(importBtnTop);
        templateList.before(topBar);
        importShareCode = true;
    }

    loadTemplates((templates) => {
        if (Object.keys(templates).length === 0) {
            templateList.innerHTML = '<span>No templates created yet.</span>';
            return;
        }
        for (const id in templates) {
            const card = createTemplateCard(templates[id], id);
            templateList.appendChild(card);
        }
        templateUpdateInterval = setInterval(updateTemplateStatus, 2000);

        // Reset button state
        button.innerHTML = originalContent;
        button.disabled = false;
    });

    changeTab('manageTemplates');
});

openSettings.addEventListener('click', async () => {
    // Add loading state
    const button = openSettings;
    const originalContent = button.innerHTML;
    button.innerHTML = '<img src="icons/restart.svg" alt="" class="spin"> Loading...';
    button.disabled = true;

    try {
        const response = await axios.get('/settings');
        const currentSettings = response.data;
        openBrowserOnStart.checked = currentSettings.openBrowserOnStart;
        drawingDirectionSelect.value = currentSettings.drawingDirection;
        drawingOrderSelect.value = currentSettings.drawingOrder;
        pixelSkipSelect.value = currentSettings.pixelSkip;

        proxyEnabled.checked = currentSettings.proxyEnabled;
        proxyRotationMode.value = currentSettings.proxyRotationMode || 'sequential';
        logProxyUsage.checked = currentSettings.logProxyUsage;
        proxyCount.textContent = `${currentSettings.proxyCount} proxies loaded from file.`;
        proxyFormContainer.style.display = proxyEnabled.checked ? 'block' : 'none';

        accountCooldown.value = currentSettings.accountCooldown / 1000;
        purchaseCooldown.value = currentSettings.purchaseCooldown / 1000;
        accountCheckCooldown.value = currentSettings.accountCheckCooldown / 1000;
        dropletReserve.value = currentSettings.dropletReserve;
        antiGriefStandby.value = currentSettings.antiGriefStandby / 60000;
        chargeThreshold.value = currentSettings.chargeThreshold * 100;
    } catch (error) {
        handleError(error);
    }

    // Reset button state
    button.innerHTML = originalContent;
    button.disabled = false;
    changeTab('settings');
});

const saveSetting = async (setting) => {
    try {
        await axios.put('/settings', setting);
        showMessage('Success', 'Setting saved!');
    } catch (error) {
        handleError(error);
    }
};

openBrowserOnStart.addEventListener('change', () => saveSetting({ openBrowserOnStart: openBrowserOnStart.checked }));
drawingDirectionSelect.addEventListener('change', () =>
    saveSetting({ drawingDirection: drawingDirectionSelect.value })
);
drawingOrderSelect.addEventListener('change', () => saveSetting({ drawingOrder: drawingOrderSelect.value }));
pixelSkipSelect.addEventListener('change', () => saveSetting({ pixelSkip: parseInt(pixelSkipSelect.value, 10) }));

proxyEnabled.addEventListener('change', () => {
    proxyFormContainer.style.display = proxyEnabled.checked ? 'block' : 'none';
    saveSetting({ proxyEnabled: proxyEnabled.checked });
});

logProxyUsage.addEventListener('change', () => {
    saveSetting({ logProxyUsage: logProxyUsage.checked });
});

proxyRotationMode.addEventListener('change', () => {
    saveSetting({ proxyRotationMode: proxyRotationMode.value });
});

reloadProxiesBtn.addEventListener('click', async () => {
    try {
        const response = await axios.post('/reload-proxies');
        if (response.data.success) {
            proxyCount.textContent = `${response.data.count} proxies reloaded from file.`;
            showMessage('Success', 'Proxies reloaded successfully!');
        }
    } catch (error) {
        handleError(error);
    }
});

accountCooldown.addEventListener('change', () => {
    const value = parseInt(accountCooldown.value, 10) * 1000;
    if (isNaN(value) || value < 0) {
        showMessage('Error', 'Please enter a valid non-negative number.');
        return;
    }
    saveSetting({ accountCooldown: value });
});

purchaseCooldown.addEventListener('change', () => {
    const value = parseInt(purchaseCooldown.value, 10) * 1000;
    if (isNaN(value) || value < 0) {
        showMessage('Error', 'Please enter a valid non-negative number.');
        return;
    }
    saveSetting({ purchaseCooldown: value });
});

accountCheckCooldown.addEventListener('change', () => {
    const value = parseInt(accountCheckCooldown.value, 10) * 1000;
    if (isNaN(value) || value < 0) {
        showMessage('Error', 'Please enter a valid non-negative number.');
        return;
    }
    saveSetting({ accountCheckCooldown: value });
});

dropletReserve.addEventListener('change', () => {
    const value = parseInt(dropletReserve.value, 10);
    if (isNaN(value) || value < 0) {
        showMessage('Error', 'Please enter a valid non-negative number.');
        return;
    }
    saveSetting({ dropletReserve: value });
});

antiGriefStandby.addEventListener('change', () => {
    const value = parseInt(antiGriefStandby.value, 10) * 60000;
    if (isNaN(value) || value < 60000) {
        showMessage('Error', 'Please enter a valid number (at least 1 minute).');
        return;
    }
    saveSetting({ antiGriefStandby: value });
});

chargeThreshold.addEventListener('change', () => {
    const value = parseInt(chargeThreshold.value, 10);
    if (isNaN(value) || value < 0 || value > 100) {
        showMessage('Error', 'Please enter a valid percentage between 0 and 100.');
        return;
    }
    saveSetting({ chargeThreshold: value / 100 });
});

tx.addEventListener('blur', () => {
    const value = tx.value.trim();
    const urlRegex = /pixel\/(\d+)\/(\d+)\?x=(\d+)&y=(\d+)/;
    const urlMatch = value.match(urlRegex);

    if (urlMatch) {
        tx.value = urlMatch[1];
        ty.value = urlMatch[2];
        px.value = urlMatch[3];
        py.value = urlMatch[4];
    } else {
        const parts = value.split(/\s+/);
        if (parts.length === 4) {
            tx.value = parts[0].replace(/[^0-9]/g, '');
            ty.value = parts[1].replace(/[^0-9]/g, '');
            px.value = parts[2].replace(/[^0-9]/g, '');
            py.value = parts[3].replace(/[^0-9]/g, '');
        } else {
            tx.value = value.replace(/[^0-9]/g, '');
        }
    }
});

[ty, px, py].forEach((input) => {
    input.addEventListener('blur', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});

// --- Color Ordering
const colorGrid = document.getElementById('colorGrid');
let currentTemplateId = null;
let availableColors = new Set();

// Single function handles all initialization
async function initializeGrid(templateId = null) {
    currentTemplateId = templateId;
    let colorEntries = Object.entries(colors);
    
    if (templateId) {
        try {
            const { colors: templateColors } = await (await fetch(`/template/${templateId}/colors`)).json();
            availableColors = new Set(templateColors.map(c => c.id));
            colorEntries = templateColors.map(c => [Object.keys(colors).find(rgb => colors[rgb].id === c.id), colors[Object.keys(colors).find(rgb => colors[rgb].id === c.id)]]).filter(([rgb]) => rgb);
        } catch {
            availableColors = new Set(Object.values(colors).map(c => c.id));
        }
    } else {
        availableColors = new Set(Object.values(colors).map(c => c.id));
    }
    
    await buildGrid(colorEntries, templateId);
}

// Build grid with saved order applied
async function buildGrid(colorEntries, templateId = null) {
    try {
        const { order = [] } = await (await fetch(templateId ? `/color-ordering?templateId=${templateId}` : `/color-ordering`)).json();
        const colorMap = new Map(colorEntries.map(([rgb, data]) => [data.id, { rgb, ...data }]));
        
        colorGrid.innerHTML = '';
        let priority = 1;
        
        // Add ordered colors first
        order.forEach(id => {
            const colorInfo = colorMap.get(id);
            if (colorInfo) {
                colorGrid.appendChild(createColorItem(colorInfo.rgb, colorInfo, priority++));
                colorMap.delete(id);
            }
        });
        
        // Add remaining colors
        [...colorMap.values()].sort((a, b) => a.id - b.id).forEach(colorInfo => {
            colorGrid.appendChild(createColorItem(colorInfo.rgb, colorInfo, priority++));
        });
    } catch {
        colorEntries.sort((a, b) => a[1].id - b[1].id);
        colorGrid.innerHTML = '';
        colorEntries.forEach(([rgb, data], i) => colorGrid.appendChild(createColorItem(rgb, data, i + 1)));
    }
}

// Create color item element
const createColorItem = (rgb, { id, name }, priority) => {
    const div = document.createElement('div');
    div.className = 'color-item';
    div.draggable = true;
    Object.assign(div.dataset, { id, rgb, name });
    div.title = `ID ${id}: ${name} (${rgb})`;
    div.innerHTML = `<div class="color-swatch" style="background:rgb(${rgb})"></div><div class="color-info"><span class="priority-number">${priority}</span><span class="color-name">${name}</span></div>`;
    return div;
};

// Drag and drop with single event listener
let draggedElement = null;
colorGrid.addEventListener('mousedown', e => e.target.closest('.color-item')?.setAttribute('draggable', 'true'));

colorGrid.addEventListener('dragstart', e => {
    draggedElement = e.target.closest('.color-item');
    draggedElement?.classList.add('dragging');
});

colorGrid.addEventListener('dragover', e => {
    e.preventDefault();
    const item = e.target.closest('.color-item');
    [...colorGrid.children].forEach(el => el.classList.toggle('drag-over', el === item && el !== draggedElement));
});

colorGrid.addEventListener('drop', e => {
    const dropTarget = e.target.closest('.color-item');
    if (dropTarget && dropTarget !== draggedElement && draggedElement) {
        const items = [...colorGrid.children];
        const [dragIdx, dropIdx] = [items.indexOf(draggedElement), items.indexOf(dropTarget)];
        colorGrid.insertBefore(draggedElement, dropIdx < dragIdx ? dropTarget : dropTarget.nextSibling);
        
        // Update priorities and save
        [...colorGrid.children].forEach((item, i) => item.querySelector('.priority-number').textContent = i + 1);
        if (currentTemplateId) saveColorOrder(currentTemplateId);
    }
});

colorGrid.addEventListener('dragend', () => {
    [...colorGrid.children].forEach(item => item.classList.remove('dragging', 'drag-over'));
    draggedElement = null;
});

// Save color order
const saveColorOrder = async (templateId = null) => {
    const order = [...colorGrid.children].map(el => parseInt(el.dataset.id));
    const url = templateId ? `/color-ordering/template/${templateId}` : `/color-ordering/global`;
    try {
        return (await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) })).ok;
    } catch { return false; }
};

// Quick reset and image color functions
const resetOrder = () => buildGrid(Object.entries(colors).filter(([_, data]) => !currentTemplateId || availableColors.has(data.id)));
const updateColorGridForImage = (imageColorIds) => {
    availableColors = new Set(imageColorIds);
    const imageColors = imageColorIds.map(id => [Object.keys(colors).find(rgb => colors[rgb].id === id), colors[Object.keys(colors).find(rgb => colors[rgb].id === id)]]).filter(([rgb]) => rgb);
    buildGrid(imageColors);
};
