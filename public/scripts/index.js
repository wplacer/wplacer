const convertInput = document.getElementById("convertInput");
const details = document.getElementById("details");
const size = document.getElementById("size");
const ink = document.getElementById("ink");
const templateCanvas = document.getElementById("templateCanvas");
const tx = document.getElementById("tx");
const ty = document.getElementById("ty");
const px = document.getElementById("px");
const py = document.getElementById("py");
const form = document.getElementById("form");
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
let currentTemplate = { width: 0, height: 0, data: [] };
const loadTemplate = () => {
    templateCanvas.width = currentTemplate.width;
    templateCanvas.height = currentTemplate.height;
    const ctx = templateCanvas.getContext("2d");
    ctx.clearRect(0, 0, currentTemplate.width, currentTemplate.height);
    const imageData = new ImageData(currentTemplate.width, currentTemplate.height);
    for (let x = 0; x < currentTemplate.width; x++) {
        for (let y = 0; y < currentTemplate.height; y++) {
            const color = currentTemplate.data[x][y];
            if (color === 0) continue;
            const i = (y * currentTemplate.width + x) * 4;
            const [r, g, b] = colorById(color).split(',').map(Number);
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255;
        };
    };
    ctx.putImageData(imageData, 0, 0);
    size.innerHTML = `${currentTemplate.width}x${currentTemplate.height}px`;
    ink.innerHTML = currentTemplate.ink;
    details.style.display = "block";
};
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
                loadTemplate();
            };
        };
        reader.readAsDataURL(file);
    };
});
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await axios.post('/init', {
            template: currentTemplate,
            coords: [tx.value, ty.value, px.value, py.value].map(Number),
            cookie: cookie.value
        });
        alert(`${response.status === 200 ? `started! (#${response.data.id})` : "error,"} check console for details`);
    } catch (error) {
        alert("error, check console for details");
        console.error(error);
    };
});