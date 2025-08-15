// elements
const $ = (id) => document.getElementById(id);
const main = $("main");
const openAddUser = $("openAddUser");
const openManageUsers = $("openManageUsers");
const openAddTemplate = $("openAddTemplate");
const openManageTemplates = $("openManageTemplates");
const addUser = $("addUser");
const userForm = $("userForm");
const scookie = $("scookie");
const jcookie = $("jcookie");
const submitUser = $("submitUser");
const manageUsers = $("manageUsers");
const userList = $("userList");
const addTemplate = $("addTemplate");
const convert = $("convert");
const details = $("details");
const size = $("size");
const ink = $("ink");
const templateCanvas = $("templateCanvas");
const templateForm = $("templateForm");
const convertInput = $("convertInput");
const tx = $("tx");
const ty = $("ty");
const px = $("px");
const py = $("py");
const userSelect = $("userSelect");
const canBuyCharges = $("canBuyCharges");
const submitTemplate = $("submitTemplate");
const manageTemplates = $("manageTemplates");
const templateList = $("templateList");
const startAll = $("startAll");
const stopAll = $("stopAll");

// users
const loadUsers = async (f) => {
    try {
        const users = await axios.get("/users");
        if (f) f(users.data);
    } catch (error) {
        alert("Error, check console for details.");
        console.error(error);
    };
};
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await axios.post('/user', { cookies: { s: scookie.value, j: jcookie.value } });
        alert(response.status === 200 ? `Logged in as ${response.data.name} (#${response.data.id})! You may now use "Create Template".` : "Error, check console for details.");
        if (response.status === 200) changeTab(main);
    } catch (error) {
        alert("Error, check console for details.");
        console.error(error);
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
        alert("Error, check console for details.");
        console.error(error);
    };
};
let currentTemplate = { width: 0, height: 0, data: [] };
convertInput.addEventListener('change', async () => {
    const file = convertInput.files[0];
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
                currentTemplate = template;
                canvas.remove();
                drawTemplate(template, templateCanvas);
                size.innerHTML = `${template.width}x${template.height}px`;
                ink.innerHTML = template.ink;
                details.style.display = "block";
            };
        };
        reader.readAsDataURL(file);
    };
});
templateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await axios.post('/template', {
            template: currentTemplate,
            coords: [tx.value, ty.value, px.value, py.value].map(Number),
            userId: userSelect.value,
            canBuyCharges: canBuyCharges.checked
        });
        alert(`${response.status === 200 ? `Created! Go to "Manage Templates" to start and` : "Error,"} check console for details.`);
        if (response.status === 200) changeTab(main);
    } catch (error) {
        alert("Error, check console for details.");
        console.error(error);
    };
});
startAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: true });
        } catch (error) {
            alert(`Error starting #${child.id}, check console for details.`);
            console.error(error);
        };
    };
    alert(`Finished! Check console for details.`)
});
stopAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: false });
        } catch (error) {
            alert(`Error stopping #${child.id}, check console for details.`);
            console.error(error);
        };
    };
    alert(`Finished! Check console for details.`)
});


// tabs
let currentTab = main;
const changeTab = (el) => {
    currentTab.style.display = "none";
    el.style.display = "block";
    currentTab = el;
};
openAddUser.addEventListener("click", () => {
    scookie.value = "";
    jcookie.value = "";
    changeTab(addUser);
});
openManageUsers.addEventListener("click", () => {
    userList.innerHTML = "";
    loadUsers(users => {
        for (const id of Object.keys(users)) {
            const user = document.createElement('div');
            user.className = 'user';
            user.innerHTML = `<div class="left"><span>${users[id].name}</span><span>(#${id})</span></div>`
            const right = document.createElement('div');
            right.className = 'right';
            const button = document.createElement('button');
            button.title = 'Delete User';
            button.innerHTML = '<img src="icons/remove.svg">';
            button.addEventListener("click", async () => {
                const confirmDelete = confirm(`Are you sure you want to delete ${users[id].name} (#${id})?`);
                if (confirmDelete) {
                    try {
                        await axios.delete(`/user/${id}`);
                        alert("User deleted.");
                        changeTab(main);
                    } catch (error) {
                        alert("Error, check console for details.");
                        console.error(error);
                    };
                };
            });
            right.appendChild(button);
            user.appendChild(right);
            userList.appendChild(user);
        };
    });
    changeTab(manageUsers);
});
openAddTemplate.addEventListener("click", () => {
    userSelect.innerHTML = "";
    loadUsers(users => {
        for (const id of Object.keys(users)) userSelect.innerHTML += `<option value="${id}">${users[id].name} (#${id})</option>`;
    });
    changeTab(addTemplate);
});
openManageTemplates.addEventListener("click", () => {
    templateList.innerHTML = "";
    loadTemplates(templates => {
        for (const id of Object.keys(templates)) {
            const t = templates[id];
            const template = document.createElement('div');
            template.id = id;
            template.className = "template";
            template.innerHTML = `<span><b>#${id}</b><br><b>Coordinates:</b> ${t.coords.join(", ")}<br><b>Can buy charges:</b> ${t.canBuyCharges ? "Yes" : "No"}<br><b>Status:</b> ${t.status}</span>`;
            const canvas = document.createElement("canvas");
            drawTemplate(t.template, canvas);
            const buttons = document.createElement('div');
            buttons.className = "buttons";
            const toggleButton = document.createElement('button');
            toggleButton.innerHTML = `<img src="icons/${t.running ? 'pause' : 'play'}.svg">${t.running ? 'Stop' : 'Start'} Template`;
            toggleButton.addEventListener('click', async () => {
                try {
                    await axios.put(`/template/${id}`, { running: !t.running });
                    toggleButton.innerHTML = `<img src="icons/${t.running ? 'pause' : 'play'}.svg">${t.running ? 'Stop' : 'Start'} Template`;
                    alert("Success! Check console for details.");
                } catch (error) {
                    alert("Error, check console for details.");
                    console.error(error);
                };
            });
            const delButton = document.createElement('button');
            delButton.innerHTML = '<img src="icons/remove.svg">Delete Template';
            delButton.addEventListener("click", async () => {
                const confirmDelete = confirm(`Are you sure you want to delete template #${id}?`);
                if (confirmDelete) {
                    try {
                        await axios.delete(`/template/${id}`);
                        alert("Template deleted.");
                        changeTab(main);
                    } catch (error) {
                        alert("Error, check console for details.");
                        console.error(error);
                    };
                };
            });
            buttons.append(toggleButton);
            buttons.append(delButton);
            template.append(canvas);
            template.append(buttons);
            templateList.append(template);
        };
    });
    changeTab(manageTemplates);
});