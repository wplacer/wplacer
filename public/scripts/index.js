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
const templateForm = $("templateForm");
const convertInput = $("convertInput");
const replaceInput = $("replaceInput");
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
const turnstileNotifications = $("turnstileNotifications");
const accountCooldown = $("accountCooldown");
const dropletReserve = $("dropletReserve");
const antiGriefStandby = $("antiGriefStandby");
const totalCharges = $("totalCharges");
const totalMaxCharges = $("totalMaxCharges");
const messageBoxOverlay = $("messageBoxOverlay");
const messageBoxTitle = $("messageBoxTitle");
const messageBoxContent = $("messageBoxContent");
const messageBoxConfirm = $("messageBoxConfirm");
const messageBoxCancel = $("messageBoxCancel");

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
const colors = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31 };
const colorById = (id) => Object.keys(colors).find(key => colors[key] === id);
const closest = color => {
    const [tr, tg, tb] = color.split(',').map(Number);
    return colors[Object.keys(colors).reduce((closest, current) => {
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
let currentTemplate = { width: 0, height: 0, data: [] };
const processImageFile = (file, callback) => {
    if (file) {
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
                const template = { width: canvas.width, height: canvas.height, ink: 0, data: Array.from({ length: canvas.width }, () => []) };
                const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let x = 0; x < canvas.width; x++) {
                    for (let y = 0; y < canvas.height; y++) {
                        const i = (y * canvas.width + x) * 4;
                        const [r, g, b, a] = [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
                        if (a === 255) {
                            template.data[x][y] = closest(`${r},${g},${b}`);
                            template.ink += 1;
                        } else template.data[x][y] = 0;
                    };
                };
                canvas.remove();
                callback(template);
            };
        };
        reader.readAsDataURL(file);
    }
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
replaceInput.addEventListener('change', async () => {
    const templateId = replaceInput.dataset.templateId;
    if (!templateId) return;

    processImageFile(replaceInput.files[0], async (newTemplate) => {
        try {
            await axios.put(`/template/image/${templateId}`, { template: newTemplate });
            showMessage("Success", "Template image has been replaced!");
            openManageTemplates.click();
        } catch (error) {
            handleError(error);
        } finally {
            delete replaceInput.dataset.templateId;
            replaceInput.value = '';
        }
    });
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

templateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentTemplate || currentTemplate.width === 0) {
        showMessage("Error", "Please convert an image before creating a template.");
        return;
    }
    const selectedUsers = Array.from(document.querySelectorAll('input[name="user_checkbox"]:checked')).map(cb => cb.value);
    if (selectedUsers.length === 0) {
        showMessage("Error", "Please select at least one user.");
        return;
    }
    try {
        const response = await axios.post('/template', {
            templateName: templateName.value,
            template: currentTemplate,
            coords: [tx.value, ty.value, px.value, py.value].map(Number),
            userIds: selectedUsers,
            canBuyCharges: canBuyCharges.checked,
            canBuyMaxCharges: canBuyMaxCharges.checked,
            antiGriefMode: antiGriefMode.checked
        });
        if (response.status === 200) {
            showMessage("Success", "Created! Go to \"Manage Templates\" to start and check console for details.");
            templateForm.reset();
            document.querySelectorAll('input[name="user_checkbox"]').forEach(cb => cb.checked = false);
        }
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
                <div class="left">
                    <span>${users[id].name}</span>
                    <span>(#${id})</span>
                    <div class="user-stats">
                        Charges: <span class="current-charges">?</span>/<span class="max-charges">?</span> - <span class="current-level">Level ?</span> <span class="level-progress">(?)</span></b>
                    </div>
                </div>
                <div class="right">
                    <button class="delete-btn" title="Delete User"><img src="icons/remove.svg"></button>
                    <button class="json-btn" title="Get Raw Json"><img src="icons/code.svg"></button>
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
                    const userData = await axios.get(`/user/status/${id}`);
                    showMessage("Raw Json", JSON.stringify(userData.data, null, 2));
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
        const leftSpans = userEl.querySelectorAll('.left > span');
        const currentChargesEl = userEl.querySelector('.current-charges');
        const maxChargesEl = userEl.querySelector('.max-charges');
        const currentLevelEl = userEl.querySelector('.current-level');
        const levelProgressEl = userEl.querySelector('.level-progress');

        leftSpans.forEach(span => span.style.color = 'var(--warning-color)');
        try {
            const response = await axios.get(`/user/status/${id}`);
            const userInfo = response.data;
            
            const charges = Math.floor(userInfo.charges.count);
            const max = userInfo.charges.max;
            const level = Math.floor(userInfo.level);
            const progress = Math.round((userInfo.level % 1) * 100);;

            currentChargesEl.textContent = charges;
            maxChargesEl.textContent = max;
            currentLevelEl.textContent = `Level ${level}`;
            levelProgressEl.textContent = `(${progress}%)`;
            totalCurrent += charges;
            totalMax += max;

            leftSpans.forEach(span => span.style.color = 'var(--success-color)');
        } catch (error) {
            currentChargesEl.textContent = "ERR";
            maxChargesEl.textContent = "ERR";
            leftSpans.forEach(span => span.style.color = 'var(--error-color)');
        }
    });

    await processInParallel(tasks, 5);

    totalCharges.textContent = totalCurrent;
    totalMaxCharges.textContent = totalMax;

    checkUserStatus.disabled = false;
    checkUserStatus.innerHTML = '<img src="icons/check.svg">Check Account Status';
});
openAddTemplate.addEventListener("click", () => {
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
                template.innerHTML = `<span><b>Template Name:</b> ${t.name}<br><b>Assigned Accounts:</b> ${userListFormatted}<br><b>Coordinates:</b> ${t.coords.join(", ")}<br><b>Buy Max Charge Upgrades:</b> ${t.canBuyMaxCharges ? "Yes" : "No"}<br><b>Buy Extra Charges:</b> ${t.canBuyCharges ? "Yes" : "No"}<br><b>Anti-Grief Mode:</b> ${t.antiGriefMode ? "Yes" : "No"}<br><b>Status:</b> ${t.status}</span>`;

                const canvas = document.createElement("canvas");
                drawTemplate(t.template, canvas);
                const buttons = document.createElement('div');
                buttons.className = "buttons";
                const toggleButton = document.createElement('button');
                toggleButton.className = 'primary-button';
                toggleButton.innerHTML = `<img src="icons/${t.running ? 'pause' : 'play'}.svg">${t.running ? 'Stop' : 'Start'} Template`;
                toggleButton.addEventListener('click', async () => {
                    try {
                        await axios.put(`/template/${id}`, { running: !t.running });
                        t.running = !t.running;
                        toggleButton.innerHTML = `<img src="icons/${t.running ? 'pause' : 'play'}.svg">${t.running ? 'Stop' : 'Start'} Template`;
                        showMessage("Success", "Success! Check console for details.");
                    } catch (error) {
                        handleError(error);
                    };
                });
                const restartButton = document.createElement('button');
                restartButton.className = 'destructive-button';
                restartButton.innerHTML = '<img src="icons/restart.svg">Restart Template';
                restartButton.addEventListener('click', async () => {
                    showConfirmation(
                        "Restart Template",
                        `Are you sure you want to restart template "${t.name}"? This will stop it and start it from the beginning.`,
                        async () => {
                            try {
                                await axios.put(`/template/restart/${id}`);
                                showMessage("Success", "Restarting template! Check console for details.");
                                openManageTemplates.click();
                            } catch (error) {
                                handleError(error);
                            };
                        }
                    );
                });
                const replaceButton = document.createElement('button');
                replaceButton.className = 'secondary-button';
                replaceButton.innerHTML = '<img src="icons/replaceImage.svg">Replace Image';
                replaceButton.addEventListener('click', () => {
                    replaceInput.dataset.templateId = id;
                    replaceInput.click();
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
                buttons.append(toggleButton);
                buttons.append(restartButton);
                buttons.append(replaceButton);
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
        accountCooldown.value = currentSettings.accountCooldown / 1000;
        dropletReserve.value = currentSettings.dropletReserve;
        antiGriefStandby.value = currentSettings.antiGriefStandby / 60000;
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
            showMessage("Error", "Please enter a valid non-negative number for the cooldown.");
            return;
        }
        await axios.put('/settings', { accountCooldown: newCooldown });
        showMessage("Success", "Account cooldown saved!");
    } catch (error) {
        handleError(error);
    }
});

dropletReserve.addEventListener('change', async () => {
    try {
        const newReserve = parseInt(dropletReserve.value, 10);
        if (isNaN(newReserve) || newReserve < 0) {
            showMessage("Error", "Please enter a valid non-negative number for the droplet reserve.");
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

tx.addEventListener('blur', () => {
    const value = tx.value.trim();
    const parts = value.split(/\s+/);
    if (parts.length === 4) {
        tx.value = parts[0].replace(/[^0-9]/g, '');
        ty.value = parts[1].replace(/[^0-9]/g, '');
        px.value = parts[2].replace(/[^0-9]/g, '');
        py.value = parts[3].replace(/[^0-9]/g, '');
    } else {
        tx.value = value.replace(/[^0-9]/g, '');
    }
});

[ty, px, py].forEach(input => {
    input.addEventListener('blur', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});