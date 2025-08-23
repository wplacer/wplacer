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
const previewBorder = $("previewBorder");
const templateForm = $("templateForm");
const templateFormTitle = $("templateFormTitle");
const convertInput = $("convertInput");
const addImage = $("addImage");
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
const usePaidColors = $("usePaidColors");

// Message Box
let confirmCallback = null;

// Progress bar cache
let templateProgressCache = {};

// Valid colors in the pallette
const allowedColors = [
    [0,0,0],       // Black
    [60,60,60],    // Dark Gray
    [120,120,120], // Gray
    [210,210,210], // Light Gray
    [255,255,255], // White
    [96,0,24],     // Deep Red
    [237,28,36],   // Red
    [255,127,39],  // Orange
    [246,170,9],   // Gold
    [249,221,59],  // Yellow (fixed from your original)
    [255,250,188], // Light Yellow
    [14,185,104],  // Dark Green
    [19,230,123],  // Green (fixed from your original)
    [135,255,94],  // Light Green
    [12,129,110],  // Dark Teal (fixed from your original)
    [16,174,166],  // Teal (fixed from your original)
    [19,225,190],  // Light Teal
    [96,247,242],  // Cyan
    [40,80,158],   // Dark Blue
    [64,147,228],  // Blue
    [107,80,246],  // Indigo
    [153,177,251], // Light Indigo (fixed from your original)
    [120,12,153],  // Dark Purple (fixed from your original)
    [170,56,185],  // Purple (fixed from your original)
    [224,159,249], // Light Purple
    [203,0,122],   // Dark Pink
    [236,31,128],  // Pink
    [243,141,169], // Light Pink (fixed from your original)
    [104,70,52],   // Dark Brown
    [149,104,42],  // Brown
    [248,178,119], // Beige

    // Premium colors
    [170,170,170], // Additional gray
    [165,14,30],   // Dark red variant
    [250,128,114], // Salmon
    [228,92,26],   // Orange variant
    [214,181,148], // Tan
    [156,132,49],  // Olive
    [197,173,49],  // Gold variant
    [232,212,95],  // Light gold
    [74,107,58],   // Dark green variant
    [90,148,74],   // Green variant
    [132,197,115], // Light green variant
    [15,121,159],  // Dark blue variant
    [187,250,242], // Light cyan
    [125,199,255], // Light blue
    [77,49,184],   // Purple variant
    [74,66,132],   // Dark purple variant
    [122,113,196], // Purple variant
    [181,174,241], // Light purple variant
    [219,164,99],  // Brown variant
    [209,128,81],  // Brown variant
    [255,197,165], // Peach
    [155,82,73],   // Brown variant
    [209,128,120], // Pink-brown
    [250,182,164], // Light peach
    [123,99,82],   // Brown variant
    [156,132,107], // Brown variant
    [51,57,65],    // Dark gray variant
    [109,117,141], // Gray variant
    [179,185,209], // Light gray variant
    [109,100,63],  // Brown variant
    [148,140,107], // Brown variant
    [205,197,158]  // Light brown
];


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
            if (color === -1) {
                imageData.data[i] = 158;
                imageData.data[i + 1] = 189;
                imageData.data[i + 2] = 255;
                imageData.data[i + 3] = 255;
                continue;
            };
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
    const radius = Math.max(0, parseInt(previewBorder.value, 10) || 0);
    
    const startX = txVal * TILE_SIZE + pxVal - radius;
    const startY = tyVal * TILE_SIZE + pyVal - radius;
    const displayWidth = width + (radius * 2);
    const displayHeight = height + (radius * 2);
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

    const baseImage = ctx.getImageData(0, 0, displayWidth, displayHeight);
    const templateCtx = templateCanvas.getContext('2d');
    const templateImage = templateCtx.getImageData(0, 0, width, height);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(templateCanvas, radius, radius);
    ctx.globalAlpha = 1;
    const b = baseImage.data;
    const t = templateImage.data;
    for (let i = 0; i < t.length; i += 4) {
        // skip transparent template pixels
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
                const rgb = `${r},${g},${b}`;
                if (rgb == "158,189,255") matrix[x][y] = -1;
                else {
                    const id = colors[rgb] && usePaidColors.checked ? colors[rgb] : closest(rgb);
                    matrix[x][y] = id;
                };
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

const isValidColor = (r, g, b) => {
    return allowedColors.some(color => {
        const [cr, cg, cb] = color; // This is now correct
        return r === cr && g === cg && b === cb;
    });
};


const processEvent = (event) => {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    templateName.value = file.name.replace(/\.[^/.]+$/, "");

    if (input.id === "convertInput") {
        // --- Convert Image behavior ---
        processImageFile(file, (template) => {
            currentTemplate = template;
            drawTemplate(template, templateCanvas);
            size.innerHTML = `${template.width}x${template.height}px`;
            ink.innerHTML = template.ink;
            details.style.display = "block";
        });
    } else if (input.id === "addImage") {
        // --- Add Image behavior with validation ---
        const img = new Image();
        img.onload = () => {
            // Draw image on a temporary canvas to access pixel data
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;

            // Check every pixel
            let invalidPixelCount = 0;
            let firstInvalidColor = null;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // Skip transparent pixels
                if (a === 0) continue;

                if (!isValidColor(r, g, b)) {
                    invalidPixelCount++;
                    if (!firstInvalidColor) {
                        firstInvalidColor = `RGB(${r}, ${g}, ${b})`;
                    }
                    
                    // Stop checking after finding too many invalid pixels for performance
                    if (invalidPixelCount > 100) break;
                }
            }

            if (invalidPixelCount > 0) {
                showMessage(
                    "Invalid Colors Detected", 
                    `Image contains ${invalidPixelCount > 100 ? '100+' : invalidPixelCount} invalid color(s).<br><br>` +
                    `First invalid color found: <strong>${firstInvalidColor}</strong><br><br>` +
                    `Only colors from the allowed palette are permitted. Please use the "Convert Image" option instead, ` +
                    `which will automatically convert colors to the nearest valid palette colors.`
                );
                // Clear the file input
                input.value = '';
                return;
            }

            // If validation passes, proceed with the image
            templateCanvas.width = img.width;
            templateCanvas.height = img.height;
            const ctx = templateCanvas.getContext("2d");
            ctx.clearRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0);

            size.innerHTML = `${img.width}x${img.height}px`;
            
            // Calculate ink (non-transparent pixels)
            let inkCount = 0;
            for (let i = 3; i < data.length; i += 4) { // Check alpha channel
                if (data[i] > 0) inkCount++;
            }
            ink.innerHTML = inkCount;
            details.style.display = "block";

            // Store template (convert image data to matrix format)
            const matrix = Array.from({ length: img.width }, () => Array(img.height).fill(0));
            for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                    const i = (y * img.width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    
                    if (a > 0) {
                        const rgb = `${r},${g},${b}`;
                        const colorId = colors[rgb];
                        matrix[x][y] = colorId || 1; // Default to black if somehow not found
                    }
                }
            }
            
            currentTemplate = { 
                width: img.width, 
                height: img.height, 
                data: matrix,
                ink: inkCount
            };
            
            showMessage("Success", "Image validated and loaded successfully! All colors are valid.");
        };
        
        img.onerror = () => {
            showMessage("Error", "Failed to load the image. Please try a different file.");
            input.value = '';
        };
        
        img.src = URL.createObjectURL(file);
    }
};

convertInput.addEventListener('change', processEvent);
addImage.addEventListener('change', processEvent); // EVENT LISTENER FOR DIRECT ADD
usePaidColors.addEventListener('change', processEvent);

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
    
    // Remove existing image note if present
    const existingNote = document.getElementById('existingImageNote');
    if (existingNote) existingNote.remove();
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
                    <button class="info-btn" title="Get User Info"><img src="icons/code.svg"></button>
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
            user.querySelector('.info-btn').addEventListener("click", async () => {
                try {
                    const response = await axios.get(`/user/status/${id}`);
                    const info = `
                    <b>User Name:</b> <span style="color: #f97a1f;">${response.data.name}</span><br>
                    <b>Charges:</b> <span style="color: #f97a1f;">${Math.floor(response.data.charges.count)}</span>/<span style="color: #f97a1f;">${response.data.charges.max}</span><br>
                    <b>Droplets:</b> <span style="color: #f97a1f;">${response.data.droplets}</span><br>
                    <b>Favorite Locations:</b> <span style="color: #f97a1f;">${response.data.favoriteLocations.length}</span>/<span style="color: #f97a1f;">${response.data.maxFavoriteLocations}</span><br>
                    <b>Flag Equipped:</b> <span style="color: #f97a1f;">${response.data.equippedFlag ? "Yes" : "No"}</span><br>
                    <b>Discord:</b> <span style="color: #f97a1f;">${response.data.discord}</span><br>
                    <b>Country:</b> <span style="color: #f97a1f;">${response.data.country}</span><br>
                    <b>Pixels Painted:</b> <span style="color: #f97a1f;">${response.data.pixelsPainted}</span><br>
                    <b>Extra Colors:</b> <span style="color: #f97a1f;">${response.data.extraColorsBitmap}</span><br>
                    <b>Alliance ID:</b> <span style="color: #f97a1f;">${response.data.allianceId}</span><br>
                    <b>Alliance Role:</b> <span style="color: #f97a1f;">${response.data.allianceRole}</span><br>
                    <br>Would you like to copy the <b>Raw Json</b> to your clipboard?
                    `;

                    showConfirmation("User Info", info, () => {
                        navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
                    });
                } catch (error) {
                    handleError(error);
                };
            });
            userList.appendChild(user);
        };
    });
    changeTab(manageUsers);
});

// Enhanced showExistingTemplateImage function with preview capability:
const showExistingTemplateImage = (template, coords) => {
    if (template && template.width > 0) {
        currentTemplate = template;
        drawTemplate(template, templateCanvas);
        size.innerHTML = `${template.width}x${template.height}px`;
        ink.innerHTML = template.ink || calculateTemplateInk(template);
        details.style.display = "block";
        
        // Remove existing note if present
        const existingNote = document.getElementById('existingImageNote');
        if (existingNote) existingNote.remove();
        
        const existingImageNote = document.createElement('div');
        existingImageNote.id = 'existingImageNote';
        existingImageNote.className = 'existing-image-note';
        existingImageNote.style.cssText = `
            margin: 10px 0;
            padding: 10px;
            background-color: var(--accent-secondary, #3f3f3fff);
            border: 1px solid var(--accent-primary, #e2b24bff);
            border-radius: 6px;
            color: var(--text-primary, #1e293b);
            font-size: 14px;
        `;
        existingImageNote.innerHTML = '📋 <strong>Current Template Image</strong> - Upload a new image to replace it';
        
        details.parentNode.insertBefore(existingImageNote, details.nextSibling);

        // Auto-trigger preview if coordinates are provided
        if (coords && coords.length === 4) {
            setTimeout(async () => {
                try {
                    await fetchCanvas(coords[0], coords[1], coords[2], coords[3], template.width, template.height);
                } catch (error) {
                    console.warn('Could not auto-load preview:', error);
                }
            }, 100);
        }
    }
};

// Function to calculate template ink if not provided
const calculateTemplateInk = (template) => {
    let ink = 0;
    for (let x = 0; x < template.width; x++) {
        for (let y = 0; y < template.height; y++) {
            if (template.data[x][y] !== 0) ink++;
        }
    }
    return ink;
};

// Modified createProgressBar to use cached data if available
const createProgressBar = (templateId, fallbackPercentage = 0, fallbackStatus = 'Loading...') => {
    console.log(`Creating progress bar for template ${templateId}`);
    
    // Check if we have cached progress data
    const cachedProgress = templateProgressCache[templateId];
    let percentage = fallbackPercentage;
    let status = fallbackStatus;
    
    if (cachedProgress) {
        console.log(`Using cached progress for template ${templateId}:`, cachedProgress);
        percentage = cachedProgress.percentage || 0;
        
        // Add age indicator to status if cache is old
        const ageMinutes = Math.floor((Date.now() - cachedProgress.lastUpdated) / (1000 * 60));
        if (ageMinutes > 0) {
            status = `${cachedProgress.status} (${ageMinutes}m ago)`;
        } else {
            status = cachedProgress.status || 'Loading...';
        }
    }
    
// Progress bar that uses cached data
const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.cssText = `
        margin: 10px 0;
        padding: 8px;
        border-top: 1px solid #444;
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
    `;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.cssText = `
        position: relative;
        width: 100%;
        height: 24px;
        background-color: #2a2a2a;
        border: 1px solid #555;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 8px;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    const safePercentage = Math.min(Math.max(percentage || 0, 0), 100);
    progressFill.style.cssText = `
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #2563eb);
        border-radius: 12px;
        transition: width 0.5s ease;
        width: ${safePercentage}%;
    `;
    
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 12px;
        font-weight: bold;
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        z-index: 2;
    `;
    progressText.textContent = `${Math.round(safePercentage)}%`;
    
    progressBar.appendChild(progressFill);
    progressBar.appendChild(progressText);
    progressContainer.appendChild(progressBar);
    
    const progressStatus = document.createElement('div');
    progressStatus.className = 'progress-status';
    progressStatus.style.cssText = `
        font-size: 12px;
        color: #ccc;
        text-align: center;
        font-weight: normal;
    `;
    progressStatus.textContent = status;
    
    progressContainer.appendChild(progressStatus);
    
    console.log('Progress bar created successfully with cached data');
    return progressContainer;
};

const updateTemplateProgress = async (templateId, progressContainer) => {
    console.log(`Updating progress for template ${templateId}`);
    
    try {
        const response = await axios.get(`/template/progress/${templateId}`);
        console.log(`Progress response for ${templateId}:`, response.data);
        
        const { percentage, status, totalPixels, completedPixels, pixelsLeft, running } = response.data;
        
        // Cache the progress data
        templateProgressCache[templateId] = {
            percentage,
            status,
            totalPixels,
            completedPixels,
            pixelsLeft,
            running,
            lastUpdated: Date.now()
        };
        
        updateProgressBarDisplay(templateId, progressContainer, response.data);
        
    } catch (error) {
        console.error(`Error updating progress for template ${templateId}:`, error);
        
        const progressStatus = progressContainer.querySelector('.progress-status');
        if (progressStatus) {
            progressStatus.textContent = 'Error loading progress';
            progressStatus.style.color = '#ef4444';
        }
    }
};

// Function to update progress bar
const updateProgressBarDisplay = (templateId, progressContainer, progressData) => {
    const { percentage, status, totalPixels, completedPixels, pixelsLeft, running } = progressData;
    
    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressText = progressContainer.querySelector('.progress-text');
    const progressStatus = progressContainer.querySelector('.progress-status');
    
    console.log('Progress elements found:', {
        progressFill: !!progressFill,
        progressText: !!progressText,
        progressStatus: !!progressStatus
    });
    
    if (progressFill && progressText && progressStatus) {
        const safePercentage = Math.min(Math.max(percentage || 0, 0), 100);
        console.log(`Setting progress to ${safePercentage}%`);
        
        progressFill.style.width = `${safePercentage}%`;
        progressText.textContent = `${Math.round(safePercentage)}%`;
        
        let statusText;
        if (totalPixels > 0) {
            statusText = `${completedPixels}/${totalPixels} pixels (${pixelsLeft} remaining) - ${status}`;
        } else {
            statusText = status || 'Loading...';
        }
        progressStatus.textContent = statusText;
        console.log('Status text set to:', statusText);

        // Update progress bar color based on status
        let backgroundColor;
        if (safePercentage >= 100) {
            backgroundColor = 'linear-gradient(90deg, #10b981, #22c55e)';
        } else if (running) {
            backgroundColor = 'linear-gradient(90deg, #3b82f6, #2563eb)';
        } else {
            backgroundColor = 'linear-gradient(90deg, #6b7280, #9ca3af)';
        }
        progressFill.style.background = backgroundColor;
        console.log('Background set to:', backgroundColor);
    } else {
        console.error('Could not find progress bar elements');
    }
};

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
            
            // Get the template container (parent of the info span)
            const templateContainer = statusSpan.closest('.template');
            
            if (!isRunning) {
                // Template is being started - add progress bar
                console.log(`Adding progress bar for started template ${id}`);
                
                // Check if progress bar already exists
                let progressContainer = templateContainer.querySelector('.progress-container');
                if (!progressContainer) {
                    progressContainer = createProgressBar(id); // Pass template ID for cached data
                    
                    // Insert progress bar after the info span but before the canvas
                    const canvas = templateContainer.querySelector('canvas');
                    templateContainer.insertBefore(progressContainer, canvas);
                    
                    // Initial progress update with delay to ensure DOM is ready
                    setTimeout(() => {
                        updateTemplateProgress(id, progressContainer);
                    }, 100);
                    
                    // Set up periodic updates
                    const progressInterval = setInterval(() => {
                        updateTemplateProgress(id, progressContainer);
                    }, parseInt(accountCooldown.value) * 100);
                    
                    progressContainer.dataset.intervalId = progressInterval.toString();
                    console.log(`Set interval ${progressInterval} for template ${id}`);
                }
            } else {
                // Template is being stopped - remove progress bar
                console.log(`Removing progress bar for stopped template ${id}`);
                
                const progressContainer = templateContainer.querySelector('.progress-container');
                if (progressContainer) {
                    // Clear the interval
                    const intervalId = progressContainer.dataset.intervalId;
                    if (intervalId) {
                        clearInterval(parseInt(intervalId));
                        console.log(`Cleared interval ${intervalId} for template ${id}`);
                    }
                    
                    // Remove the progress bar (but keep cached data)
                    progressContainer.remove();
                }
            }
            
            // Create new button with updated state
            const newButton = createToggleButton(template, id, buttonsContainer, statusSpan);
            button.replaceWith(newButton);
            statusSpan.textContent = `Status: ${!isRunning ? 'Started' : 'Stopped'}`;
            
        } catch (error) {
            handleError(error);
        }
    });
    return button;
};

const createEditButton = (t, id) => {
    const editButton = document.createElement('button');
    editButton.className = 'secondary-button';
    editButton.innerHTML = '<img src="icons/settings.svg">Edit Template';
    editButton.addEventListener('click', () => {
        openAddTemplate.click();
        templateFormTitle.textContent = `Edit Template: ${t.name}`;
        submitTemplate.innerHTML = '<img src="icons/edit.svg">Save Changes';
        templateForm.dataset.editId = id;

        // Set form values
        templateName.value = t.name;
        [tx.value, ty.value, px.value, py.value] = t.coords;
        canBuyCharges.checked = t.canBuyCharges;
        canBuyMaxCharges.checked = t.canBuyMaxCharges;
        antiGriefMode.checked = t.antiGriefMode;

        // Select users
        document.querySelectorAll('input[name="user_checkbox"]').forEach(cb => {
            cb.checked = t.userIds.includes(cb.value);
        });

        // Show existing template image with auto-preview
        showExistingTemplateImage(t.template, t.coords);
    });
    return editButton;
};

// Fixed template management with better error handling
openManageTemplates.addEventListener("click", () => {
    console.log('Loading templates...');
    templateList.innerHTML = "";
    
    // Clean up any existing intervals
    const existingIntervals = document.querySelectorAll('[data-interval-id]');
    existingIntervals.forEach(element => {
        const intervalId = element.dataset.intervalId;
        if (intervalId) {
            clearInterval(parseInt(intervalId));
        }
    });
    
    loadUsers(users => {
        loadTemplates(templates => {
            console.log('Templates loaded:', Object.keys(templates).length);
            
            for (const id of Object.keys(templates)) {
                const t = templates[id];
                console.log(`Processing template ${id}, running: ${t.running}`);
                
                const userListFormatted = t.userIds.map(userId => {
                    const user = users[userId];
                    return user ? `${user.name}#${userId}` : `Unknown#${userId}`;
                }).join(", ");

                const template = document.createElement('div');
                template.id = id;
                template.className = "template";
                
                const infoSpan = document.createElement('span');
                infoSpan.innerHTML = `
                    <b>Template Name:</b> ${t.name}<br>
                    <b>Assigned Accounts:</b> ${userListFormatted}<br>
                    <b>Coordinates:</b> ${t.coords.join(", ")}<br>
                    <b>Buy Max Charge Upgrades:</b> ${t.canBuyMaxCharges ? "Yes" : "No"}<br>
                    <b>Buy Extra Charges:</b> ${t.canBuyCharges ? "Yes" : "No"}<br>
                    <b>Anti-Grief Mode:</b> ${t.antiGriefMode ? "Yes" : "No"}<br>
                    <b class="status-text">Status:</b> ${t.status}
                `;
                template.appendChild(infoSpan);

                // Add progress bar if template is running
                if (t.running) {
                    console.log(`Adding progress bar for running template ${id}`);
                    
                    const progressContainer = createProgressBar(id); // Pass template ID for cached data
                    template.appendChild(progressContainer);
                    
                    // Initial progress update with delay to ensure DOM is ready
                    setTimeout(() => {
                        updateTemplateProgress(id, progressContainer);
                    }, 100);
                    
                    // Set up periodic updates
                    const progressInterval = setInterval(() => {
                        updateTemplateProgress(id, progressContainer);
                    }, parseInt(accountCooldown.value) * 1000);
                    
                    progressContainer.dataset.intervalId = progressInterval.toString();
                    console.log(`Set interval ${progressInterval} for template ${id}`);
                } else {
                    console.log(`Template ${id} is not running, no progress bar added`);
                }

                const canvas = document.createElement("canvas");
                drawTemplate(t.template, canvas);
                
                const buttons = document.createElement('div');
                buttons.className = "template-actions";

                const toggleButton = createToggleButton(t, id, buttons, infoSpan.querySelector('.status-text'));
                buttons.appendChild(toggleButton);
                
                const editButton = createEditButton(t, id);
                buttons.appendChild(editButton);

                const delButton = document.createElement('button');
                delButton.className = 'destructive-button';
                delButton.innerHTML = '<img src="icons/remove.svg">Delete Template';
                delButton.addEventListener("click", () => {
                    showConfirmation(
                        "Delete Template",
                        `Are you sure you want to delete template "${t.name}"?`,
                        async () => {
                            try {
                                // Clear interval if it exists
                                const progressContainer = template.querySelector('[data-interval-id]');
                                if (progressContainer) {
                                    const intervalId = progressContainer.dataset.intervalId;
                                    if (intervalId) {
                                        clearInterval(parseInt(intervalId));
                                    }
                                }
                                
                                await axios.delete(`/template/${id}`);
                                openManageTemplates.click();
                            } catch (error) {
                                handleError(error);
                            }
                        }
                    );
                });
                buttons.appendChild(delButton);
                
                template.append(canvas, buttons);
                templateList.append(template);
            }
            
            console.log('All templates processed');
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