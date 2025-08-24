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
const expirationDate = $("expirationDate");
const submitUser = $("submitUser");
const manageUsers = $("manageUsers");
const userList = $("userList");
const checkUserStatus = $("checkUserStatus");
const addTemplate = $("addTemplate");
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
const drawingDirection = $("drawingDirection");
const drawingOrder = $("drawingOrder");
const outlineMode = $("outlineMode");
const interleavedMode = $("interleavedMode");
const skipPaintedPixels = $("skipPaintedPixels");
const turnstileNotifications = $("turnstileNotifications");
const accountCooldown = $("accountCooldown");
const purchaseCooldown = $("purchaseCooldown");
const keepAliveCooldown = $("keepAliveCooldown");
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
const autoStart = $("autoStart");

// Message Box
let confirmCallback = null;

// Current tab
let currentTab = null;

// Progress tracking cache
let progressCache = {};
let lastProgressUpdate = {};

// Valid colors in the palette
const allowedColors = [
  [0, 0, 0], // Black
  [60, 60, 60], // Dark Gray
  [120, 120, 120], // Gray
  [210, 210, 210], // Light Gray
  [255, 255, 255], // White
  [96, 0, 24], // Deep Red
  [237, 28, 36], // Red
  [255, 127, 39], // Orange
  [246, 170, 9], // Gold
  [249, 221, 59], // Yellow
  [255, 250, 188], // Light Yellow
  [14, 185, 104], // Dark Green
  [19, 230, 123], // Green
  [135, 255, 94], // Light Green
  [12, 129, 110], // Dark Teal
  [16, 174, 166], // Teal
  [19, 225, 190], // Light Teal
  [96, 247, 242], // Cyan
  [40, 80, 158], // Dark Blue
  [64, 147, 228], // Blue
  [107, 80, 246], // Indigo
  [153, 177, 251], // Light Indigo
  [120, 12, 153], // Dark Purple
  [170, 56, 185], // Purple
  [224, 159, 249], // Light Purple
  [203, 0, 122], // Dark Pink
  [236, 31, 128], // Pink
  [243, 141, 169], // Light Pink
  [104, 70, 52], // Dark Brown
  [149, 104, 42], // Brown
  [248, 178, 119], // Beige

  // Premium colors
  [170, 170, 170], // Additional gray
  [165, 14, 30], // Dark red variant
  [250, 128, 114], // Salmon
  [228, 92, 26], // Orange variant
  [214, 181, 148], // Tan
  [156, 132, 49], // Olive
  [197, 173, 49], // Gold variant
  [232, 212, 95], // Light gold
  [74, 107, 58], // Dark green variant
  [90, 148, 74], // Green variant
  [132, 197, 115], // Light green variant
  [15, 121, 159], // Dark blue variant
  [187, 250, 242], // Light cyan
  [125, 199, 255], // Light blue
  [77, 49, 184], // Purple variant
  [74, 66, 132], // Dark purple variant
  [122, 113, 196], // Purple variant
  [181, 174, 241], // Light purple variant
  [219, 164, 99], // Brown variant
  [209, 128, 81], // Brown variant
  [255, 197, 165], // Peach
  [155, 82, 73], // Brown variant
  [209, 128, 120], // Pink-brown
  [250, 182, 164], // Light peach
  [123, 99, 82], // Brown variant
  [156, 132, 107], // Brown variant
  [51, 57, 65], // Dark gray variant
  [109, 117, 141], // Gray variant
  [179, 185, 209], // Light gray variant
  [109, 100, 63], // Brown variant
  [148, 140, 107], // Brown variant
  [205, 197, 158], // Light brown
];

const showMessage = (title, content) => {
  messageBoxTitle.innerHTML = title;
  messageBoxContent.innerHTML = content;
  messageBoxCancel.classList.add("hidden");
  messageBoxConfirm.textContent = "OK";
  messageBoxOverlay.classList.remove("hidden");
  confirmCallback = null;
};

const showConfirmation = (title, content, onConfirm) => {
  messageBoxTitle.innerHTML = title;
  messageBoxContent.innerHTML = content;
  messageBoxCancel.classList.remove("hidden");
  messageBoxConfirm.textContent = "Confirm";
  messageBoxOverlay.classList.remove("hidden");
  confirmCallback = onConfirm;
};

const closeMessageBox = () => {
  messageBoxOverlay.classList.add("hidden");
  confirmCallback = null;
};

messageBoxConfirm.addEventListener("click", () => {
  if (confirmCallback) {
    confirmCallback();
  }
  closeMessageBox();
});

messageBoxCancel.addEventListener("click", () => {
  closeMessageBox();
});

const handleError = (error) => {
  console.error(error);
  let message = "An unknown error occurred. Check the console for details.";

  if (error.code === "ERR_NETWORK") {
    message =
      "Could not connect to the server. Please ensure the bot is running and accessible.";
  } else if (
    error.response &&
    error.response.data &&
    error.response.data.error
  ) {
    const errMsg = error.response.data.error;
    if (errMsg.includes("(1015)")) {
      message =
        "You are being rate-limited by the server. Please wait a moment before trying again.";
    } else if (errMsg.includes("(500)")) {
      message =
        "Authentication failed. The user's cookie may be expired or invalid. Please try adding the user again with a new cookie.";
    } else if (errMsg.includes("(502)")) {
      message =
        "The server reported a 'Bad Gateway' error. It might be temporarily down or restarting. Please try again in a few moments.";
    } else {
      message = errMsg;
    }
  }
  showMessage("Error", message);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// users
const loadUsers = async (f) => {
  try {
    const users = await axios.get("/users");
    if (f) f(users.data);
  } catch (error) {
    handleError(error);
  }
};

userForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const payload = {
      cookies: {
        s: scookie.value,
        j: jcookie.value,
      },
    };

    // Add expiration date if provided
    if (expirationDate.value) {
      payload.expirationDate = new Date(expirationDate.value).getTime() / 1000;
    }

    const response = await axios.post("/user", payload);
    if (response.status === 200) {
      showMessage(
        "Success",
        `Logged in as ${response.data.name} (#${response.data.id})!`
      );
      userForm.reset();
      openManageUsers.click(); // Refresh the view
    }
  } catch (error) {
    handleError(error);
  }
});

// templates
const basic_colors = {
  "0,0,0": 1,
  "60,60,60": 2,
  "120,120,120": 3,
  "210,210,210": 4,
  "255,255,255": 5,
  "96,0,24": 6,
  "237,28,36": 7,
  "255,127,39": 8,
  "246,170,9": 9,
  "249,221,59": 10,
  "255,250,188": 11,
  "14,185,104": 12,
  "19,230,123": 13,
  "135,255,94": 14,
  "12,129,110": 15,
  "16,174,166": 16,
  "19,225,190": 17,
  "40,80,158": 18,
  "64,147,228": 19,
  "96,247,242": 20,
  "107,80,246": 21,
  "153,177,251": 22,
  "120,12,153": 23,
  "170,56,185": 24,
  "224,159,249": 25,
  "203,0,122": 26,
  "236,31,128": 27,
  "243,141,169": 28,
  "104,70,52": 29,
  "149,104,42": 30,
  "248,178,119": 31,
};
const premium_colors = {
  "170,170,170": 32,
  "165,14,30": 33,
  "250,128,114": 34,
  "228,92,26": 35,
  "214,181,148": 36,
  "156,132,49": 37,
  "197,173,49": 38,
  "232,212,95": 39,
  "74,107,58": 40,
  "90,148,74": 41,
  "132,197,115": 42,
  "15,121,159": 43,
  "187,250,242": 44,
  "125,199,255": 45,
  "77,49,184": 46,
  "74,66,132": 47,
  "122,113,196": 48,
  "181,174,241": 49,
  "219,164,99": 50,
  "209,128,81": 51,
  "255,197,165": 52,
  "155,82,73": 53,
  "209,128,120": 54,
  "250,182,164": 55,
  "123,99,82": 56,
  "156,132,107": 57,
  "51,57,65": 58,
  "109,117,141": 59,
  "179,185,209": 60,
  "109,100,63": 61,
  "148,140,107": 62,
  "205,197,158": 63,
};
const colors = { ...basic_colors, ...premium_colors };

const colorById = (id) => Object.keys(colors).find((key) => colors[key] === id);
const closest = (color) => {
  const [tr, tg, tb] = color.split(",").map(Number);
  // only use basic_colors for closest match to keep current behavior
  return basic_colors[
    Object.keys(basic_colors).reduce((closest, current) => {
      const [cr, cg, cb] = current.split(",").map(Number);
      const [clR, clG, clB] = closest.split(",").map(Number);
      return Math.sqrt(
        Math.pow(tr - cr, 2) + Math.pow(tg - cg, 2) + Math.pow(tb - cb, 2)
      ) <
        Math.sqrt(
          Math.pow(tr - clR, 2) + Math.pow(tg - clG, 2) + Math.pow(tb - clB, 2)
        )
        ? current
        : closest;
    })
  ];
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
      }
      const [r, g, b] = colorById(color).split(",").map(Number);
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
    const templates = await axios.get("/templates");
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
  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  for (let txi = startTileX; txi <= endTileX; txi++) {
    for (let tyi = startTileY; tyi <= endTileY; tyi++) {
      try {
        const response = await axios.get("/canvas", {
          params: { tx: txi, ty: tyi },
        });
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
  const templateCtx = templateCanvas.getContext("2d");
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

    ctx.fillStyle = "rgba(255,0,0,0.8)";
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
        const r = d[i],
          g = d[i + 1],
          b = d[i + 2];
        const rgb = `${r},${g},${b}`;
        if (rgb == "158,189,255") matrix[x][y] = -1;
        else {
          const id =
            colors[rgb] && usePaidColors.checked ? colors[rgb] : closest(rgb);
          matrix[x][y] = id;
        }
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
  reader.onload = (e) => {
    const image = new Image();
    image.src = e.target.result;
    image.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { matrix, ink } = nearestimgdecoder(
        imageData,
        canvas.width,
        canvas.height
      );

      const template = {
        width: canvas.width,
        height: canvas.height,
        ink,
        data: matrix,
      };

      canvas.remove();
      callback(template);
    };
  };
  reader.readAsDataURL(file);
};

const isValidColor = (r, g, b) => {
  return allowedColors.some((color) => {
    const [cr, cg, cb] = color;
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
          `Image contains ${
            invalidPixelCount > 100 ? "100+" : invalidPixelCount
          } invalid color(s).<br><br>` +
            `First invalid color found: <strong>${firstInvalidColor}</strong><br><br>` +
            `Only colors from the allowed palette are permitted. Please use the "Convert Image" or "Convert with Tool" option instead, ` +
            `which will automatically convert colors to the nearest valid palette colors.`
        );
        // Clear the file input
        input.value = "";
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
      for (let i = 3; i < data.length; i += 4) {
        // Check alpha channel
        if (data[i] > 0) inkCount++;
      }
      ink.innerHTML = inkCount;
      details.style.display = "block";

      // Store template (convert image data to matrix format)
      const matrix = Array.from({ length: img.width }, () =>
        Array(img.height).fill(0)
      );
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
        ink: inkCount,
      };

      showMessage(
        "Success",
        "Image validated and loaded successfully! All colors are valid."
      );
    };

    img.onerror = () => {
      showMessage(
        "Error",
        "Failed to load the image. Please try a different file."
      );
      input.value = "";
    };

    img.src = URL.createObjectURL(file);
  }
};

convertInput.addEventListener("change", processEvent);
addImage.addEventListener("change", processEvent);
usePaidColors.addEventListener("change", processEvent);

previewCanvasButton.addEventListener("click", async () => {
  const txVal = parseInt(tx.value, 10);
  const tyVal = parseInt(ty.value, 10);
  const pxVal = parseInt(px.value, 10);
  const pyVal = parseInt(py.value, 10);
  if (
    isNaN(txVal) ||
    isNaN(tyVal) ||
    isNaN(pxVal) ||
    isNaN(pyVal) ||
    currentTemplate.width === 0
  ) {
    showMessage(
      "Error",
      "Please convert an image and enter valid coordinates before previewing."
    );
    return;
  }
  await fetchCanvas(
    txVal,
    tyVal,
    pxVal,
    pyVal,
    currentTemplate.width,
    currentTemplate.height
  );
});

canBuyMaxCharges.addEventListener("change", () => {
  if (canBuyMaxCharges.checked) {
    canBuyCharges.checked = false;
  }
});

canBuyCharges.addEventListener("change", () => {
  if (canBuyCharges.checked) {
    canBuyMaxCharges.checked = false;
  }
});

const resetTemplateForm = () => {
  templateForm.reset();
  templateFormTitle.textContent = "Create Template";
  submitTemplate.innerHTML = '<img src="icons/addTemplate.svg">Create Template';
  delete templateForm.dataset.editId;
  details.style.display = "none";
  currentTemplate = { width: 0, height: 0, data: [] };
  autoStart.checked = false; // Add this line

  // Remove existing image note if present
  const existingNote = document.getElementById("existingImageNote");
  if (existingNote) existingNote.remove();
};

templateForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const isEditMode = !!templateForm.dataset.editId;

  if (!isEditMode && (!currentTemplate || currentTemplate.width === 0)) {
    showMessage("Error", "Please convert an image before creating a template.");
    return;
  }
  const selectedUsers = Array.from(
    document.querySelectorAll('input[name="user_checkbox"]:checked')
  ).map((cb) => cb.value);
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
    antiGriefMode: antiGriefMode.checked,
    autoStart: autoStart.checked, // Add this line
  };

  if (currentTemplate && currentTemplate.width > 0) {
    data.template = currentTemplate;
  }

  try {
    if (isEditMode) {
      await axios.put(`/template/edit/${templateForm.dataset.editId}`, data);
      showMessage("Success", "Template updated!");
    } else {
      await axios.post("/template", data);
      showMessage("Success", "Template created!");
    }
    resetTemplateForm();
    openManageTemplates.click();
  } catch (error) {
    handleError(error);
  }
});

// Import/Export Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  // Import Templates button
  const importTemplatesBtn = document.getElementById('importTemplates');
  if (importTemplatesBtn) {
    importTemplatesBtn.addEventListener('click', importTemplateFile);
  }

  // Export All Templates button
  const exportAllTemplatesBtn = document.getElementById('exportAllTemplates');
  if (exportAllTemplatesBtn) {
    exportAllTemplatesBtn.addEventListener('click', () => {
      loadTemplates((templates) => {
        if (Object.keys(templates).length === 0) {
          showMessage("Export Error", "No templates available to export.");
          return;
        }
        exportAllTemplates(templates);
        showMessage("Success", "Templates exported successfully!");
      });
    });
  }
});

startAll.addEventListener("click", async () => {
  for (const child of templateList.children) {
    try {
      await axios.put(`/template/${child.id}`, { running: true });
    } catch (error) {
      handleError(error);
    }
  }
  showMessage("Success", "Finished! Check console for details.");
  openManageTemplates.click();
});

stopAll.addEventListener("click", async () => {
  for (const child of templateList.children) {
    try {
      await axios.put(`/template/${child.id}`, { running: false });
    } catch (error) {
      handleError(error);
    }
  }
  showMessage("Success", "Finished! Check console for details.");
  openManageTemplates.click();
});

// Tab handling
function changeTab(targetId) {
  console.log("changeTab called with:", targetId);

  // Hide all page-content elements
  const allPageContent = document.querySelectorAll(".page-content");
  console.log("Found page-content elements:", allPageContent.length);

  allPageContent.forEach((page, index) => {
    console.log(`Hiding element ${index}:`, page.id);
    page.style.display = "none";
  });

  // Show the target element
  const targetEl = document.getElementById(targetId);
  console.log(`Target element by ID "${targetId}":`, targetEl);

  if (targetEl) {
    targetEl.style.display = "block";
    console.log(`Showing element:`, targetEl.id);
  } else {
    console.error("Target element not found!");
  }
}

// Export functionality
const exportTemplate = (templateId, templateData) => {
  // Create a clean export object without user IDs and timestamps
  const exportData = {
    name: templateData.name,
    template: templateData.template,
    coords: templateData.coords,
    canBuyCharges: templateData.canBuyCharges,
    canBuyMaxCharges: templateData.canBuyMaxCharges,
    antiGriefMode: templateData.antiGriefMode,
    autoStart: templateData.autoStart || false,
    // Note: userIds are not exported as they're account-specific
    exportedAt: new Date().toISOString(),
    exportedFrom: "wplacer"
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `${templateData.name.replace(/[^a-z0-9]/gi, '_')}_template.json`;
  link.click();
  
  URL.revokeObjectURL(link.href);
};

const exportAllTemplates = (templatesData) => {
  const exportData = {
    templates: {},
    exportedAt: new Date().toISOString(),
    exportedFrom: "wplacer",
    note: "User IDs have been removed and must be reassigned when importing"
  };

  // Process each template
  Object.entries(templatesData).forEach(([id, templateData]) => {
    exportData.templates[id] = {
      name: templateData.name,
      template: templateData.template,
      coords: templateData.coords,
      canBuyCharges: templateData.canBuyCharges,
      canBuyMaxCharges: templateData.canBuyMaxCharges,
      antiGriefMode: templateData.antiGriefMode,
      autoStart: templateData.autoStart || false
      // Note: userIds are not exported
    };
  });

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `wplacer_templates_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(link.href);
};

// Import functionality
const importTemplateFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = handleTemplateImport;
  input.click();
};

const handleTemplateImport = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      processImportData(importData);
    } catch (error) {
      showMessage("Import Error", "Invalid JSON file. Please check the file format.");
    }
  };
  reader.readAsText(file);
};

const processImportData = (importData) => {
  // Check if it's a single template or multiple templates
  if (importData.templates) {
    // Multiple templates export
    processMultipleTemplatesImport(importData.templates);
  } else if (importData.name && importData.template) {
    // Single template export
    processSingleTemplateImport(importData);
  } else {
    showMessage("Import Error", "Unrecognized template file format.");
  }
};

const processSingleTemplateImport = (templateData) => {
  // Validate required fields
  if (!templateData.name || !templateData.template || !templateData.coords) {
    showMessage("Import Error", "Template file is missing required data (name, template, or coords).");
    return;
  }

  showImportDialog([templateData]);
};

const processMultipleTemplatesImport = (templatesData) => {
  const templates = Object.values(templatesData);
  
  // Validate each template
  const validTemplates = templates.filter(template => {
    return template.name && template.template && template.coords;
  });

  if (validTemplates.length === 0) {
    showMessage("Import Error", "No valid templates found in the file.");
    return;
  }

  if (validTemplates.length !== templates.length) {
    showMessage("Warning", `${templates.length - validTemplates.length} templates were skipped due to missing data.`);
  }

  showImportDialog(validTemplates);
};

const showImportDialog = (templates) => {
  // Get available users
  loadUsers((users) => {
    if (Object.keys(users).length === 0) {
      showMessage("Import Error", "No users available. Please add at least one user before importing templates.");
      return;
    }

    createImportModal(templates, users);
  });
};

const createImportModal = (templates, users) => {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.style.display = 'block';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content import-modal';
  modalContent.style.maxWidth = '600px';
  modalContent.style.maxHeight = '80vh';
  modalContent.style.overflow = 'auto';
  
  modalContent.innerHTML = `
    <h3 class="modal-title">Import Templates</h3>
    <p>Found ${templates.length} template(s) to import. Please assign users to each template:</p>
    <div id="importTemplateList" class="import-template-list"></div>
    <div class="modal-actions">
      <button id="cancelImport" class="secondary-button">Cancel</button>
      <button id="confirmImport" class="primary-button">Import Templates</button>
    </div>
  `;
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  const importTemplateList = document.getElementById('importTemplateList');
  
  // Create template items with user selection
  templates.forEach((template, index) => {
    const templateItem = document.createElement('div');
    templateItem.className = 'import-template-item';
    templateItem.style.cssText = `
      border: 1px solid var(--border-color);
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
      background: var(--card-background);
    `;
    
    templateItem.innerHTML = `
      <div class="template-info">
        <h4>${template.name}</h4>
        <p>Size: ${template.template.width}x${template.template.height}px | 
           Coordinates: ${template.coords.join(', ')}</p>
      </div>
      <div class="user-assignment">
        <label>Assign Users:</label>
        <div class="user-checkboxes" data-template-index="${index}">
          ${Object.entries(users).map(([id, user]) => `
            <label class="user-checkbox-label">
              <input type="checkbox" name="import_user_${index}" value="${id}">
              ${user.name} (#${id})
            </label>
          `).join('')}
        </div>
        <button type="button" class="select-all-import" data-index="${index}">Select All</button>
      </div>
    `;
    
    importTemplateList.appendChild(templateItem);
    
    // Add select all functionality
    templateItem.querySelector('.select-all-import').addEventListener('click', () => {
      const checkboxes = templateItem.querySelectorAll(`input[name="import_user_${index}"]`);
      checkboxes.forEach(cb => cb.checked = true);
    });
  });
  
  // Handle cancel
  document.getElementById('cancelImport').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  // Handle import confirmation
  document.getElementById('confirmImport').addEventListener('click', async () => {
    const importResults = [];
    
    for (let i = 0; i < templates.length; i++) {
      const selectedUsers = Array.from(
        document.querySelectorAll(`input[name="import_user_${i}"]:checked`)
      ).map(cb => cb.value);
      
      if (selectedUsers.length === 0) {
        showMessage("Error", `Please assign at least one user to template "${templates[i].name}"`);
        return;
      }
      
      // Prepare template data for import
      const templateData = {
        templateName: templates[i].name,
        coords: templates[i].coords,
        userIds: selectedUsers,
        canBuyCharges: templates[i].canBuyCharges || false,
        canBuyMaxCharges: templates[i].canBuyMaxCharges || false,
        antiGriefMode: templates[i].antiGriefMode || false,
        autoStart: templates[i].autoStart || false,
        template: templates[i].template
      };
      
      try {
        await axios.post("/template", templateData);
        importResults.push(`✓ ${templates[i].name}`);
      } catch (error) {
        importResults.push(`✗ ${templates[i].name}: ${error.message}`);
      }
    }
    
    document.body.removeChild(modalOverlay);
    
    // Show results
    showMessage("Import Complete", `Import Results:<br><br>${importResults.join('<br>')}`);
    
    // Refresh templates view if we're on that page
    if (currentTab === 'manageTemplates') {
      openManageTemplates.click();
    }
  });
};

const showExistingTemplateImage = (template, coords) => {
  if (template && template.width > 0) {
    currentTemplate = template;
    drawTemplate(template, templateCanvas);
    size.innerHTML = `${template.width}x${template.height}px`;
    ink.innerHTML = template.ink || calculateTemplateInk(template);
    details.style.display = "block";

    // Remove existing note if present
    const existingNote = document.getElementById("existingImageNote");
    if (existingNote) existingNote.remove();

    const existingImageNote = document.createElement("div");
    existingImageNote.id = "existingImageNote";
    existingImageNote.className = "existing-image-note";
    existingImageNote.style.cssText = `
            margin: 10px 0;
            padding: 10px;
            background-color: var(--accent-secondary, #3f3f3fff);
            border: 1px solid var(--accent-primary, #e2b24bff);
            border-radius: 6px;
            color: var(--text-primary, #1e293b);
            font-size: 14px;
        `;
    existingImageNote.innerHTML =
      "📋 <strong>Current Template Image</strong> - Upload a new image to replace it";

    details.parentNode.insertBefore(existingImageNote, details.nextSibling);

    // Auto-trigger preview if coordinates are provided
    if (coords && coords.length === 4) {
      setTimeout(async () => {
        try {
          await fetchCanvas(
            coords[0],
            coords[1],
            coords[2],
            coords[3],
            template.width,
            template.height
          );
        } catch (error) {
          console.warn("Could not auto-load preview:", error);
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

checkUserStatus.addEventListener("click", async () => {
  checkUserStatus.disabled = true;
  checkUserStatus.innerHTML = "Checking...";
  const userElements = Array.from(document.querySelectorAll(".user"));

  let totalCurrent = 0;
  let totalMax = 0;

  for (const userEl of userElements) {
    const id = userEl.id.split("-")[1];
    const infoSpans = userEl.querySelectorAll(".user-info > span");
    const currentChargesEl = userEl.querySelector(
      ".user-stats b:nth-of-type(1)"
    );
    const maxChargesEl = userEl.querySelector(".user-stats b:nth-of-type(2)");
    const currentLevelEl = userEl.querySelector(".user-stats b:nth-of-type(3)");
    const levelProgressEl = userEl.querySelector(".level-progress");

    infoSpans.forEach((span) => (span.style.color = "var(--warning-color)"));
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

      infoSpans.forEach((span) => (span.style.color = "var(--success-color)"));
    } catch (error) {
      currentChargesEl.textContent = "ERR";
      maxChargesEl.textContent = "ERR";
      currentLevelEl.textContent = "?";
      levelProgressEl.textContent = "(?%)";
      infoSpans.forEach((span) => (span.style.color = "var(--error-color)"));
    }
    await sleep(1000); // Small delay between requests
  }

  totalCharges.textContent = totalCurrent;
  totalMaxCharges.textContent = totalMax;

  checkUserStatus.disabled = false;
  checkUserStatus.innerHTML = '<img src="icons/check.svg">Refresh Status';
});

const createToggleButton = (template, id) => {
  const button = document.createElement("button");
  const isRunning = template.running;

  button.className = isRunning ? "destructive-button" : "primary-button";
  button.innerHTML = `<img src="icons/${isRunning ? "pause" : "play"}.svg">${
    isRunning ? "Stop" : "Start"
  } Template`;

  button.addEventListener("click", async () => {
    try {
      await axios.put(`/template/${id}`, { running: !isRunning });
      // Refresh the template list to show updated state
      openManageTemplates.click();
    } catch (error) {
      handleError(error);
    }
  });
  return button;
};

// Modified createEditButton function to include individual export
const createEditButton = (t, id) => {
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '0.5rem';
  buttonContainer.style.flexWrap = 'wrap';

  const editButton = document.createElement("button");
  editButton.className = "secondary-button";
  editButton.innerHTML = '<img src="icons/settings.svg">Edit';
  editButton.addEventListener("click", () => {
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
    autoStart.checked = t.autoStart || false;

    // Select users
    document.querySelectorAll('input[name="user_checkbox"]').forEach((cb) => {
      cb.checked = t.userIds.includes(cb.value);
    });

    // Show existing template image with auto-preview
    showExistingTemplateImage(t.template, t.coords);
  });

  const exportButton = document.createElement("button");
  exportButton.className = "template-export-btn";
  exportButton.innerHTML = '<img src="icons/convert.svg" style="width: 14px; height: 14px;">Export';
  exportButton.addEventListener("click", (e) => {
    e.stopPropagation();
    exportTemplate(id, t);
    showMessage("Success", `Template "${t.name}" exported successfully!`);
  });

  buttonContainer.appendChild(editButton);
  buttonContainer.appendChild(exportButton);
  
  return buttonContainer;
};

const updateTemplateProgress = async (templateId) => {
  try {
    const response = await axios.get(`/template/${templateId}/progress`);
    if (
      response.data &&
      response.data.totalPixels &&
      response.data.pixelsRemaining !== undefined
    ) {
      progressCache[templateId] = response.data;
      lastProgressUpdate[templateId] = Date.now();

      // Update progress bar if template is visible
      const templateEl = document.getElementById(templateId);
      if (templateEl) {
        const progressBar = templateEl.querySelector(".progress-bar");
        const progressText = templateEl.querySelector(".progress-text");
        if (progressBar && progressText) {
          const completed =
            response.data.totalPixels - response.data.pixelsRemaining;
          const percentage =
            response.data.totalPixels > 0
              ? Math.round((completed / response.data.totalPixels) * 100)
              : 0;

          progressBar.style.width = `${percentage}%`;
          progressText.textContent = `${completed}/${response.data.totalPixels} pixels (${percentage}%)`;
        }
      }
    }
  } catch (error) {
    console.warn("Failed to update progress for template", templateId, error);
  }
};

selectAllUsers.addEventListener("click", () => {
  document
    .querySelectorAll('#userSelectList input[type="checkbox"]')
    .forEach((cb) => (cb.checked = true));
});

// Navigation event handlers
openManageUsers.addEventListener("click", () => {
  console.log("Opening Manage Users section");

  // Clear and reset the interface
  userList.innerHTML = "";
  userForm.reset();
  totalCharges.textContent = "?";
  totalMaxCharges.textContent = "?";

  loadUsers((users) => {
    const userCount = Object.keys(users).length;

    // Update section title
    const manageTitleElement = document.querySelector(
      "#manageUsers .section-title"
    );
    if (manageTitleElement) {
      manageTitleElement.textContent = `Active Users (${userCount})`;
    }

    for (const id of Object.keys(users)) {
      const user = document.createElement("div");
      user.className = "user";
      user.id = `user-${id}`;
      const expirationDate = users[id].expirationDate;
      const expirationStr = expirationDate
        ? new Date(expirationDate * 1000).toLocaleString()
        : "N/A";

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

      // Add delete functionality
      user.querySelector(".delete-btn").addEventListener("click", () => {
        showConfirmation(
          "Delete User",
          `Are you sure you want to delete ${users[id].name} (#${id})?`,
          async () => {
            try {
              await axios.delete(`/user/${id}`);
              showMessage("Success", "User deleted.");
              openManageUsers.click(); // Refresh the view
            } catch (error) {
              handleError(error);
            }
          }
        );
      });

      // Add info functionality
      user.querySelector(".info-btn").addEventListener("click", async () => {
        try {
          const response = await axios.get(`/user/status/${id}`);
          const info = `
                    <b>User Name:</b> <span style="color: #f97a1f;">${
                      response.data.name
                    }</span><br>
                    <b>Charges:</b> <span style="color: #f97a1f;">${Math.floor(
                      response.data.charges.count
                    )}</span>/<span style="color: #f97a1f;">${
            response.data.charges.max
          }</span><br>
                    <b>Droplets:</b> <span style="color: #f97a1f;">${
                      response.data.droplets
                    }</span><br>
                    <b>Level:</b> <span style="color: #f97a1f;">${
                      response.data.level
                    }</span><br>
                    <b>Country:</b> <span style="color: #f97a1f;">${
                      response.data.country || "N/A"
                    }</span><br>
                    <b>Pixels Painted:</b> <span style="color: #f97a1f;">${
                      response.data.pixelsPainted || 0
                    }</span><br>
                    <b>Extra Colors:</b> <span style="color: #f97a1f;">${
                      response.data.extraColorsBitmap || 0
                    }</span><br>
                    <b>Alliance ID:</b> <span style="color: #f97a1f;">${
                      response.data.allianceId || "None"
                    }</span><br>
                    <br>Would you like to copy the <b>Raw JSON</b> to your clipboard?
                    `;

          showConfirmation("User Info", info, () => {
            navigator.clipboard.writeText(
              JSON.stringify(response.data, null, 2)
            );
          });
        } catch (error) {
          handleError(error);
        }
      });

      userList.appendChild(user);
    }
  });

  changeTab("manageUsers");
});

openAddTemplate.addEventListener("click", () => {
  resetTemplateForm();
  userSelectList.innerHTML = "";
  loadUsers((users) => {
    if (Object.keys(users).length === 0) {
      userSelectList.innerHTML =
        "<span>No users added. Please add a user first.</span>";
      return;
    }
    for (const id of Object.keys(users)) {
      const userDiv = document.createElement("div");
      userDiv.className = "user-select-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `user_${id}`;
      checkbox.name = "user_checkbox";
      checkbox.value = id;
      const label = document.createElement("label");
      label.htmlFor = `user_${id}`;
      label.textContent = `${users[id].name} (#${id})`;
      userDiv.appendChild(checkbox);
      userDiv.appendChild(label);
      userSelectList.appendChild(userDiv);
    }
  });
  changeTab("addTemplate");
});

openManageTemplates.addEventListener("click", () => {
  console.log("Loading templates...");
  templateList.innerHTML = "";

  loadUsers((users) => {
    loadTemplates((templates) => {
      console.log("Templates loaded:", Object.keys(templates).length);

      for (const id of Object.keys(templates)) {
        const t = templates[id];
        console.log(`Processing template ${id}, running: ${t.running}`);

        const userListFormatted = t.userIds
          .map((userId) => {
            const user = users[userId];
            return user ? `${user.name}#${userId}` : `Unknown#${userId}`;
          })
          .join(", ");

        const template = document.createElement("div");
        template.id = id;
        template.className = "template";

        // Create progress display
        let progressDisplay = "";
        let progressBarHTML = "";
        if (t.totalPixels && t.pixelsRemaining !== undefined) {
          const completed = t.totalPixels - t.pixelsRemaining;
          const percentage =
            t.totalPixels > 0
              ? Math.round((completed / t.totalPixels) * 100)
              : 0;
          progressDisplay = `<br><b>Progress:</b> <span class="progress-text">${completed}/${t.totalPixels} pixels (${percentage}%)</span>`;
          progressBarHTML = `
        <div class="progress-container">
            <div class="progress-background">
                <div class="progress-bar" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;

          // Update progress for running templates
          if (t.running) {
            const lastUpdate = lastProgressUpdate[id];
            const shouldUpdate = !lastUpdate || Date.now() - lastUpdate > 30000; // Update every 30 seconds
            if (shouldUpdate) {
              setTimeout(
                () => updateTemplateProgress(id),
                Math.random() * 5000
              ); // Stagger updates
            }
          }
        }

        const autoStartText = t.autoStart ? "Yes" : "No";

        const infoSpan = document.createElement("span");
        infoSpan.innerHTML = `
        <b>Template Name:</b> ${t.name}<br>
        <b>Assigned Accounts:</b> ${userListFormatted}<br>
        <b>Coordinates:</b> ${t.coords.join(", ")}<br>
        <b>Buy Max Charge Upgrades:</b> ${t.canBuyMaxCharges ? "Yes" : "No"}<br>
        <b>Buy Extra Charges:</b> ${t.canBuyCharges ? "Yes" : "No"}<br>
        <b>Anti-Grief Mode:</b> ${t.antiGriefMode ? "Yes" : "No"}<br>
        <b>Auto-Start:</b> ${autoStartText}<br>
        <b class="status-text">Status:</b> ${t.status}${progressDisplay}
    `;
        template.appendChild(infoSpan);

        // Add progress bar if we have progress data
        if (progressBarHTML) {
          const progressDiv = document.createElement("div");
          progressDiv.innerHTML = progressBarHTML;
          template.appendChild(progressDiv);
        }

        const canvas = document.createElement("canvas");
        drawTemplate(t.template, canvas);

        const buttons = document.createElement("div");
        buttons.className = "template-actions";

        const toggleButton = createToggleButton(t, id);
        buttons.appendChild(toggleButton);

        const editButton = createEditButton(t, id); // This now includes export
        buttons.appendChild(editButton);

        const delButton = document.createElement("button");
        delButton.className = "destructive-button";
        delButton.innerHTML = '<img src="icons/remove.svg">Delete';
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
              }
            }
          );
        });
        buttons.appendChild(delButton);

        template.append(canvas, buttons);
        templateList.append(template);
      }

      console.log("All templates processed");
    });
  });
  changeTab("manageTemplates");
});

openSettings.addEventListener("click", async () => {
  try {
    const response = await axios.get("/settings");
    const currentSettings = response.data;

    drawingDirection.value = currentSettings.drawingDirection || "ttb";
    drawingOrder.value = currentSettings.drawingOrder || "linear";
    turnstileNotifications.checked = currentSettings.turnstileNotifications;
    outlineMode.checked = currentSettings.outlineMode;
    interleavedMode.checked = currentSettings.interleavedMode;
    skipPaintedPixels.checked = currentSettings.skipPaintedPixels;
    accountCooldown.value = (currentSettings.accountCooldown || 20000) / 1000;
    purchaseCooldown.value = (currentSettings.purchaseCooldown || 5000) / 1000;
    keepAliveCooldown.value =
      (currentSettings.keepAliveCooldown || 5000) / 1000;
    dropletReserve.value = currentSettings.dropletReserve || 0;
    antiGriefStandby.value =
      (currentSettings.antiGriefStandby || 600000) / 60000;
    chargeThreshold.value = (currentSettings.chargeThreshold || 0.5) * 100;
  } catch (error) {
    handleError(error);
  }
  changeTab("settings");
});

// Settings event handlers
const saveSetting = async (setting) => {
  try {
    await axios.put("/settings", setting);
    showMessage("Success", "Setting saved!");
  } catch (error) {
    handleError(error);
  }
};

drawingDirection.addEventListener("change", () =>
  saveSetting({ drawingDirection: drawingDirection.value })
);
drawingOrder.addEventListener("change", () =>
  saveSetting({ drawingOrder: drawingOrder.value })
);
turnstileNotifications.addEventListener("change", () =>
  saveSetting({ turnstileNotifications: turnstileNotifications.checked })
);
outlineMode.addEventListener("change", () =>
  saveSetting({ outlineMode: outlineMode.checked })
);
interleavedMode.addEventListener("change", () =>
  saveSetting({ interleavedMode: interleavedMode.checked })
);
skipPaintedPixels.addEventListener("change", () =>
  saveSetting({ skipPaintedPixels: skipPaintedPixels.checked })
);

accountCooldown.addEventListener("change", () => {
  const value = parseInt(accountCooldown.value, 10) * 1000;
  if (isNaN(value) || value < 0) {
    showMessage("Error", "Please enter a valid non-negative number.");
    return;
  }
  saveSetting({ accountCooldown: value });
});

purchaseCooldown.addEventListener("change", () => {
  const value = parseInt(purchaseCooldown.value, 10) * 1000;
  if (isNaN(value) || value < 0) {
    showMessage("Error", "Please enter a valid non-negative number.");
    return;
  }
  saveSetting({ purchaseCooldown: value });
});

keepAliveCooldown.addEventListener("change", () => {
  const value = parseInt(keepAliveCooldown.value, 10) * 1000;
  if (isNaN(value) || value < 0) {
    showMessage("Error", "Please enter a valid non-negative number.");
    return;
  }
  saveSetting({ keepAliveCooldown: value });
});

dropletReserve.addEventListener("change", () => {
  const value = parseInt(dropletReserve.value, 10);
  if (isNaN(value) || value < 0) {
    showMessage("Error", "Please enter a valid non-negative number.");
    return;
  }
  saveSetting({ dropletReserve: value });
});

antiGriefStandby.addEventListener("change", () => {
  const value = parseInt(antiGriefStandby.value, 10) * 60000;
  if (isNaN(value) || value < 60000) {
    showMessage("Error", "Please enter a valid number (at least 1 minute).");
    return;
  }
  saveSetting({ antiGriefStandby: value });
});

chargeThreshold.addEventListener("change", () => {
  const value = parseInt(chargeThreshold.value, 10);
  if (isNaN(value) || value < 0 || value > 100) {
    showMessage("Error", "Please enter a valid percentage between 0 and 100.");
    return;
  }
  saveSetting({ chargeThreshold: value / 100 });
});

// Coordinate input helpers
tx.addEventListener("blur", () => {
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
      tx.value = parts[0].replace(/[^0-9]/g, "");
      ty.value = parts[1].replace(/[^0-9]/g, "");
      px.value = parts[2].replace(/[^0-9]/g, "");
      py.value = parts[3].replace(/[^0-9]/g, "");
    } else {
      tx.value = value.replace(/[^0-9]/g, "");
    }
  }
});

[ty, px, py].forEach((input) => {
  input.addEventListener("blur", () => {
    input.value = input.value.replace(/[^0-9]/g, "");
  });
});

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  console.log("wplacer loaded, initializing...");

  // Set initial tab
  const mainTab = document.getElementById("main");
  if (mainTab) {
    mainTab.style.display = "block";
  }

  // Hide all other page content initially
  const pageContents = document.querySelectorAll(".page-content:not(#main)");
  pageContents.forEach((page) => {
    page.style.display = "none";
  });

  // Initialize feather icons if available
  if (typeof feather !== "undefined") {
    feather.replace();
  }

  console.log("wplacer initialization complete");
});
