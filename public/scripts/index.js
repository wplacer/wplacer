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
const useDitherDecoder = $("useDitherDecoder");
const turnstileNotifications = $("turnstileNotifications");
const accountCooldown = $("accountCooldown");
const purchaseCooldown = $("purchaseCooldown");
const dropletReserve = $("dropletReserve");
const antiGriefStandby = $("antiGriefStandby");
const chargeThreshold = $("chargeThreshold");
const chargeThresholdContainer = $("chargeThresholdContainer");
const totalCharges = $("totalCharges");
const totalMaxCharges = $("totalMaxCharges");
const messageBoxOverlay = $("messageBoxOverlay");
// add reference for new toggle
const alwaysDrawOnCharge = $("alwaysDrawOnCharge");
const messageBoxTitle = $("messageBoxTitle");
const messageBoxContent = $("messageBoxContent");
const messageBoxConfirm = $("messageBoxConfirm");
const messageBoxCancel = $("messageBoxCancel");

// Message Box
let confirmCallback = null;

const userCount = $("userCount");

function updateUserCount() {
    userCount.textContent = `(${userList.children.length})`;
}


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
        } else {
            message = errMsg; // Show the full error if it's not a known one
        }
    }
    showMessage("Error", message);
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

const ditherimgdecoder = async (imageData, width, height) => {
    const data = imageData.data;
    const matrix = Array.from({ length: width }, () => Array(height).fill(0));
    let ink = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const a = data[idx + 3];
            if (a !== 255) {
                matrix[x][y] = 0;
                continue;
            }

            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            const id = closest(`${r},${g},${b}`);
            const [nr, ng, nb] = colorById(id).split(',').map(Number);
            
            matrix[x][y] = id;
            ink++;

            const errR = r - nr;
            const errG = g - ng;
            const errB = b - nb;
            const distribute = (dx, dy, factor) => {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
                const nIdx = (ny * width + nx) * 4;
                data[nIdx]     = Math.max(0, Math.min(255, data[nIdx]     + errR * factor));
                data[nIdx + 1] = Math.max(0, Math.min(255, data[nIdx + 1] + errG * factor));
                data[nIdx + 2] = Math.max(0, Math.min(255, data[nIdx + 2] + errB * factor));
            };
            distribute(1, 0, 7 / 16);
            distribute(-1, 1, 3 / 16);
            distribute(0, 1, 5 / 16);
            distribute(1, 1, 1 / 16);
        }
        if (y % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { matrix, ink };
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

            const { matrix, ink } = useDitherDecoder.checked
                ? await ditherimgdecoder(imageData, canvas.width, canvas.height)
                : nearestimgdecoder(imageData, canvas.width, canvas.height);

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
        for (const id of Object.keys(users)) {
            const user = document.createElement('div');
            user.className = 'user';
            user.id = `user-${id}`;
            user.innerHTML = `
                <div class="user-info">
                    <span>${users[id].name}</span>
                    <span>(#${id})</span>
                    <div class="user-stats">
                        Charges: <b>?</b>/<b>?</b> | Level <b>?</b> <span class="level-progress">(?%)</span>
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
        updateUserCount();
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
                template.append(buttons);
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
        alwaysDrawOnCharge.checked = !!currentSettings.alwaysDrawOnCharge;
        chargeThresholdContainer.style.display = alwaysDrawOnCharge.checked ? 'none' : 'block';
        useDitherDecoder.checked = !!currentSettings.useDitherDecoder;
    } catch (error) {
        handleError(error);
    }
    changeTab(settings);
});

// Settings
drawingModeSelect.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { drawingMethod: drawingModeSelect.value });
        showMessage("Success", "Drawing mode saved!");
    } catch (error) {
        handleError(error);
    }
});

turnstileNotifications.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { turnstileNotifications: turnstileNotifications.checked });
        showMessage("Success", "Notification setting saved!");
    } catch (error) {
        handleError(error);
    }
});

accountCooldown.addEventListener('change', async () => {
    try {
        const newCooldown = parseInt(accountCooldown.value, 10) * 1000;
        if (isNaN(newCooldown) || newCooldown < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { accountCooldown: newCooldown });
        showMessage("Success", "Account cooldown saved!");
    } catch (error) {
        handleError(error);
    }
});

purchaseCooldown.addEventListener('change', async () => {
    try {
        const newCooldown = parseInt(purchaseCooldown.value, 10) * 1000;
        if (isNaN(newCooldown) || newCooldown < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { purchaseCooldown: newCooldown });
        showMessage("Success", "Purchase cooldown saved!");
    } catch (error) {
        handleError(error);
    }
});

dropletReserve.addEventListener('change', async () => {
    try {
        const newReserve = parseInt(dropletReserve.value, 10);
        if (isNaN(newReserve) || newReserve < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { dropletReserve: newReserve });
        showMessage("Success", "Droplet reserve saved!");
    } catch (error) {
        handleError(error);
    }
});

antiGriefStandby.addEventListener('change', async () => {
    try {
        const newStandby = parseInt(antiGriefStandby.value, 10) * 60000;
        if (isNaN(newStandby) || newStandby < 60000) {
            showMessage("Error", "Please enter a valid number (at least 1 minute).");
            return;
        }
        await axios.put('/settings', { antiGriefStandby: newStandby });
        showMessage("Success", "Anti-grief standby time saved!");
    } catch (error) {
        handleError(error);
    }
});

outlineMode.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { outlineMode: outlineMode.checked });
        showMessage("Success", "Outline mode saved!");
    } catch (error) {
        handleError(error);
    }
});

useDitherDecoder.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { useDitherDecoder: useDitherDecoder.checked });
        showMessage("Success", "Color decoder setting saved!");
        if (convertInput.files && convertInput.files[0]) {
            processImageFile(convertInput.files[0], (template) => {
                currentTemplate = template;
                drawTemplate(template, templateCanvas);
                size.innerHTML = `${template.width}x${template.height}px`;
                ink.innerHTML = template.ink;
                details.style.display = "block";
            });
        }
    } catch (error) {
        handleError(error);
    }
});

chargeThreshold.addEventListener('change', async () => {
    try {
        const newThreshold = parseInt(chargeThreshold.value, 10);
        if (isNaN(newThreshold) || newThreshold < 1 || newThreshold > 100) {
            showMessage("Error", "Please enter a valid percentage between 1 and 100.");
            return;
        }
        await axios.put('/settings', { chargeThreshold: newThreshold / 100 });
        showMessage("Success", "Charge threshold saved!");
    } catch (error) {
        handleError(error);
    }
});

// New toggle: alwaysDrawOnCharge
alwaysDrawOnCharge.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { alwaysDrawOnCharge: alwaysDrawOnCharge.checked });
        showMessage("Success", "Always-draw-on-charge setting saved!");
        // Hide the threshold input if immediate-draw is enabled, show otherwise
        chargeThresholdContainer.style.display = alwaysDrawOnCharge.checked ? 'none' : 'block';
        // Wake running templates so they re-evaluate immediately
        // (server will also wake them; this keeps UI responsive)
    } catch (error) {
        handleError(error);
    }
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

window.addEventListener("DOMContentLoaded", updateUserCount);
