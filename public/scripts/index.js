// elements
const $ = (id) => document.getElementById(id);
const main = $("main");
const openManageUsers = $("openManageUsers");
const openAddTemplate = $("openAddTemplate");
const openManageTemplates = $("openManageTemplates");
const openSettings = $("openSettings");
const userForm = $("userForm");
const scookie = $("scookie");
const jcookie = $("jcookie");
const submitUser = $("submitUser");
const manageUsers = $("manageUsers");
const manageUsersTitle = $("manageUsersTitle");
const userList = $("userList");
const checkUserStatus = $("checkUserStatus");
const addTemplate = $("addTemplate");
const convert = $("convert");
const details = $("details");
const size = $("size");
const ink = $("ink");
const templateCanvas = $("templateCanvas");
const previewCanvas = $("previewCanvas");
const previewCanvasButton = $("previewCanvasButton");
const templateForm = $("templateForm");
const templateFormTitle = $("templateFormTitle");
const convertInput = $("convertInput");
const templateName = $("templateName");
const tx = $("tx");
const ty = $("ty");
const px = $("px");
const py = $("py");
const userSelectList = $("userSelectList");
const selectAllUsers = $("selectAllUsers");
const canBuyMaxCharges = $("canBuyMaxCharges");
const canBuyCharges = $("canBuyCharges");
const antiGriefMode = $("antiGriefMode");
const submitTemplate = $("submitTemplate");
const manageTemplates = $("manageTemplates");
const templateList = $("templateList");
const startAll = $("startAll");
const stopAll = $("stopAll");
const settings = $("settings");
const drawingModeSelect = $("drawingModeSelect");
const outlineMode = $("outlineMode");
const turnstileNotifications = $("turnstileNotifications");
const accountCooldown = $("accountCooldown");
const purchaseCooldown = $("purchaseCooldown");
const dropletReserve = $("dropletReserve");
const antiGriefStandby = $("antiGriefStandby");
const chargeThreshold = $("chargeThreshold");
const totalCharges = $("totalCharges");
const totalMaxCharges = $("totalMaxCharges");
const messageBoxOverlay = $("messageBoxOverlay");
const messageBoxTitle = $("messageBoxTitle");
const messageBoxContent = $("messageBoxContent");
const messageBoxConfirm = $("messageBoxConfirm");
const messageBoxCancel = $("messageBoxCancel");

const progressIntervals = {};
const progressTotals = {};
const progressHistory = {};
const progressSessions = {};

const formatDuration = (seconds) => {
    if (!isFinite(seconds) || seconds <= 0) return '—';
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 99) return '99h+'; // cap for absurdly long ETAs
    if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m`;
    if (m > 0) return `${m}m ${sec.toString().padStart(2,'0')}s`;
    return `${sec}s`;
};

// Message Box
let confirmCallback = null;

const showMessage = (title, content) => {
    messageBoxTitle.textContent = title;
    messageBoxContent.textContent = content;
    messageBoxCancel.classList.add('hidden');
    messageBoxConfirm.textContent = 'OK';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = null;
};

const showConfirmation = (title, content, onConfirm) => {
    messageBoxTitle.textContent = title;
    messageBoxContent.textContent = content;
    messageBoxCancel.classList.remove('hidden');
    messageBoxConfirm.textContent = 'Confirm';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = onConfirm;
};

const closeMessageBox = () => {
    messageBoxOverlay.classList.add('hidden');
    confirmCallback = null;
};

messageBoxConfirm.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    closeMessageBox();
});

messageBoxCancel.addEventListener('click', () => {
    closeMessageBox();
});

const handleError = (error) => {
    console.error(error);
    let message = "An unknown error occurred. Check the console for details.";

    if (error.code === 'ERR_NETWORK') {
        message = "Could not connect to the server. Please ensure the bot is running and accessible.";
    } else if (error.response && error.response.data && error.response.data.error) {
        const errMsg = error.response.data.error;
        if (errMsg.includes("(1015)")) {
            message = "You are being rate-limited by the server. Please wait a moment before trying again.";
        } else if (errMsg.includes("(500)")) {
            message = "Authentication failed. The user's cookie may be expired or invalid. Please try adding the user again with a new cookie.";
        } else if (errMsg.includes("(502)")) {
            message = "The server reported a 'Bad Gateway' error. It might be temporarily down or restarting. Please try again in a few moments.";
        } else {
            message = errMsg;
        }
    }
    showMessage("Error", message);
};

// Progress Bar (Manage Templates)
const createProgressBar = () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'progress-wrapper';
    wrapper.style.width = '100%';
    wrapper.style.margin = '8px 0';

    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.style.width = '100%';
    bar.style.height = '12px';
    bar.style.borderRadius = '6px';
    bar.style.overflow = 'hidden';
    bar.style.background = 'rgba(0,0,0,0.1)';

    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = '0%';
    fill.style.height = '100%';
    fill.style.transition = 'width 200ms linear';
    fill.style.background = 'var(--accent-primary)';

    bar.appendChild(fill);

    const text = document.createElement('div');
    text.className = 'progress-text';
    text.style.fontSize = '12px';
    text.style.opacity = '0.85';
    text.style.marginTop = '6px';
    text.textContent = '0 px painted / 0 px remaining — 0% — Total: 0 px — ETA: —';
    text.style.cursor = 'pointer';
    text.title = 'Click to expand details';


    wrapper.appendChild(bar);
    wrapper.appendChild(text);

    const details = document.createElement('div');
    details.className = 'progress-details';
    details.style.display = 'none';
    details.style.marginTop = '6px';
    details.style.padding = '8px';
    details.style.borderRadius = '6px';
    details.style.background = 'rgba(0,0,0,0.05)';
    details.innerHTML = `
        <div class="pd-row"><b>Summary:</b> <span class="pd-summary">—</span></div>
        <div class="pd-row"><b>Counters:</b> <span class="pd-counts">painted 0, remaining 0, total 0</span></div>
        <div class="pd-row"><b>Rate:</b> <span class="pd-rates">last minute 0 px/min, since session 0 px/min</span></div>
        <div class="pd-row"><b>Finish:</b> <span class="pd-finish">ETA —, at —</span></div>
        <div class="pd-row"><b>Update:</b> <span class="pd-updated">—</span><b>Last progress:</b> <span class="pd-lastpos">—</span></div>
    `;
    wrapper.appendChild(details);

    const pd = {
        root: details,
        summary: details.querySelector('.pd-summary'),
        counts: details.querySelector('.pd-counts'),
        rates: details.querySelector('.pd-rates'),
        finish: details.querySelector('.pd-finish'),
        updated: details.querySelector('.pd-updated'),
        lastpos: details.querySelector('.pd-lastpos')
    };

    text.addEventListener('click', () => {
        pd.root.style.display = pd.root.style.display === 'none' ? 'block' : 'none';
    });

    return { wrapper, bar, fill, text, details: pd };
};

const updateProgressBar = (ui, painted, remaining, id, totalHint) => {
    const p = Math.max(0, painted | 0);
    const r = Math.max(0, remaining | 0);
    let total = progressTotals[id] || totalHint || (p + r);
    if (!progressTotals[id] && total) progressTotals[id] = total;
    else if (total && total > progressTotals[id]) progressTotals[id] = total;
    total = progressTotals[id] || total || (p + r);

    const pct = total > 0 ? Math.min(100, Math.max(0, (p / total) * 100)) : 0;
    ui.fill.style.width = Math.round(pct) + '%';

    // --- history for short-term rate ---
    const now = Date.now();
    if (!progressHistory[id]) progressHistory[id] = [];
    const hist = progressHistory[id];
    hist.push({ t: now, p });
    while (hist.length > 12) hist.shift(); // ~60s

    let deltaP = 0;
    let deltaT = 0;
    for (let i = 1; i < hist.length; i++) {
        const dp = hist[i].p - hist[i - 1].p;
        const dt = (hist[i].t - hist[i - 1].t) / 1000;
        if (dt > 0) {
            if (dp > 0) {
                deltaP += dp;
                deltaT += dt;
            }
        }
    }
    const recentRate = deltaT > 0 ? (deltaP / deltaT) : 0; // px/s

    // --- session baseline including idle time ---
    if (!progressSessions[id]) progressSessions[id] = { t0: now, p0: p, lastPosT: p > 0 ? now : null, lastP: p };
    const sess = progressSessions[id];
    if (p > sess.lastP) sess.lastPosT = now;
    sess.lastP = p;

    const totalElapsed = Math.max(0, (now - sess.t0) / 1000);
    const paintedSinceStart = Math.max(0, p - sess.p0);
    const sessionRate = totalElapsed > 0 ? (paintedSinceStart / totalElapsed) : 0; // px/s

    let etaRate = 0;
    if (recentRate > 0 && sessionRate > 0) etaRate = 0.6 * recentRate + 0.4 * sessionRate;
    else etaRate = Math.max(recentRate, sessionRate);

    const etaSeconds = (r > 0 && etaRate > 0) ? (r / etaRate) : null;

    // pretty numbers
    const pStr = p.toLocaleString();
    const rStr = r.toLocaleString();
    const tStr = (total || 0).toLocaleString();
    const pctStr = (total > 0) ? (pct >= 100 ? '100%' : `${pct.toFixed(1)}%`) : '0%';
    const etaStr = (r === 0 || pct >= 100) ? 'done' : formatDuration(etaSeconds || 0);
    ui.text.textContent = `${pStr} px painted / ${rStr} px remaining — ${pctStr} — Total: ${tStr} px — ETA: ${etaStr}`;

    // --- update details panel ---
    if (ui.details) {
        const recentPerMin = Math.round(recentRate * 60);
        const sessionPerMin = Math.round(sessionRate * 60);
        const finishAt = (etaSeconds && isFinite(etaSeconds)) ? new Date(now + etaSeconds * 1000).toLocaleString() : '—';
        const lastPosStr = sess.lastPosT ? new Date(sess.lastPosT).toLocaleString() : '—';
        ui.details.summary.textContent = `${pctStr}`;
        ui.details.counts.textContent = `painted ${pStr}, remaining ${rStr}, total ${tStr}`;
        ui.details.rates.textContent = `last minute ${recentPerMin} px/min, since session ${sessionPerMin} px/min`;
        ui.details.finish.textContent = `ETA ${etaStr}, at ${finishAt}`;
        ui.details.updated.textContent = new Date(now).toLocaleString();
        ui.details.lastpos.textContent = lastPosStr;
    }
};

const startProgressPolling = (id, ui, tpl) => {
    let mode = 'server'; // try server first, then fall back to client

    const pollServerOnce = async () => {
        try {
            const res = await axios.get(`/template/progress/${id}`);
            if (res && res.data && typeof res.data.painted === 'number' && typeof res.data.remaining === 'number') {
                const totalHint = (typeof res.data.total === 'number') ? res.data.total : (res.data.painted + res.data.remaining);
                updateProgressBar(ui, res.data.painted, res.data.remaining, id, totalHint);
                return true;
            }
            ui.text.textContent = 'N/A';
            return false;
        } catch (e) {
            ui.text.textContent = 'N/A';
            return false;
        }
    };

    const computeClientOnce = async () => {
        try {
            if (!tpl || !tpl.template || !tpl.coords) {
                ui.text.textContent = 'N/A';
                return;
            }
            const { width, height, data: matrix } = tpl.template;
            const [txVal, tyVal, pxVal, pyVal] = tpl.coords.map(Number);
            const TILE_SIZE = 1000;
            const startX = txVal * TILE_SIZE + pxVal;
            const startY = tyVal * TILE_SIZE + pyVal;
            const endX = startX + width;
            const endY = startY + height;
            const startTileX = Math.floor(startX / TILE_SIZE);
            const startTileY = Math.floor(startY / TILE_SIZE);
            const endTileX = Math.floor((endX - 1) / TILE_SIZE);
            const endTileY = Math.floor((endY - 1) / TILE_SIZE);

            // offscreen canvas to draw the fetched tiles into the exact region
            const off = document.createElement('canvas');
            off.width = width;
            off.height = height;
            const ctx = off.getContext('2d');
            ctx.clearRect(0, 0, width, height);

            for (let txi = startTileX; txi <= endTileX; txi++) {
                for (let tyi = startTileY; tyi <= endTileY; tyi++) {
                    try {
                        const response = await axios.get('/canvas', { params: { tx: txi, ty: tyi } });
                        const img = new Image();
                        img.src = response.data.image;
                        await img.decode();
                        const sx = (txi === startTileX) ? startX - txi * TILE_SIZE : 0;
                        const sy = (tyi === startTileY) ? startY - tyi * TILE_SIZE : 0;
                        const ex = (txi === endTileX) ? endX - txi * TILE_SIZE : TILE_SIZE;
                        const ey = (tyi === endTileY) ? endY - tyi * TILE_SIZE : TILE_SIZE;
                        const sw = ex - sx;
                        const sh = ey - sy;
                        const dx = txi * TILE_SIZE + sx - startX;
                        const dy = tyi * TILE_SIZE + sy - startY;
                        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
                    } catch (err) {
                        // If any tile fails, mark as N/A and stop this round
                        ui.text.textContent = 'N/A';
                        return;
                    }
                }
            }

            // Compare the pixels with the template matrix
            const base = ctx.getImageData(0, 0, width, height).data;
            let painted = 0;
            let remaining = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const tplId = matrix[x][y];
                    if (tplId === 0) continue;
                    const i = (y * width + x) * 4;
                    const r = base[i], g = base[i + 1], b = base[i + 2];
                    const idGuess = closest(`${r},${g},${b}`);
                    if (idGuess === tplId) painted++; else remaining++;
                }
            }
            let totalHint = undefined;
            if (typeof tpl.template.ink === 'number' && tpl.template.ink > 0) {
                totalHint = tpl.template.ink;
            } else if (!progressTotals[id]) {
                // compute once: count non-zero ids in matrix
                let count = 0;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (matrix[x][y] !== 0) count++;
                    }
                }
                totalHint = count;
            }
            updateProgressBar(ui, painted, remaining, id, totalHint);
        } catch (e) {
            ui.text.textContent = 'N/A';
        }
    };

    const startServerMode = async () => {
        const ok = await pollServerOnce();
        if (!ok) {
            // switch to client mode
            startClientMode();
            return;
        }
        const interval = setInterval(pollServerOnce, 5000);
        progressIntervals[id] = interval;
    };

    const startClientMode = () => {
        mode = 'client';
        computeClientOnce();
        const interval = setInterval(computeClientOnce, 5000);
        if (progressIntervals[id]) clearInterval(progressIntervals[id]);
        progressIntervals[id] = interval;
    };

    // kick off
    startServerMode();
};


// users
const loadUsers = async (f) => {
    try {
        const users = await axios.get("/users");
        if (f) f(users.data);
    } catch (error) {
        handleError(error);
    };
};
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await axios.post('/user', { cookies: { s: scookie.value, j: jcookie.value } });
        if (response.status === 200) {
            showMessage("Success", `Logged in as ${response.data.name} (#${response.data.id})!`);
            userForm.reset();
            openManageUsers.click(); // Refresh the view
        }
    } catch (error) {
        handleError(error);
    };
});

// templates
const basic_colors = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31 };
const premium_colors = { "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
const colors = { ...basic_colors, ...premium_colors };

const colorById = (id) => Object.keys(colors).find(key => colors[key] === id);
const closest = color => {
    const [tr, tg, tb] = color.split(',').map(Number);
    // only use basic_colors for closest match to keep current behavior
    return basic_colors[Object.keys(basic_colors).reduce((closest, current) => {
        const [cr, cg, cb] = current.split(',').map(Number);
        const [clR, clG, clB] = closest.split(',').map(Number);
        return Math.sqrt(Math.pow(tr - cr, 2) + Math.pow(tg - cg, 2) + Math.pow(tb - cb, 2)) < Math.sqrt(Math.pow(tr - clR, 2) + Math.pow(tg - clG, 2) + Math.pow(tb - clB, 2)) ? current : closest;
    })];
};

const drawTemplate = (template, canvas) => {
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, template.width, template.height);
    const imageData = new ImageData(template.width, template.height);
    for (let x = 0; x < template.width; x++) {
        for (let y = 0; y < template.height; y++) {
            const color = template.data[x][y];
            if (color === 0) continue;
            const i = (y * template.width + x) * 4;
            const [r, g, b] = colorById(color).split(',').map(Number);
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255;
        };
    };
    ctx.putImageData(imageData, 0, 0);
};
const loadTemplates = async (f) => {
    try {
        const templates = await axios.get("/templates");
        if (f) f(templates.data);
    } catch (error) {
        handleError(error);
    };
};
const fetchCanvas = async (txVal, tyVal, pxVal, pyVal, width, height) => {
    const TILE_SIZE = 1000;
    const startX = txVal * TILE_SIZE + pxVal;
    const startY = tyVal * TILE_SIZE + pyVal;
    const endX = startX + width;
    const endY = startY + height;
    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    const endTileX = Math.floor((endX - 1) / TILE_SIZE);
    const endTileY = Math.floor((endY - 1) / TILE_SIZE);

    previewCanvas.width = width;
    previewCanvas.height = height;
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    for (let txi = startTileX; txi <= endTileX; txi++) {
        for (let tyi = startTileY; tyi <= endTileY; tyi++) {
            try {
                const response = await axios.get('/canvas', { params: { tx: txi, ty: tyi } });
                const img = new Image();
                img.src = response.data.image;
                await img.decode();
                const sx = (txi === startTileX) ? startX - txi * TILE_SIZE : 0;
                const sy = (tyi === startTileY) ? startY - tyi * TILE_SIZE : 0;
                const ex = (txi === endTileX) ? endX - txi * TILE_SIZE : TILE_SIZE;
                const ey = (tyi === endTileY) ? endY - tyi * TILE_SIZE : TILE_SIZE;
                const sw = ex - sx;
                const sh = ey - sy;
                const dx = txi * TILE_SIZE + sx - startX;
                const dy = tyi * TILE_SIZE + sy - startY;
                ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
            } catch (error) {
                handleError(error);
                return;
            }
        }
    }

    const baseImage = ctx.getImageData(0, 0, width, height);
    const templateCtx = templateCanvas.getContext('2d');
    const templateImage = templateCtx.getImageData(0, 0, width, height);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(templateCanvas, 0, 0);
    ctx.globalAlpha = 1;
    const b = baseImage.data;
    const t = templateImage.data;
    for (let i = 0; i < t.length; i += 4) {
        // skip transparent template pixels
        if (t[i + 3] === 0) continue;
        if (b[i + 3] === 0) continue;

        const idx = i / 4;
        const x = idx % width;
        const y = Math.floor(idx / width);
        ctx.fillStyle = 'rgba(255,0,0,0.8)';
        ctx.fillRect(x, y, 1, 1);
    }
};

const nearestimgdecoder = (imageData, width, height) => {
    const d = imageData.data;
    const matrix = Array.from({ length: width }, () => Array(height).fill(0));
    let ink = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const a = d[i + 3];
            if (a === 255) {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                const id = closest(`${r},${g},${b}`);
                matrix[x][y] = id;
                ink++;
            } else {
                matrix[x][y] = 0;
            }
        }
    }
    return { matrix, ink };
};

let currentTemplate = { width: 0, height: 0, data: [] };

const processImageFile = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const image = new Image();
        image.src = e.target.result;
        image.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const { matrix, ink } = nearestimgdecoder(imageData, canvas.width, canvas.height);

            const template = {
                width: canvas.width,
                height: canvas.height,
                ink,
                data: matrix
            };

            canvas.remove();
            callback(template);
        };
    };
    reader.readAsDataURL(file);
};
convertInput.addEventListener('change', async () => {
    processImageFile(convertInput.files[0], (template) => {
        currentTemplate = template;
        drawTemplate(template, templateCanvas);
        size.innerHTML = `${template.width}x${template.height}px`;
        ink.innerHTML = template.ink;
        details.style.display = "block";
    });
});
previewCanvasButton.addEventListener('click', async () => {
    const txVal = parseInt(tx.value, 10);
    const tyVal = parseInt(ty.value, 10);
    const pxVal = parseInt(px.value, 10);
    const pyVal = parseInt(py.value, 10);
    if (isNaN(txVal) || isNaN(tyVal) || isNaN(pxVal) || isNaN(pyVal) || currentTemplate.width === 0) {
        showMessage("Error", "Please convert an image and enter valid coordinates before previewing.");
        return;
    }
    await fetchCanvas(txVal, tyVal, pxVal, pyVal, currentTemplate.width, currentTemplate.height);
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
    templateFormTitle.textContent = "Add Template";
    submitTemplate.innerHTML = '<img src="icons/addTemplate.svg">Add Template';
    delete templateForm.dataset.editId;
    details.style.display = "none";
    currentTemplate = { width: 0, height: 0, data: [] };
};

templateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isEditMode = !!templateForm.dataset.editId;

    if (!isEditMode && (!currentTemplate || currentTemplate.width === 0)) {
        showMessage("Error", "Please convert an image before creating a template.");
        return;
    }
    const selectedUsers = Array.from(document.querySelectorAll('input[name="user_checkbox"]:checked')).map(cb => cb.value);
    if (selectedUsers.length === 0) {
        showMessage("Error", "Please select at least one user.");
        return;
    }

    const data = {
        templateName: templateName.value,
        coords: [tx.value, ty.value, px.value, py.value].map(Number),
        userIds: selectedUsers,
        canBuyCharges: canBuyCharges.checked,
        canBuyMaxCharges: canBuyMaxCharges.checked,
        antiGriefMode: antiGriefMode.checked
    };

    if (currentTemplate && currentTemplate.width > 0) {
        data.template = currentTemplate;
    }

    try {
        if (isEditMode) {
            await axios.put(`/template/edit/${templateForm.dataset.editId}`, data);
            showMessage("Success", "Template updated!");
        } else {
            await axios.post('/template', data);
            showMessage("Success", "Template created!");
        }
        resetTemplateForm();
        openManageTemplates.click();
    } catch (error) {
        handleError(error);
    };
});
startAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: true });
        } catch (error) {
            handleError(error);
        };
    };
    showMessage("Success", "Finished! Check console for details.");
    openManageTemplates.click();
});
stopAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: false });
        } catch (error) {
            handleError(error);
        };
    };
    showMessage("Success", "Finished! Check console for details.");
    openManageTemplates.click();
});


// tabs
let currentTab = main;
const changeTab = (el) => {
    currentTab.style.display = "none";
    el.style.display = "block";
    currentTab = el;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
openManageUsers.addEventListener("click", () => {
    userList.innerHTML = "";
    userForm.reset();
    totalCharges.textContent = "?";
    totalMaxCharges.textContent = "?";
    loadUsers(users => {
        const userCount = Object.keys(users).length;
        manageUsersTitle.textContent = `Existing Users (${userCount})`;
        for (const id of Object.keys(users)) {
            const user = document.createElement('div');
            user.className = 'user';
            user.id = `user-${id}`;
            const expirationDate = users[id].expirationDate;
            const expirationStr = expirationDate ? new Date(expirationDate * 1000).toLocaleString() : 'N/A';

            user.innerHTML = `
                <div class="user-info">
                    <span>${users[id].name}</span>
                    <span>(#${id})</span>
                    <div class="user-stats">
                        Charges: <b>?</b>/<b>?</b> | Level <b>?</b> <span class="level-progress">(?%)</span><br>
                        Expires: <b>${expirationStr}</b>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="delete-btn" title="Delete User"><img src="icons/remove.svg"></button>
                    <button class="json-btn" title="Get Raw User Info"><img src="icons/code.svg"></button>
                </div>`;

            user.querySelector('.delete-btn').addEventListener("click", () => {
                showConfirmation(
                    "Delete User",
                    `Are you sure you want to delete ${users[id].name} (#${id})?`,
                    async () => {
                        try {
                            await axios.delete(`/user/${id}`);
                            showMessage("Success", "User deleted.");
                            openManageUsers.click();
                        } catch (error) {
                            handleError(error);
                        };
                    }
                );
            });
            user.querySelector('.json-btn').addEventListener("click", async () => {
                try {
                    const response = await axios.get(`/user/status/${id}`);
                    showMessage("Raw User Info", JSON.stringify(response.data, null, 2));
                } catch (error) {
                    handleError(error);
                };
            });
            userList.appendChild(user);
        };
    });
    changeTab(manageUsers);
});

async function processInParallel(tasks, concurrency) {
    const queue = [...tasks];
    const workers = [];

    const runTask = async () => {
        while (queue.length > 0) {
            const task = queue.shift();
            if (task) await task();
        }
    };

    for (let i = 0; i < concurrency; i++) {
        workers.push(runTask());
    }

    await Promise.all(workers);
}

checkUserStatus.addEventListener("click", async () => {
    checkUserStatus.disabled = true;
    checkUserStatus.innerHTML = "Checking...";
    const userElements = Array.from(document.querySelectorAll('.user'));

    let totalCurrent = 0;
    let totalMax = 0;

    const tasks = userElements.map(userEl => async () => {
        const id = userEl.id.split('-')[1];
        const infoSpans = userEl.querySelectorAll('.user-info > span');
        const currentChargesEl = userEl.querySelector('.user-stats b:nth-of-type(1)');
        const maxChargesEl = userEl.querySelector('.user-stats b:nth-of-type(2)');
        const currentLevelEl = userEl.querySelector('.user-stats b:nth-of-type(3)');
        const levelProgressEl = userEl.querySelector('.level-progress');

        infoSpans.forEach(span => span.style.color = 'var(--warning-color)');
        try {
            const response = await axios.get(`/user/status/${id}`);
            const userInfo = response.data;

            const charges = Math.floor(userInfo.charges.count);
            const max = userInfo.charges.max;
            const level = Math.floor(userInfo.level);
            const progress = Math.round((userInfo.level % 1) * 100);

            currentChargesEl.textContent = charges;
            maxChargesEl.textContent = max;
            currentLevelEl.textContent = level;
            levelProgressEl.textContent = `(${progress}%)`;
            totalCurrent += charges;
            totalMax += max;

            infoSpans.forEach(span => span.style.color = 'var(--success-color)');
        } catch (error) {
            currentChargesEl.textContent = "ERR";
            maxChargesEl.textContent = "ERR";
            currentLevelEl.textContent = "?";
            levelProgressEl.textContent = "(?%)";
            infoSpans.forEach(span => span.style.color = 'var(--error-color)');
        }
    });

    await processInParallel(tasks, 5);

    totalCharges.textContent = totalCurrent;
    totalMaxCharges.textContent = totalMax;

    checkUserStatus.disabled = false;
    checkUserStatus.innerHTML = '<img src="icons/check.svg">Check Account Status';
});
openAddTemplate.addEventListener("click", () => {
    resetTemplateForm();
    userSelectList.innerHTML = "";
    loadUsers(users => {
        if (Object.keys(users).length === 0) {
            userSelectList.innerHTML = "<span>No users added. Please add a user first.</span>";
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
    });
    changeTab(addTemplate);
});
selectAllUsers.addEventListener('click', () => {
    document.querySelectorAll('#userSelectList input[type="checkbox"]').forEach(cb => cb.checked = true);
});

const createToggleButton = (template, id, buttonsContainer, statusSpan) => {
    const button = document.createElement('button');
    const isRunning = template.running;

    button.className = isRunning ? 'destructive-button' : 'primary-button';
    button.innerHTML = `<img src="icons/${isRunning ? 'pause' : 'play'}.svg">${isRunning ? 'Stop' : 'Start'} Template`;

    button.addEventListener('click', async () => {
        try {
            await axios.put(`/template/${id}`, { running: !isRunning });
            template.running = !isRunning;
            const newButton = createToggleButton(template, id, buttonsContainer, statusSpan);
            button.replaceWith(newButton);
            statusSpan.textContent = `Status: ${!isRunning ? 'Started' : 'Stopped'}`;
        } catch (error) {
            handleError(error);
        }
    });
    return button;
};

openManageTemplates.addEventListener("click", () => {
    templateList.innerHTML = "";
    // clear previous progress intervals to avoid duplicates when reopening the tab
    for (const key of Object.keys(progressIntervals)) {
        clearInterval(progressIntervals[key]);
        delete progressIntervals[key];
    }
    for (const key of Object.keys(progressHistory)) delete progressHistory[key];
    for (const key of Object.keys(progressTotals)) delete progressTotals[key];
    loadUsers(users => {
        loadTemplates(templates => {
            for (const id of Object.keys(templates)) {
                const t = templates[id];
                const userListFormatted = t.userIds.map(userId => {
                    const user = users[userId];
                    return user ? `${user.name}#${userId}` : `Unknown#${userId}`;
                }).join(", ");

                const template = document.createElement('div');
                template.id = id;
                template.className = "template";
                const infoSpan = document.createElement('span');
                infoSpan.innerHTML = `<b>Template Name:</b> ${t.name}<br><b>Assigned Accounts:</b> ${userListFormatted}<br><b>Coordinates:</b> ${t.coords.join(", ")}<br><b>Buy Max Charge Upgrades:</b> ${t.canBuyMaxCharges ? "Yes" : "No"}<br><b>Buy Extra Charges:</b> ${t.canBuyCharges ? "Yes" : "No"}<br><b>Anti-Grief Mode:</b> ${t.antiGriefMode ? "Yes" : "No"}<br><b class="status-text">Status:</b> ${t.status}`;
                template.appendChild(infoSpan);

                const canvas = document.createElement("canvas");
                drawTemplate(t.template, canvas);
                // Progress UI
                const progressUI = createProgressBar();

                const buttons = document.createElement('div');
                buttons.className = "template-actions";

                const toggleButton = createToggleButton(t, id, buttons, infoSpan.querySelector('.status-text'));
                buttons.appendChild(toggleButton);

                const editButton = document.createElement('button');
                editButton.className = 'secondary-button';
                editButton.innerHTML = '<img src="icons/settings.svg">Edit Template';
                editButton.addEventListener('click', () => {
                    openAddTemplate.click();
                    templateFormTitle.textContent = `Edit Template: ${t.name}`;
                    submitTemplate.innerHTML = '<img src="icons/edit.svg">Save Changes';
                    templateForm.dataset.editId = id;

                    templateName.value = t.name;
                    [tx.value, ty.value, px.value, py.value] = t.coords;
                    canBuyCharges.checked = t.canBuyCharges;
                    canBuyMaxCharges.checked = t.canBuyMaxCharges;
                    antiGriefMode.checked = t.antiGriefMode;

                    document.querySelectorAll('input[name="user_checkbox"]').forEach(cb => {
                        if (t.userIds.includes(cb.value)) {
                            cb.checked = true;
                        }
                    });
                });

                const delButton = document.createElement('button');
                delButton.className = 'destructive-button';
                delButton.innerHTML = '<img src="icons/remove.svg">Delete Template';
                delButton.addEventListener("click", () => {
                    showConfirmation(
                        "Delete Template",
                        `Are you sure you want to delete template "${t.name}"?`,
                        async () => {
                            try {
                                await axios.delete(`/template/${id}`);
                                openManageTemplates.click();
                            } catch (error) {
                                handleError(error);
                            };
                        }
                    );
                });
                buttons.append(editButton);
                buttons.append(delButton);
                template.append(canvas);
                template.append(progressUI.wrapper);
                template.append(buttons);
                startProgressPolling(id, progressUI, { template: t.template, coords: t.coords });
                templateList.append(template);
            };
        });
    });
    changeTab(manageTemplates);
});
openSettings.addEventListener("click", async () => {
    try {
        const response = await axios.get('/settings');
        const currentSettings = response.data;
        drawingModeSelect.value = currentSettings.drawingMethod;
        turnstileNotifications.checked = currentSettings.turnstileNotifications;
        outlineMode.checked = currentSettings.outlineMode;
        accountCooldown.value = currentSettings.accountCooldown / 1000;
        purchaseCooldown.value = currentSettings.purchaseCooldown / 1000;
        dropletReserve.value = currentSettings.dropletReserve;
        antiGriefStandby.value = currentSettings.antiGriefStandby / 60000;
        chargeThreshold.value = currentSettings.chargeThreshold * 100;
    } catch (error) {
        handleError(error);
    }
    changeTab(settings);
});

// Settings
const saveSetting = async (setting) => {
    try {
        await axios.put('/settings', setting);
        showMessage("Success", "Setting saved!");
    } catch (error) {
        handleError(error);
    }
};

drawingModeSelect.addEventListener('change', () => saveSetting({ drawingMethod: drawingModeSelect.value }));
turnstileNotifications.addEventListener('change', () => saveSetting({ turnstileNotifications: turnstileNotifications.checked }));
outlineMode.addEventListener('change', () => saveSetting({ outlineMode: outlineMode.checked }));

accountCooldown.addEventListener('change', () => {
    const value = parseInt(accountCooldown.value, 10) * 1000;
    if (isNaN(value) || value < 0) {
        showMessage("Error", "Please enter a valid non-negative number.");
        return;
    }
    saveSetting({ accountCooldown: value });
});

purchaseCooldown.addEventListener('change', () => {
    const value = parseInt(purchaseCooldown.value, 10) * 1000;
    if (isNaN(value) || value < 0) {
        showMessage("Error", "Please enter a valid non-negative number.");
        return;
    }
    saveSetting({ purchaseCooldown: value });
});

dropletReserve.addEventListener('change', () => {
    const value = parseInt(dropletReserve.value, 10);
    if (isNaN(value) || value < 0) {
        showMessage("Error", "Please enter a valid non-negative number.");
        return;
    }
    saveSetting({ dropletReserve: value });
});

antiGriefStandby.addEventListener('change', () => {
    const value = parseInt(antiGriefStandby.value, 10) * 60000;
    if (isNaN(value) || value < 60000) {
        showMessage("Error", "Please enter a valid number (at least 1 minute).");
        return;
    }
    saveSetting({ antiGriefStandby: value });
});

chargeThreshold.addEventListener('change', () => {
    const value = parseInt(chargeThreshold.value, 10);
    if (isNaN(value) || value < 0 || value > 100) {
        showMessage("Error", "Please enter a valid percentage between 0 and 100.");
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

[ty, px, py].forEach(input => {
    input.addEventListener('blur', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});
