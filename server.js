import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { CookieJar } from "tough-cookie";
import { Impit } from "impit";
import { Image, createCanvas } from "canvas";

// --- Setup Data Directory ---
const dataDir = "./data";
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// --- Logging and Utility Functions ---
const log = async (id, name, data, error) => {
  const timestamp = new Date().toLocaleString();
  const identifier = `(${name}#${id})`;
  if (error) {
    console.error(`[${timestamp}] ${identifier} ${data}:`, error);
    appendFileSync(
      path.join(dataDir, `errors.log`),
      `[${timestamp}] ${identifier} ${data}: ${error.stack || error.message}\n`
    );
  } else {
    console.log(`[${timestamp}] ${identifier} ${data}`);
    appendFileSync(
      path.join(dataDir, `logs.log`),
      `[${timestamp}] ${identifier} ${data}\n`
    );
  }
};

const duration = (durationMs) => {
  if (durationMs <= 0) return "0s";
  const totalSeconds = Math.floor(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- WPlacer Core Classes and Constants ---
class SuspensionError extends Error {
  constructor(message, durationMs) {
    super(message);
    this.name = "SuspensionError";
    this.durationMs = durationMs;
    this.suspendedUntil = Date.now() + durationMs;
  }
}

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
const pallete = { ...basic_colors, ...premium_colors };
const colorBitmapShift = Object.keys(basic_colors).length + 1;

class WPlacer {
  constructor(template, coords, settings, templateName) {
    this.template = template;
    this.templateName = templateName;
    this.coords = coords;
    this.settings = settings;
    this.cookies = null;
    this.browser = null;
    this.userInfo = null;
    this.tiles = new Map();
    this.token = null;
  }

  async login(cookies) {
    this.cookies = cookies;
    let jar = new CookieJar();
    for (const cookie of Object.keys(this.cookies)) {
      jar.setCookieSync(
        `${cookie}=${this.cookies[cookie]}; Path=/`,
        "https://backend.wplace.live"
      );
    }
    this.browser = new Impit({
      cookieJar: jar,
      browser: "chrome",
      ignoreTlsErrors: true,
    });
    await this.loadUserInfo();
    return this.userInfo;
  }

  async loadUserInfo() {
    const me = await this.browser.fetch("https://backend.wplace.live/me");
    const bodyText = await me.text();

    try {
      const userInfo = JSON.parse(bodyText);
      if (userInfo.error)
        throw new Error(
          `(500) Failed to authenticate: "${userInfo.error}". The cookie is likely invalid or expired.`
        );
      if (userInfo.id && userInfo.name) {
        this.userInfo = userInfo;
        return true;
      }
      throw new Error(
        `Unexpected response from /me endpoint: ${JSON.stringify(userInfo)}`
      );
    } catch (e) {
      if (bodyText.includes("Error 1015"))
        throw new Error(
          "(1015) You are being rate-limited by the server. Please wait a moment and try again."
        );
      if (bodyText.includes("502") && bodyText.includes("gateway"))
        throw new Error(
          `(502) Bad Gateway: The server is temporarily unavailable. Please try again later.`
        );
      throw new Error(
        `Failed to parse server response. The service may be down or returning an invalid format. Response: "${bodyText.substring(
          0,
          150
        )}..."`
      );
    }
  }

  async post(url, body) {
    const request = await this.browser.fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "text/plain;charset=UTF-8",
        Referer: "https://wplace.live/",
      },
      body: JSON.stringify(body),
    });
    const data = await request.json();
    return { status: request.status, data: data };
  }

  async loadTiles() {
    this.tiles.clear();
    const [tx, ty, px, py] = this.coords;
    const endPx = px + this.template.width;
    const endPy = py + this.template.height;
    const endTx = tx + Math.floor(endPx / 1000);
    const endTy = ty + Math.floor(endPy / 1000);

    const tilePromises = [];
    for (let currentTx = tx; currentTx <= endTx; currentTx++) {
      for (let currentTy = ty; currentTy <= endTy; currentTy++) {
        const promise = new Promise((resolve) => {
          const image = new Image();
          image.crossOrigin = "Anonymous";
          image.onload = () => {
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const tileData = {
              width: canvas.width,
              height: canvas.height,
              data: Array.from({ length: canvas.width }, () => []),
            };
            const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let x = 0; x < canvas.width; x++) {
              for (let y = 0; y < canvas.height; y++) {
                const i = (y * canvas.width + x) * 4;
                const [r, g, b, a] = [
                  d.data[i],
                  d.data[i + 1],
                  d.data[i + 2],
                  d.data[i + 3],
                ];
                tileData.data[x][y] =
                  a === 255 ? pallete[`${r},${g},${b}`] || 0 : 0;
              }
            }
            resolve(tileData);
          };
          image.onerror = () => resolve(null);
          image.src = `https://backend.wplace.live/files/s0/tiles/${currentTx}/${currentTy}.png?t=${Date.now()}`;
        }).then((tileData) => {
          if (tileData) this.tiles.set(`${currentTx}_${currentTy}`, tileData);
        });
        tilePromises.push(promise);
      }
    }
    await Promise.all(tilePromises);
    return true;
  }

  hasColor(id) {
    if (id < colorBitmapShift) return true;
    return !!(this.userInfo.extraColorsBitmap & (1 << (id - colorBitmapShift)));
  }

  async _executePaint(tx, ty, body) {
    if (body.colors.length === 0) return { painted: 0 };
    const response = await this.post(
      `https://backend.wplace.live/s0/pixel/${tx}/${ty}`,
      body
    );

    if (response.data.painted && response.data.painted === body.colors.length) {
      log(
        this.userInfo.id,
        this.userInfo.name,
        `[${this.templateName}] 🎨 Painted ${body.colors.length} pixels on tile ${tx}, ${ty}.`
      );
      return { painted: body.colors.length };
    }
    if (
      response.status === 403 &&
      (response.data.error === "refresh" ||
        response.data.error === "Unauthorized")
    ) {
      throw new Error("REFRESH_TOKEN");
    }
    if (response.status === 451 && response.data.suspension) {
      throw new SuspensionError(
        `Account is suspended.`,
        response.data.durationMs || 0
      );
    }
    if (response.status === 500) {
      log(
        this.userInfo.id,
        this.userInfo.name,
        `[${this.templateName}] ⏱️ Server error (500). Waiting 40 seconds before retrying...`
      );
      await sleep(40000);
      return { painted: 0 };
    }
    if (
      response.status === 429 ||
      (response.data.error && response.data.error.includes("Error 1015"))
    ) {
      throw new Error(
        "(1015) You are being rate-limited. Please wait a moment and try again."
      );
    }
    throw Error(
      `Unexpected response for tile ${tx},${ty}: ${JSON.stringify(response)}`
    );
  }

  _getMismatchedPixels() {
    const [startX, startY, startPx, startPy] = this.coords;
    const mismatched = [];
    for (let y = 0; y < this.template.height; y++) {
      for (let x = 0; x < this.template.width; x++) {
        const templateColor = this.template.data[x][y];
        if (templateColor === 0) continue;

        const globalPx = startPx + x;
        const globalPy = startPy + y;
        const targetTx = startX + Math.floor(globalPx / 1000);
        const targetTy = startY + Math.floor(globalPy / 1000);
        const localPx = globalPx % 1000;
        const localPy = globalPy % 1000;

        const tile = this.tiles.get(`${targetTx}_${targetTy}`);
        if (!tile || !tile.data[localPx]) continue;

        const tileColor = tile.data[localPx][localPy];

        const shouldPaint = this.settings.skipPaintedPixels
          ? tileColor === 0 // If skip mode is on, only paint if the tile is blank
          : templateColor !== tileColor; // Otherwise, paint if the color is wrong

        if (templateColor > 0 && shouldPaint && this.hasColor(templateColor)) {
          const neighbors = [
            this.template.data[x - 1]?.[y],
            this.template.data[x + 1]?.[y],
            this.template.data[x]?.[y - 1],
            this.template.data[x]?.[y + 1],
          ];
          const isEdge = neighbors.some((n) => n === 0 || n === undefined);
          mismatched.push({
            tx: targetTx,
            ty: targetTy,
            px: localPx,
            py: localPy,
            color: templateColor,
            isEdge,
          });
        }
      }
    }
    return mismatched;
  }

  async paint() {
    await this.loadUserInfo();
    await this.loadTiles();
    if (!this.token) throw new Error("Token not provided to paint method.");

    let mismatchedPixels = this._getMismatchedPixels();
    if (mismatchedPixels.length === 0) return 0;

    log(
      this.userInfo.id,
      this.userInfo.name,
      `[${this.templateName}] Found ${mismatchedPixels.length} mismatched pixels.`
    );

    let pixelsToProcess = mismatchedPixels;
    let isOutlineTurn = false;

    // 1. Prioritize Outline Mode
    if (this.settings.outlineMode) {
      const edgePixels = mismatchedPixels.filter((p) => p.isEdge);
      if (edgePixels.length > 0) {
        pixelsToProcess = edgePixels;
        isOutlineTurn = true;
      }
    }

    // Helper functions for coordinates
    const [startX, startY] = this.coords;
    const getGlobalY = (p) => (p.ty - startY) * 1000 + p.py;
    const getGlobalX = (p) => (p.tx - startX) * 1000 + p.px;

    // 2. Base Directional Sort
    switch (this.settings.drawingDirection) {
      case "btt": // Bottom to Top
        pixelsToProcess.sort((a, b) => getGlobalY(b) - getGlobalY(a));
        break;
      case "ltr": // Left to Right
        pixelsToProcess.sort((a, b) => getGlobalX(a) - getGlobalX(b));
        break;
      case "rtl": // Right to Left
        pixelsToProcess.sort((a, b) => getGlobalX(b) - getGlobalX(a));
        break;
      case "ttb": // Top to Bottom
      default:
        pixelsToProcess.sort((a, b) => getGlobalY(a) - getGlobalY(b));
        break;
    }

    // 3. Apply Order Modification
    switch (this.settings.drawingOrder) {
      case "random":
        for (let i = pixelsToProcess.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pixelsToProcess[i], pixelsToProcess[j]] = [
            pixelsToProcess[j],
            pixelsToProcess[i],
          ];
        }
        break;
      case "color":
      case "randomColor": {
        const pixelsByColor = pixelsToProcess.reduce((acc, p) => {
          if (!acc[p.color]) acc[p.color] = [];
          acc[p.color].push(p);
          return acc;
        }, {});
        const colors = Object.keys(pixelsByColor);
        if (this.settings.drawingOrder === "randomColor") {
          for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
          }
        }
        pixelsToProcess = colors.flatMap((color) => pixelsByColor[color]);
        break;
      }
      case "linear":
      default:
        // Do nothing, keep the directional sort
        break;
    }

    // 4. Apply Interleave
    if (this.settings.interleavedMode && !isOutlineTurn) {
      const firstPass = pixelsToProcess.filter(
        (p) => (getGlobalX(p) + getGlobalY(p)) % 2 === 0
      );
      const secondPass = pixelsToProcess.filter(
        (p) => (getGlobalX(p) + getGlobalY(p)) % 2 !== 0
      );
      pixelsToProcess = [...firstPass, ...secondPass];
    }

    // 5. Prepare and execute the paint job
    const pixelsToPaint = pixelsToProcess.slice(
      0,
      Math.floor(this.userInfo.charges.count)
    );
    const bodiesByTile = pixelsToPaint.reduce((acc, p) => {
      const key = `${p.tx},${p.ty}`;
      if (!acc[key]) acc[key] = { colors: [], coords: [] };
      acc[key].colors.push(p.color);
      acc[key].coords.push(p.px, p.py);
      return acc;
    }, {});

    let totalPainted = 0;
    for (const tileKey in bodiesByTile) {
      const [tx, ty] = tileKey.split(",").map(Number);
      const body = { ...bodiesByTile[tileKey], t: this.token };
      const result = await this._executePaint(tx, ty, body);
      totalPainted += result.painted;
    }
    return totalPainted;
  }

  async buyProduct(productId, amount) {
    const response = await this.post(`https://backend.wplace.live/purchase`, {
      product: { id: productId, amount: amount },
    });
    if (response.data.success) {
      let purchaseMessage = `🛒 Purchase successful for product #${productId} (amount: ${amount})`;
      if (productId === 80)
        purchaseMessage = `🛒 Bought ${amount * 30} pixels for ${
          amount * 500
        } droplets`;
      else if (productId === 70)
        purchaseMessage = `🛒 Bought ${amount} Max Charge Upgrade(s) for ${
          amount * 500
        } droplets`;
      log(
        this.userInfo.id,
        this.userInfo.name,
        `[${this.templateName}] ${purchaseMessage}`
      );
      return true;
    }
    if (
      response.status === 429 ||
      (response.data.error && response.data.error.includes("Error 1015"))
    ) {
      throw new Error(
        "(1015) You are being rate-limited while trying to make a purchase. Please wait."
      );
    }
    throw Error(
      `Unexpected response during purchase: ${JSON.stringify(response)}`
    );
  }

  async pixelsLeft() {
    await this.loadTiles();
    return this._getMismatchedPixels().length;
  }
}

// --- Data Persistence ---
const loadJSON = (filename) =>
  existsSync(path.join(dataDir, filename))
    ? JSON.parse(readFileSync(path.join(dataDir, filename), "utf8"))
    : {};
const saveJSON = (filename, data) =>
  writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 4));

const users = loadJSON("users.json");
const saveUsers = () => saveJSON("users.json", users);

const templates = {}; // In-memory store for active TemplateManager instances
const saveTemplates = () => {
  const templatesToSave = {};
  for (const id in templates) {
    const t = templates[id];
    // Save the template data, not recreate TemplateManager instances
    templatesToSave[id] = {
      name: t.name,
      template: t.template,
      coords: t.coords,
      canBuyCharges: t.canBuyCharges,
      canBuyMaxCharges: t.canBuyMaxCharges,
      antiGriefMode: t.antiGriefMode,
      autoStart: t.autoStart || false,
      userIds: t.userIds
    };
  }
  saveJSON("templates.json", templatesToSave);
};

let currentSettings = {
  turnstileNotifications: false,
  accountCooldown: 20000,
  purchaseCooldown: 5000,
  keepAliveCooldown: 5000,
  dropletReserve: 0,
  antiGriefStandby: 600000,
  drawingDirection: "ttb",
  drawingOrder: "linear",
  chargeThreshold: 0.5,
  outlineMode: false,
  interleavedMode: false,
  skipPaintedPixels: false,
  accountCheckCooldown: 0,
};
if (existsSync(path.join(dataDir, "settings.json"))) {
  currentSettings = { ...currentSettings, ...loadJSON("settings.json") };
}
const saveSettings = () => saveJSON("settings.json", currentSettings);

// --- Server State ---
const activeBrowserUsers = new Set();
let activePaintingTasks = 0;

// --- Token Management ---
const TokenManager = {
  tokenQueue: [],
  tokenPromise: null,
  resolvePromise: null,
  isTokenNeeded: false,

  getToken() {
    if (this.tokenQueue.length > 0) {
      return Promise.resolve(this.tokenQueue[0]);
    }
    if (!this.tokenPromise) {
      log(
        "SYSTEM",
        "wplacer",
        "TOKEN_MANAGER: A task is waiting for a token. Flagging for clients."
      );
      this.isTokenNeeded = true;
      this.tokenPromise = new Promise((resolve) => {
        this.resolvePromise = resolve;
      });
    }
    return this.tokenPromise;
  },
  setToken(t) {
    log(
      "SYSTEM",
      "wplacer",
      `✅ TOKEN_MANAGER: Token received. Queue size: ${
        this.tokenQueue.length + 1
      }`
    );
    this.isTokenNeeded = false;
    this.tokenQueue.push(t);
    if (this.resolvePromise) {
      this.resolvePromise(this.tokenQueue[0]);
      this.tokenPromise = null;
      this.resolvePromise = null;
    }
  },
  invalidateToken() {
    this.tokenQueue.shift();
    log(
      "SYSTEM",
      "wplacer",
      `🔄 TOKEN_MANAGER: Invalidating token. ${this.tokenQueue.length} tokens remaining.`
    );
  },
};

// --- Error Handling ---
function logUserError(error, id, name, context) {
  const message = error.message || "An unknown error occurred.";
  if (
    message.includes("(500)") ||
    message.includes("(1015)") ||
    message.includes("(502)") ||
    error.name === "SuspensionError"
  ) {
    log(id, name, `❌ Failed to ${context}: ${message}`);
  } else {
    log(id, name, `❌ Failed to ${context}`, error);
  }
}

// --- Template Management ---
class TemplateManager {
  constructor(
    name,
    templateData,
    coords,
    canBuyCharges,
    canBuyMaxCharges,
    antiGriefMode,
    userIds,
    autoStart = false
  ) {
    this.name = name;
    this.template = templateData;
    this.coords = coords;
    this.canBuyCharges = canBuyCharges;
    this.canBuyMaxCharges = canBuyMaxCharges;
    this.antiGriefMode = antiGriefMode;
    this.userIds = userIds;
    this.autoStart = autoStart;
    this.running = false;
    this.status = "Waiting to be started.";
    this.masterId = this.userIds[0];
    this.masterName = users[this.masterId]?.name || "Unknown";
    this.isFirstRun = true;
    this.sleepResolve = null;
    this.totalPixels = this.template.data.flat().filter((p) => p > 0).length;
    this.pixelsRemaining = this.totalPixels;
    
    // Debug logging
    console.log(`📋 Created template "${name}" with autoStart: ${autoStart}`);
  }

  sleep(ms) {
    return new Promise((resolve) => {
      this.sleepResolve = resolve;
      setTimeout(() => {
        if (this.sleepResolve) {
          this.sleepResolve = null;
          resolve();
        }
      }, ms);
    });
  }

  interruptSleep() {
    if (this.sleepResolve) {
      log(
        "SYSTEM",
        "wplacer",
        `[${this.name}] ⚙️ Settings changed, waking up.`
      );
      this.sleepResolve();
      this.sleepResolve = null;
    }
  }

  async handleUpgrades(wplacer) {
    if (!this.canBuyMaxCharges) return;
    await wplacer.loadUserInfo();
    const affordableDroplets =
      wplacer.userInfo.droplets - currentSettings.dropletReserve;
    const amountToBuy = Math.floor(affordableDroplets / 500);
    if (amountToBuy > 0) {
      log(
        wplacer.userInfo.id,
        wplacer.userInfo.name,
        `💰 Attempting to buy ${amountToBuy} max charge upgrade(s).`
      );
      try {
        await wplacer.buyProduct(70, amountToBuy);
        await this.sleep(currentSettings.purchaseCooldown);
        await wplacer.loadUserInfo();
      } catch (error) {
        logUserError(
          error,
          wplacer.userInfo.id,
          wplacer.userInfo.name,
          "purchase max charge upgrades"
        );
      }
    }
  }

  async _performPaintTurn(wplacer) {
    let paintingComplete = false;
    while (!paintingComplete && this.running) {
      try {
        wplacer.token = await TokenManager.getToken();
        await wplacer.paint();
        paintingComplete = true;
      } catch (error) {
        if (error.name === "SuspensionError") {
          const suspendedUntilDate = new Date(
            error.suspendedUntil
          ).toLocaleString();
          log(
            wplacer.userInfo.id,
            wplacer.userInfo.name,
            `[${this.name}] 🛑 Account suspended from painting until ${suspendedUntilDate}.`
          );
          users[wplacer.userInfo.id].suspendedUntil = error.suspendedUntil;
          saveUsers();
          return; // End this user's turn
        }
        if (error.message === "REFRESH_TOKEN") {
          log(
            wplacer.userInfo.id,
            wplacer.userInfo.name,
            `[${this.name}] 🔄 Token expired or invalid. Trying next token...`
          );
          TokenManager.invalidateToken();
          await this.sleep(1000);
        } else {
          throw error;
        }
      }
    }
  }

  async start() {
    this.running = true;
    this.status = "Started.";
    log("SYSTEM", "wplacer", `▶️ Starting template "${this.name}"...`);
    activePaintingTasks++;

    try {
      while (this.running) {
        const checkWplacer = new WPlacer(
          this.template,
          this.coords,
          currentSettings,
          this.name
        );
        try {
          await checkWplacer.login(users[this.masterId].cookies);
          this.pixelsRemaining = await checkWplacer.pixelsLeft();
        } catch (error) {
          logUserError(
            error,
            this.masterId,
            this.masterName,
            "check pixels left"
          );
          await this.sleep(60000);
          continue;
        }

        if (this.pixelsRemaining === 0) {
          if (this.antiGriefMode) {
            this.status = "Monitoring for changes.";
            log(
              "SYSTEM",
              "wplacer",
              `[${
                this.name
              }] 🖼 Template is complete. Monitoring... Checking again in ${
                currentSettings.antiGriefStandby / 60000
              } minutes.`
            );
            await this.sleep(currentSettings.antiGriefStandby);
            continue;
          } else {
            log("SYSTEM", "wplacer", `[${this.name}] 🖼 Template finished!`);
            this.status = "Finished.";
            this.running = false;
            break;
          }
        }

        let userStates = [];
        for (const userId of this.userIds) {
          if (
            users[userId].suspendedUntil &&
            Date.now() < users[userId].suspendedUntil
          ) {
            continue;
          }
          if (activeBrowserUsers.has(userId)) {
            continue;
          }
          activeBrowserUsers.add(userId);
          const wplacer = new WPlacer(
            this.template,
            this.coords,
            currentSettings,
            this.name
          );
          try {
            await wplacer.login(users[userId].cookies);
            userStates.push({
              userId,
              charges: wplacer.userInfo.charges,
              cooldownMs: wplacer.userInfo.charges.cooldownMs,
            });
          } catch (error) {
            logUserError(
              error,
              userId,
              users[userId].name,
              "check user status"
            );
          } finally {
            activeBrowserUsers.delete(userId);
          }
        }

        const readyUsers = userStates.filter(
          (u) =>
            u.charges.count >=
            Math.max(1, u.charges.max * currentSettings.chargeThreshold)
        );
        const userToRun =
          readyUsers.length > 0
            ? readyUsers.sort((a, b) => b.charges.count - a.charges.count)[0]
            : null;

        if (userToRun) {
          const user = users[userToRun.userId];
          if (user.suspendedUntil && Date.now() < user.suspendedUntil) {
            log(
              "SYSTEM",
              "wplacer",
              `[${this.name}] Safeguard: Skipped suspended user ${user.name}#${userToRun.userId}.`
            );
            await this.sleep(1000); // Small delay to prevent fast loops
            continue;
          }

          if (activeBrowserUsers.has(userToRun.userId)) continue;
          activeBrowserUsers.add(userToRun.userId);
          const wplacer = new WPlacer(
            this.template,
            this.coords,
            currentSettings,
            this.name
          );
          try {
            const { id, name } = await wplacer.login(
              users[userToRun.userId].cookies
            );
            this.status = `Running user ${name}#${id}`;
            log(
              id,
              name,
              `[${this.name}] 🔋 User has ${Math.floor(
                wplacer.userInfo.charges.count
              )} charges. Starting turn...`
            );
            await this._performPaintTurn(wplacer);
            await this.handleUpgrades(wplacer);
          } catch (error) {
            logUserError(
              error,
              userToRun.userId,
              users[userToRun.userId].name,
              "perform paint turn"
            );
          } finally {
            activeBrowserUsers.delete(userToRun.userId);
          }
          if (this.running && this.userIds.length > 1) {
            await this.sleep(currentSettings.accountCooldown);
          }
        } else {
          // No users ready, check for buying charges or wait
          if (this.canBuyCharges && !activeBrowserUsers.has(this.masterId)) {
            activeBrowserUsers.add(this.masterId);
            const chargeBuyer = new WPlacer(
              this.template,
              this.coords,
              currentSettings,
              this.name
            );
            try {
              await chargeBuyer.login(users[this.masterId].cookies);
              const affordableDroplets =
                chargeBuyer.userInfo.droplets - currentSettings.dropletReserve;
              if (affordableDroplets >= 500) {
                const amountToBuy = Math.min(
                  Math.ceil(this.pixelsRemaining / 30),
                  Math.floor(affordableDroplets / 500)
                );
                if (amountToBuy > 0) {
                  log(
                    this.masterId,
                    this.masterName,
                    `[${this.name}] 💰 Attempting to buy pixel charges...`
                  );
                  await chargeBuyer.buyProduct(80, amountToBuy);
                  await this.sleep(currentSettings.purchaseCooldown);
                  continue; // Restart cycle to re-evaluate user states
                }
              }
            } catch (error) {
              logUserError(
                error,
                this.masterId,
                this.masterName,
                "attempt to buy pixel charges"
              );
            } finally {
              activeBrowserUsers.delete(this.masterId);
            }
          }

          const times = userStates.map((u) =>
            Math.max(
              0,
              (Math.max(1, u.charges.max * currentSettings.chargeThreshold) -
                u.charges.count) *
                u.cooldownMs
            )
          );
          const waitTime = (times.length ? Math.min(...times) : 60000) + 2000;
          this.status = `Waiting for charges.`;
          log(
            "SYSTEM",
            "wplacer",
            `[${this.name}] ⏳ No users ready. Waiting for ${duration(
              waitTime
            )}.`
          );
          await this.sleep(waitTime);
        }
      }
    } finally {
      activePaintingTasks--;
      if (this.status !== "Finished.") {
        this.status = "Stopped.";
      }
    }
  }
}

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

// --- API Endpoints ---
// Progress endpoint
app.get("/template/:id/progress", async (req, res) => {
  const { id } = req.params;
  if (!templates[id]) return res.sendStatus(404);

  const template = templates[id];
  res.json({
    totalPixels: template.totalPixels,
    pixelsRemaining: template.pixelsRemaining,
    lastUpdated: Date.now(),
  });
});

app.post("/template", async (req, res) => {
  const {
    templateName,
    template,
    coords,
    userIds,
    canBuyCharges,
    canBuyMaxCharges,
    antiGriefMode,
    autoStart,
  } = req.body;
  
  if (!templateName || !template || !coords || !userIds || !userIds.length)
    return res.status(400).json({ error: "Missing required fields" });
    
  if (Object.values(templates).some((t) => t.name === templateName)) {
    return res
      .status(409)
      .json({ error: "A template with this name already exists." });
  }
  
  const templateId = Date.now().toString();
  
  try {
    templates[templateId] = new TemplateManager(
      templateName,
      template,
      coords,
      canBuyCharges,
      canBuyMaxCharges,
      antiGriefMode,
      userIds,
      autoStart || false
    );

    saveTemplates();

    // Auto-start if enabled - with proper error handling
    if (autoStart) {
      console.log(`🚀 Auto-starting new template: ${templateName}`);
      setTimeout(() => {
        templates[templateId]
          .start()
          .catch((error) => {
            console.error(`Error auto-starting template "${templateName}":`, error);
            log(
              templateId,
              templates[templateId].masterName,
              "Error auto-starting template",
              error
            );
          });
      }, 1000); // Small delay to ensure template is fully saved
    }

    res.status(200).json({ id: templateId });
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template: " + error.message });
  }
});

app.get("/users", (_, res) => res.json(users));
app.post("/user", async (req, res) => {
  if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
  const wplacer = new WPlacer();
  try {
    const userInfo = await wplacer.login(req.body.cookies);
    users[userInfo.id] = {
      name: userInfo.name,
      cookies: req.body.cookies,
      expirationDate: req.body.expirationDate,
    };
    saveUsers();
    res.json(userInfo);
  } catch (error) {
    logUserError(error, "NEW_USER", "N/A", "add new user");
    res.status(500).json({ error: error.message });
  }
});

app.delete("/user/:id", async (req, res) => {
  const userIdToDelete = req.params.id;
  if (!userIdToDelete || !users[userIdToDelete]) return res.sendStatus(400);

  const deletedUserName = users[userIdToDelete].name;
  delete users[userIdToDelete];
  saveUsers();
  log("SYSTEM", "Users", `Deleted user ${deletedUserName}#${userIdToDelete}.`);

  let templatesModified = false;
  for (const templateId in templates) {
    const template = templates[templateId];
    const initialUserCount = template.userIds.length;
    template.userIds = template.userIds.filter((id) => id !== userIdToDelete);

    if (template.userIds.length < initialUserCount) {
      templatesModified = true;
      log(
        "SYSTEM",
        "Templates",
        `Removed user ${deletedUserName}#${userIdToDelete} from template "${template.name}".`
      );
      if (template.masterId === userIdToDelete) {
        template.masterId = template.userIds[0] || null;
        template.masterName = template.masterId
          ? users[template.masterId].name
          : null;
      }
      if (template.userIds.length === 0 && template.running) {
        template.running = false;
        log(
          "SYSTEM",
          "wplacer",
          `[${template.name}] 🛑 Template stopped because it has no users left.`
        );
      }
    }
  }
  if (templatesModified) saveTemplates();
  res.sendStatus(200);
});

app.get("/user/status/:id", async (req, res) => {
  const { id } = req.params;
  if (!users[id] || activeBrowserUsers.has(id)) return res.sendStatus(409);
  activeBrowserUsers.add(id);
  const wplacer = new WPlacer();
  try {
    const userInfo = await wplacer.login(users[id].cookies);
    res.status(200).json(userInfo);
  } catch (error) {
    logUserError(error, id, users[id].name, "validate cookie");
    res.status(500).json({ error: error.message });
  } finally {
    activeBrowserUsers.delete(id);
  }
});

app.get("/templates", (_, res) => {
    const sanitizedTemplates = {};
    for (const id in templates) {
        const t = templates[id];
        sanitizedTemplates[id] = {
            name: t.name,
            template: t.template,
            coords: t.coords,
            canBuyCharges: t.canBuyCharges,
            canBuyMaxCharges: t.canBuyMaxCharges,
            antiGriefMode: t.antiGriefMode,
            autoStart: t.autoStart,  // Add this line
            userIds: t.userIds,
            running: t.running,
            status: t.status,
            pixelsRemaining: t.pixelsRemaining,
            totalPixels: t.totalPixels
        };
    }
    res.json(sanitizedTemplates);
});


app.delete("/template/:id", async (req, res) => {
  const { id } = req.params;
  
  if (!id || !templates[id]) {
    return res.status(404).json({ error: "Template not found" });
  }
  
  const template = templates[id];
  
  // If template is running, stop it first
  if (template.running) {
    try {
      template.running = false;
      log("SYSTEM", "wplacer", `[${template.name}] 🛑 Template stopped before deletion.`);
    } catch (error) {
      console.warn("Error stopping template before deletion:", error);
    }
  }
  
  // Delete the template
  const templateName = template.name;
  delete templates[id];
  saveTemplates();
  
  log("SYSTEM", "wplacer", `🗑️ Template "${templateName}" (${id}) deleted.`);
  res.status(200).json({ message: "Template deleted successfully" });
});

app.put("/template/edit/:id", async (req, res) => {
  const { id } = req.params;
  if (!templates[id]) return res.sendStatus(404);
  
  const manager = templates[id];
  const {
    templateName,
    coords,
    userIds,
    canBuyCharges,
    canBuyMaxCharges,
    antiGriefMode,
    autoStart,
    template,
  } = req.body;
  
  const wasAutoStart = manager.autoStart;
  
  manager.name = templateName;
  manager.coords = coords;
  manager.userIds = userIds;
  manager.canBuyCharges = canBuyCharges;
  manager.canBuyMaxCharges = canBuyMaxCharges;
  manager.antiGriefMode = antiGriefMode;
  manager.autoStart = autoStart || false;
  
  if (template) {
    manager.template = template;
    manager.totalPixels = manager.template.data
      .flat()
      .filter((p) => p > 0).length;
  }
  
  manager.masterId = manager.userIds[0];
  manager.masterName = users[manager.masterId].name;
  
  saveTemplates();
  
  // Log autostart status change
  if (wasAutoStart !== manager.autoStart) {
    console.log(`🔧 Template "${templateName}" autostart changed: ${wasAutoStart} → ${manager.autoStart}`);
  }
  
  res.sendStatus(200);
});

app.put("/template/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !templates[id]) return res.sendStatus(400);
  const manager = templates[id];
  if (req.body.running && !manager.running) {
    manager
      .start()
      .catch((error) =>
        log(id, manager.masterName, "Error starting template", error)
      );
  } else {
    manager.running = false;
  }
  res.sendStatus(200);
});

app.get("/settings", (_, res) => res.json(currentSettings));
app.put("/settings", (req, res) => {
  const oldSettings = { ...currentSettings };
  currentSettings = { ...currentSettings, ...req.body };
  saveSettings();
  if (oldSettings.chargeThreshold !== currentSettings.chargeThreshold) {
    for (const id in templates) {
      if (templates[id].running) templates[id].interruptSleep();
    }
  }
  res.sendStatus(200);
});

app.get("/canvas", async (req, res) => {
  const { tx, ty } = req.query;
  if (isNaN(parseInt(tx)) || isNaN(parseInt(ty))) return res.sendStatus(400);
  try {
    const url = `https://backend.wplace.live/files/s0/tiles/${tx}/${ty}.png`;
    const response = await fetch(url);
    if (!response.ok) return res.sendStatus(response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.json({ image: `data:image/png;base64,${buffer.toString("base64")}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Keep-Alive System ---
const keepAlive = async () => {
  if (activeBrowserUsers.size > 0) {
    log(
      "SYSTEM",
      "wplacer",
      "⚙️ Deferring keep-alive check: a browser operation is active."
    );
    return;
  }
  log(
    "SYSTEM",
    "wplacer",
    "⚙️ Performing periodic cookie keep-alive check for all users..."
  );
  for (const userId of Object.keys(users)) {
    if (activeBrowserUsers.has(userId)) {
      log(
        userId,
        users[userId].name,
        "⚠️ Skipping keep-alive check: user is currently busy."
      );
      continue;
    }
    activeBrowserUsers.add(userId);
    const wplacer = new WPlacer();
    try {
      await wplacer.login(users[userId].cookies);
      log(userId, users[userId].name, "✅ Cookie keep-alive successful.");
    } catch (error) {
      logUserError(
        error,
        userId,
        users[userId].name,
        "perform keep-alive check"
      );
    } finally {
      activeBrowserUsers.delete(userId);
    }
    await sleep(currentSettings.keepAliveCooldown);
  }
  log("SYSTEM", "wplacer", "✅ Keep-alive check complete.");
};

// --- Server Startup ---
(async () => {
  console.clear();
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  console.log(`\n--- wplacer v${version} by luluwaffless and jinx ---\n`);

  const loadedTemplates = loadJSON("templates.json");
  const autoStartTemplates = []; // Track templates that should auto-start
  
  for (const id in loadedTemplates) {
    const t = loadedTemplates[id];
    if (t.userIds.every((uid) => users[uid])) {
      try {
        templates[id] = new TemplateManager(
          t.name,
          t.template,
          t.coords,
          t.canBuyCharges,
          t.canBuyMaxCharges,
          t.antiGriefMode,
          t.userIds,
          t.autoStart || false
        );
        
        // Queue auto-start templates
        if (t.autoStart) {
          autoStartTemplates.push({ id, template: templates[id] });
        }
      } catch (error) {
        console.warn(
          `⚠️ Failed to load template "${t.name}": ${error.message}`
        );
      }
    } else {
      console.warn(
        `⚠️ Template "${t.name}" was not loaded because its assigned user(s) no longer exist.`
      );
    }
  }
  
  console.log(
    `✅ Loaded ${Object.keys(templates).length} templates and ${
      Object.keys(users).length
    } users.`
  );

  const port = Number(process.env.PORT) || 80;
  const host = "0.0.0.0";
  
  app.listen(port, host, () => {
    console.log(`✅ Server listening on http://localhost:${port}`);
    console.log(`   Open the web UI in your browser to start!`);
    
    // Start auto-start templates after server is fully initialized
    if (autoStartTemplates.length > 0) {
      console.log(`🚀 Auto-starting ${autoStartTemplates.length} template(s)...`);
      
      setTimeout(() => {
        autoStartTemplates.forEach(({ id, template }) => {
          if (!template.running) { // Only start if not already running
            console.log(`🚀 Auto-starting template: ${template.name}`);
            template.start().catch((error) =>
              log(
                id,
                template.masterName,
                `Error auto-starting template "${template.name}"`,
                error
              )
            );
          }
        });
      }, 2000); // Small delay to ensure everything is ready
    }
    
    setInterval(keepAlive, 20 * 60 * 1000); // 20 minutes
  });
})();