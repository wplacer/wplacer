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
const manageUsers = $('manageUsers');
const manageUsersTitle = $('manageUsersTitle');
const userList = $('userList');
const checkUserStatus = $('checkUserStatus');
const addTemplate = $('addTemplate');
const convert = $('convert');
const details = $('details');
const size = $('size');
const ink = $('ink');
const premiumWarning = $('premiumWarning');
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
const showPaidColors = $('showPaidColors');

// --- Global State ---
let templateUpdateInterval = null;
let confirmCallback = null;
let currentTab = 'main';
let currentTemplate = { width: 0, height: 0, data: [] };

const tabs = {
    main,
    manageUsers,
    addTemplate,
    manageTemplates,
    settings,
};

const showMessage = (title, content) => {
    messageBoxTitle.innerHTML = title;
    messageBoxContent.innerHTML = content;
    messageBoxCancel.classList.add('hidden');
    messageBoxConfirm.textContent = 'OK';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = null;
};

const showConfirmation = (title, content, onConfirm) => {
    messageBoxTitle.innerHTML = title;
    messageBoxContent.innerHTML = content;
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
    let message = 'An unknown error occurred. Check the console for details.';

    if (error.code === 'ERR_NETWORK') {
        message = 'Could not connect to the server. Please ensure the bot is running and accessible.';
    } else if (error.response && error.response.data && error.response.data.error) {
        const errMsg = error.response.data.error;
        if (errMsg.includes('(1015)')) {
            message = 'You are being rate-limited by the server. Please wait a moment before trying again.';
        } else if (errMsg.includes('(500)')) {
            message =
                "Authentication failed. The user's cookie may be expired or invalid. Please try adding the user again with a new cookie.";
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
    if (templateUpdateInterval) {
        clearInterval(templateUpdateInterval);
        templateUpdateInterval = null;
    }
    Object.values(tabs).forEach((tab) => (tab.style.display = 'none'));
    tabs[tabName].style.display = 'block';
    currentTab = tabName;
};

// users
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
    try {
        const response = await axios.post('/user', { cookies: { s: scookie.value, j: jcookie.value } });
        if (response.status === 200) {
            showMessage('Success', `Logged in as ${response.data.name} (#${response.data.id})!`);
            userForm.reset();
            openManageUsers.click(); // Refresh the view
        }
    } catch (error) {
        handleError(error);
    }
});

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

const colorById = (id) => Object.keys(colors).find((key) => colors[key] === id);
const closest = (color) => {
    const [tr, tg, tb] = color.split(',').map(Number);
    return Object.keys(colors).reduce((closestKey, currentKey) => {
        const [cr, cg, cb] = currentKey.split(',').map(Number);
        const [clR, clG, clB] = closestKey.split(',').map(Number);
        const currentDistance = Math.pow(tr - cr, 2) + Math.pow(tg - cg, 2) + Math.pow(tb - cb, 2);
        const closestDistance = Math.pow(tr - clR, 2) + Math.pow(tg - clG, 2) + Math.pow(tb - clB, 2);
        return currentDistance < closestDistance ? currentKey : closestKey;
    });
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

            const key = Object.keys(colors).find((k) => colors[k] === color);
            if (!key) {
                // Unknown color id. Skip to avoid `.split` crash.
                // Optional: console.warn('Unknown color id:', color);
                continue;
            }

            const [r, g, b] = key.split(',').map(Number);
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
                const response = await axios.get('/canvas', { params: { tx: txi, ty: tyi } });
                const img = new Image();
                img.src = response.data.image;
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
    let ink = 0;
    let hasPremium = false;

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
                    const id = colors[rgb] || colors[closest(rgb)];
                    matrix[x][y] = id;
                    if (id >= 32) hasPremium = true;
                }
                ink++;
            } else {
                matrix[x][y] = 0;
            }
        }
    }
    return { matrix, ink, hasPremium };
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
            const { matrix, ink, hasPremium } = nearestimgdecoder(imageData, canvas.width, canvas.height);

            const template = {
                width: canvas.width,
                height: canvas.height,
                ink,
                data: matrix,
                hasPremium,
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
            if (template.hasPremium) {
                premiumWarning.innerHTML =
                    '<b>Warning:</b> This template uses premium colors. Ensure your selected accounts have purchased them.';
                premiumWarning.style.display = 'block';
            } else {
                premiumWarning.style.display = 'none';
            }
            templateCanvas.style.display = 'block';
            previewCanvas.style.display = 'none';
            details.style.display = 'block';
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
        match = p.exec(text);
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
    premiumWarning.style.display = 'none';
    previewCanvas.style.display = 'none';
    currentTemplate = { width: 0, height: 0, data: [] };
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
        if (isEditMode) {
            await axios.put(`/template/edit/${templateForm.dataset.editId}`, data);
            showMessage('Success', 'Template updated!');
        } else {
            await axios.post('/template', data);
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

openManageUsers.addEventListener('click', () => {
    userList.innerHTML = '';
    userForm.reset();
    totalCharges.textContent = '?';
    totalMaxCharges.textContent = '?';
    totalDroplets.textContent = '?';
    totalPPH.textContent = '?';
    loadUsers((users) => {
        const userCount = Object.keys(users).length;
        manageUsersTitle.textContent = `Existing Users (${userCount})`;
        for (const id of Object.keys(users)) {
            const user = document.createElement('div');
            user.className = 'user';
            user.id = `user-${id}`;

            user.innerHTML = `
                <div class="user-info">
                    <span>${users[id].name}</span>
                    <span>(#${id})</span>
                    <div class="user-stats">
                        Charges: <b>?</b>/<b>?</b> | Level <b>?</b> <span class="level-progress">(?%)</span><br>
                        Droplets: <b>?</b>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="delete-btn" title="Delete User"><img src="icons/remove.svg"></button>
                    <button class="info-btn" title="Get User Info"><img src="icons/code.svg"></button>
                </div>`;

            user.querySelector('.delete-btn').addEventListener('click', () => {
                showConfirmation(
                    'Delete User',
                    `Are you sure you want to delete ${users[id].name} (#${id})? This will also remove them from all templates.`,
                    async () => {
                        try {
                            await axios.delete(`/user/${id}`);
                            showMessage('Success', 'User deleted.');
                            openManageUsers.click();
                        } catch (error) {
                            handleError(error);
                        }
                    }
                );
            });
            user.querySelector('.info-btn').addEventListener('click', async () => {
                try {
                    const response = await axios.get(`/user/status/${id}`);
                    const info = `
                    <b>User Name:</b> <span style="color: #f97a1f;">${response.data.name}</span><br>
                    <b>Charges:</b> <span style="color: #f97a1f;">${Math.floor(response.data.charges.count)}</span>/<span style="color: #f97a1f;">${response.data.charges.max}</span><br>
                    <b>Droplets:</b> <span style="color: #f97a1f;">${response.data.droplets}</span><br>
                    <b>Favorite Locations:</b> <span style="color: #f97a1f;">${response.data.favoriteLocations.length}</span>/<span style="color: #f97a1f;">${response.data.maxFavoriteLocations}</span><br>
                    <b>Flag Equipped:</b> <span style="color: #f97a1f;">${response.data.equippedFlag ? 'Yes' : 'No'}</span><br>
                    <b>Discord:</b> <span style="color: #f97a1f;">${response.data.discord}</span><br>
                    <b>Country:</b> <span style="color: #f97a1f;">${response.data.country}</span><br>
                    <b>Pixels Painted:</b> <span style="color: #f97a1f;">${response.data.pixelsPainted}</span><br>
                    <b>Extra Colors:</b> <span style="color: #f97a1f;">${response.data.extraColorsBitmap}</span><br>
                    <b>Alliance ID:</b> <span style="color: #f97a1f;">${response.data.allianceId}</span><br>
                    <b>Alliance Role:</b> <span style="color: #f97a1f;">${response.data.allianceRole}</span><br>
                    <br>Would you like to copy the <b>Raw Json</b> to your clipboard?
                    `;

                    showConfirmation('User Info', info, () => {
                        navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
                    });
                } catch (error) {
                    handleError(error);
                }
            });
            userList.appendChild(user);
        }
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

            if (status && status.success) {
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
    });

    

    // Initialize the grid on load
    initializeGrid();
    console.log('Grid initialized for template placement.');

    
    document.getElementById('showPaidColors').checked = false;

    changeTab('addTemplate');
});

selectAllUsers.addEventListener('click', () => {
    document.querySelectorAll('#userSelectList input[type="checkbox"]').forEach((cb) => (cb.checked = true));
});

const createToggleButton = (template, id, buttonsContainer, progressBarText, currentPercent) => {
    const button = document.createElement('button');
    const isRunning = template.running;

    button.className = isRunning ? 'destructive-button' : 'primary-button';
    button.innerHTML = `<img src="icons/${isRunning ? 'pause' : 'play'}.svg">${isRunning ? 'Stop' : 'Start'} Template`;

    button.addEventListener('click', async () => {
        try {
            await axios.put(`/template/${id}`, { running: !isRunning });
            template.running = !isRunning;
            const newStatus = !isRunning ? 'Started' : 'Stopped';
            const newButton = createToggleButton(template, id, buttonsContainer, progressBarText, currentPercent);
            button.replaceWith(newButton);
            progressBarText.textContent = `${currentPercent}% | ${newStatus}`;
            const progressBar = progressBarText.previousElementSibling;
            progressBar.classList.toggle('stopped', !isRunning);
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
            const pixelCount = templateElement.querySelector('.pixel-count');

            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressBarText) progressBarText.textContent = `${percent}% | ${t.status}`;
            if (pixelCount) pixelCount.textContent = `${t.name} ${completed}px / ${total}px`;

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

function tlpxToLatLng(tlX, tlY, pxX, pxY) {
  const MAP_TILE = 1024;      // map tile pixels
  const CANVAS_TILE = 1000;   // canvas tile pixels
  const TILE_Z = 11;          // fixed zoom used by wplace tiling

  const sx = pxX * (MAP_TILE / CANVAS_TILE);
  const sy = pxY * (MAP_TILE / CANVAS_TILE);
  const worldX = tlX * MAP_TILE + sx;
  const worldY = tlY * MAP_TILE + sy;

  const W = MAP_TILE * Math.pow(2, TILE_Z);
  const lng = (worldX / W) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (worldY / W)))) * 180 / Math.PI;
  return { lat, lng };
}
function wplaceUrlFromCoords(coords, zoom = 17.432051496765904) {
  const [tlX, tlY, pxX, pxY] = coords.map(Number);
  const { lat, lng } = tlpxToLatLng(tlX, tlY, pxX, pxY); // keep names explicit
  return `https://wplace.live/?lat=${lat}&lng=${lng}&zoom=${zoom}`;
}

let importShareCode = false;
openManageTemplates.addEventListener('click', () => {
    templateList.innerHTML = '';
    if (templateUpdateInterval) clearInterval(templateUpdateInterval);

    // top toolbar: only once
    const topBar = document.createElement('div');
    topBar.className = 'template-toolbar';
    if (!importShareCode) {
        const importBtnTop = document.createElement('button');
        importBtnTop.className = 'secondary-button btn-sm';
        importBtnTop.innerHTML = '<img src="icons/addTemplate.svg">Import Share Code';
        importBtnTop.addEventListener('click', async () => {
            const code = prompt('Paste a share code:');
            if (!code) return;
            try {
                // minimal import. Server endpoint you already have:
                // POST /templates/import expects: { id, name, coords, code }
                const genId = Date.now().toString();
                await axios.post('/templates/import', {
                    id: genId,
                    name: `Imported ${genId}`,
                    coords: [0, 0, 0, 0],
                    code,
                });
                showMessage('Success', 'Template imported.');
                openManageTemplates.click();
            } catch (e) {
                handleError(e);
            }
        });
        topBar.appendChild(importBtnTop);
        templateList.before(topBar);
        importShareCode = true;
    }
    loadUsers((users) => {
        loadTemplates((templates) => {
            for (const id of Object.keys(templates)) {
                const t = templates[id];
                const total = t.totalPixels || 1;
                const remaining = t.pixelsRemaining != null ? t.pixelsRemaining : total;
                const completed = total - remaining;
                const percent = Math.floor((completed / total) * 100);

                const card = document.createElement('div');
                card.id = id;
                card.className = 'template';

                // header: name and quick stats
                const header = document.createElement('div');
                header.className = 'template-header';
                const pixelCountAndName = document.createElement('span');
                pixelCountAndName.textContent = `${t.name} ${completed}/${total} px`;
                pixelCountAndName.className = 'pixel-count';

                header.append(pixelCountAndName);

                card.appendChild(header);

                // progress
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

                // actions row
                const actions = document.createElement('div');
                actions.className = 'template-actions compact';

                actions.appendChild(createToggleButton(t, id, actions, pbt, percent));

                const copyBtn = document.createElement('button');
                copyBtn.className = 'secondary-button btn-sm';
                copyBtn.innerHTML = '<img src="icons/code.svg">Copy Share Code';
                copyBtn.addEventListener('click', async () => {
                    const code = t.shareCode; // from server
                    if (!code) {
                        showMessage('Error', 'No share code available.');
                        return;
                    }
                    await navigator.clipboard.writeText(code);
                    showMessage('Copied', 'Share code copied to clipboard.');
                });
                actions.appendChild(copyBtn);

                const editBtn = document.createElement('button');
                editBtn.className = 'secondary-button btn-sm';
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
                    setTimeout(() => {
                        document.querySelectorAll('input[name="user_checkbox"]').forEach((cb) => {
                            cb.checked = t.userIds.includes(cb.value);
                        });
                    }, 100);
                });
                actions.appendChild(editBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'destructive-button btn-sm';
                delBtn.innerHTML = '<img src="icons/remove.svg">Delete';
                delBtn.addEventListener('click', () => {
                    showConfirmation('Delete Template', `Delete "${t.name}"?`, async () => {
                        try {
                            await axios.delete(`/template/${id}`);
                            openManageTemplates.click();
                        } catch (e) {
                            handleError(e);
                        }
                    });
                });
                actions.appendChild(delBtn);

                card.appendChild(actions);

                let drawn = false;
                function drawOnce() {
                    if (drawn) return;
                    drawTemplate(t.template, canvas);
                    drawn = true;
                }

                // collapsible details (hidden by default)
                const details = document.createElement('div');
                details.className = 'template-details hidden';
                const canvas = document.createElement('canvas');
                // draw only when expanded
                header.addEventListener('click', () => {
                    details.classList.toggle('hidden');
                    drawOnce();
                    if (!details.classList.contains('hidden') && canvas.width === 0) drawTemplate(t.template, canvas);
                });
                details.append(canvas);
                card.appendChild(details);

                templateList.appendChild(card);
            }
            templateUpdateInterval = setInterval(updateTemplateStatus, 2000);
        });
    });
    changeTab('manageTemplates');
});

openSettings.addEventListener('click', async () => {
    try {
        const response = await axios.get('/settings');
        const currentSettings = response.data;
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

/// --- Color Ordering
const colorGrid = document.getElementById('colorGrid');
let draggedElement = null;
let showAllColors= false; // Default to false

// Initialize the grid
function initializeGrid() {
    const filteredColors = getFilteredColors();
    buildColorGrid(filteredColors);
}

// Drag and drop event handlers
colorGrid.addEventListener('dragstart', handleDragStart);
colorGrid.addEventListener('dragover', handleDragOver);
colorGrid.addEventListener('dragenter', handleDragEnter);
colorGrid.addEventListener('dragleave', handleDragLeave);
colorGrid.addEventListener('drop', handleDrop);
colorGrid.addEventListener('dragend', handleDragEnd);

function getFilteredColors() {
    const sortedColors = Object.entries(colors).sort((a, b) => a[1].id - b[1].id);
    return showAllColors? sortedColors : sortedColors.slice(0, 31);
}

function buildColorGrid(colorEntries) {
    colorGrid.innerHTML = '';

    for (const [rgb, colorData] of colorEntries) {
        const div = document.createElement('div');
        div.className = 'color-item';
        div.setAttribute('draggable', 'true');
        div.dataset.id = colorData.id;
        div.dataset.rgb = rgb;
        div.dataset.name = colorData.name;

        div.title = `ID ${colorData.id}: ${colorData.name} (${rgb})`;

        // Create color swatch
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = `rgb(${rgb})`;

        // Create info section
        const info = document.createElement('div');
        info.className = 'color-info';

        const prioritySpan = document.createElement('span');
        prioritySpan.className = 'priority-number';
        prioritySpan.textContent = getCurrentPriority(div);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'color-name';
        nameSpan.textContent = colorData.name;

        info.appendChild(prioritySpan);
        info.appendChild(nameSpan);

        div.appendChild(swatch);
        div.appendChild(info);
        colorGrid.appendChild(div);
    }

    updateAllPriorities();
}

function togglePaidColors() {
    showAllColors= showPaidColors.checked;

    // Get current order before rebuilding
    const currentOrder = [...colorGrid.querySelectorAll('.color-item')].map(el => ({
        rgb: el.dataset.rgb,
        id: parseInt(el.dataset.id),
        name: el.dataset.name
    }));

    // Filter current order based on toggle state
    const filteredOrder = showAllColors?
        currentOrder : // Show all colors when showAllColorsis true
        currentOrder.filter(item => item.id <= 31); // Show only basic colors when showAllColorsis false

    // Rebuild grid with filtered colors, maintaining order
    colorGrid.innerHTML = '';

    // First add items that were already in the grid (in their current order)
    const addedIds = new Set();
    for (const item of filteredOrder) {
        if (colors[item.rgb]) {
            createAndAddColorItem(item.rgb, colors[item.rgb]);
            addedIds.add(item.id);
        }
    }

    // Then add any remaining colors that weren't in the current order
    const availableColors = getFilteredColors();
    for (const [rgb, colorData] of availableColors) {
        if (!addedIds.has(colorData.id)) {
            createAndAddColorItem(rgb, colorData);
        }
    }

    updateAllPriorities();

    window.scrollTo(0, document.body.scrollHeight);
}

function createAndAddColorItem(rgb, colorData) {
    const div = document.createElement('div');
    div.className = 'color-item';
    div.setAttribute('draggable', 'true');
    div.dataset.id = colorData.id;
    div.dataset.rgb = rgb;
    div.dataset.name = colorData.name;

    div.title = `ID ${colorData.id}: ${colorData.name} (${rgb})`;

    // Create color swatch
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = `rgb(${rgb})`;

    // Create info section
    const info = document.createElement('div');
    info.className = 'color-info';

    const prioritySpan = document.createElement('span');
    prioritySpan.className = 'priority-number';
    prioritySpan.textContent = getCurrentPriority(div);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'color-name';
    nameSpan.textContent = colorData.name;

    info.appendChild(prioritySpan);
    info.appendChild(nameSpan);

    div.appendChild(swatch);
    div.appendChild(info);
    colorGrid.appendChild(div);
}

function getCurrentPriority(element) {
    const items = Array.from(colorGrid.children);
    const index = items.indexOf(element);
    return index >= 0 ? index + 1 : colors[element.dataset.rgb].id;
}

function updateAllPriorities() {
    const items = colorGrid.querySelectorAll('.color-item');
    items.forEach((item, index) => {
        const prioritySpan = item.querySelector('.priority-number');
        if (prioritySpan) {
            prioritySpan.textContent = index + 1;
        }
    });
}

function handleDragStart(e) {
    if (!e.target.closest('.color-item')) return;

    draggedElement = e.target.closest('.color-item');
    draggedElement.classList.add('dragging');

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedElement.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    const colorItem = e.target.closest('.color-item');
    if (!colorItem || colorItem === draggedElement) return;
    colorItem.classList.add('drag-over');
}

function handleDragLeave(e) {
    const colorItem = e.target.closest('.color-item');
    if (!colorItem) return;
    colorItem.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    const dropTarget = e.target.closest('.color-item');

    if (dropTarget && dropTarget !== draggedElement && draggedElement) {
        // Get all current items
        const items = Array.from(colorGrid.children);
        const draggedIndex = items.indexOf(draggedElement);
        const dropIndex = items.indexOf(dropTarget);

        // Remove dragged element from DOM
        draggedElement.remove();

        // Insert dragged element at the correct position
        if (dropIndex < draggedIndex) {
            // Insert before the drop target
            colorGrid.insertBefore(draggedElement, dropTarget);
        } else {
            // Insert after the drop target
            const nextSibling = dropTarget.nextElementSibling;
            if (nextSibling) {
                colorGrid.insertBefore(draggedElement, nextSibling);
            } else {
                colorGrid.appendChild(draggedElement);
            }
        }
    }

    return false;
}

function handleDragEnd(e) {
    // Clean up all visual indicators
    const items = colorGrid.querySelectorAll('.color-item');
    items.forEach(item => {
        item.classList.remove('dragging', 'drag-over');
    });

    // Update all priority numbers after drag ends
    updateAllPriorities();

    draggedElement = null;
}

function resetOrder() {
    // Clear current grid
    colorGrid.innerHTML = '';

    // Rebuild in original numeric order
    const sortedColors = Object.entries(colors).sort((a, b) => a[1].id - b[1].id);
    for (const [rgb, colorData] of sortedColors) {
        const div = document.createElement('div');
        div.className = 'color-item';
        div.setAttribute('draggable', 'true');
        div.dataset.id = colorData.id;
        div.dataset.rgb = rgb;
        div.dataset.name = colorData.name;

        div.title = `ID ${colorData.id}: ${colorData.name} (${rgb})`;

        // Create color swatch
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = `rgb(${rgb})`;

        // Create info section
        const info = document.createElement('div');
        info.className = 'color-info';

        const prioritySpan = document.createElement('span');
        prioritySpan.className = 'priority-number';
        prioritySpan.textContent = getCurrentPriority(div);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'color-name';
        nameSpan.textContent = colorData.name;

        info.appendChild(prioritySpan);
        info.appendChild(nameSpan);

        div.appendChild(swatch);
        div.appendChild(info);
        colorGrid.appendChild(div);
    }
    updateAllPriorities();
}

// Fetch current color order
async function loadColorOrder(templateId = null) {
    const url = templateId ? 
        `/color-ordering?templateId=${templateId}` : 
        `/color-ordering`;
    const response = await fetch(url);
    return await response.json();
}

// Save color order
async function saveColorOrder(templateId = null) {
    const order = [...colorGrid.querySelectorAll('.color-item')].map(el => 
        parseInt(el.dataset.id)
    );
    
    const url = templateId ? 
        `/color-ordering/template/${templateId}` : 
        `/color-ordering/global`;
    
    await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
    });
}