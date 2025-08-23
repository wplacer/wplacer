# <div align="center"><img src="public/icons/favicon.png" width="24" height="24" style="vertical-align: middle;"> wplacer</div>

<div align="center">
  <img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer" alt="Version">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer" alt="License"></a>
  <a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea" alt="Discord Support"></a>
  <a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-green" alt="Portuguese"></a>
  <a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue" alt="French"></a>
</div>

<br>

**Wplacer** is a massively updated auto-drawing bot for [wplace.live](https://wplace.live/) that enables efficient, multi-account template drawing with intelligent user management and advanced features.

---

## ✨ Features

### 🎯 **Core Functionality**
- **Intuitive Web Interface**: Clean, user-friendly UI for managing accounts and templates
- **Smart Multi-Account System**: Simultaneously deploy multiple users on templates with intelligent charge prioritization for maximum efficiency
- **Flexible Drawing Strategies**: Multiple drawing modes including:
  - Top to Bottom / Bottom to Top
  - Edges First (outline priority)
  - Random Color distribution
  - Custom pattern optimization

### 🚀 **Advanced Features**
- **Auto-Upgrade System**: Automatically purchases charge upgrades and max charges when accounts have sufficient droplets
- **Real-Time Account Monitoring**: Built-in status checker validates cookie authenticity across all accounts
- **Dynamic Template Management**: 
  - Live template controls (restart, pause, resume)
  - Hot-swap template images without stopping
  - Real-time progress tracking and status updates
- **Automated Captcha Handling**: Seamless Turnstile (Cloudflare) token management reduces manual intervention
- **Desktop Notifications**: Stay informed with system notifications when manual attention is needed

---

## 🛠️ Installation and Setup

### 📋 Prerequisites

Before installing wplacer, ensure you have the following:

- **[Node.js (v16+) and NPM](https://nodejs.org/en/download)** - JavaScript runtime and package manager
- **[Tampermonkey Browser Extension](https://www.tampermonkey.net/)** - For userscript management
- **[Git](https://git-scm.com/downloads)** *(recommended)* - For easy repository cloning and updates

### 📥 Step-by-Step Installation

#### 1. **Download wplacer**

**Option A: Using Git (Recommended)**
```bash
git clone https://github.com/luluwaffless/wplacer.git
cd wplacer
```

**Option B: Direct Download**
- Download ZIP from [GitHub releases](https://github.com/luluwaffless/wplacer/releases)
- Extract to your preferred directory

#### 2. **Install Browser Extension**
```bash
# For each browser window you plan to use:
```
1. Open your browser's extension management page
2. Enable **Developer Mode**
3. Click **"Load Unpacked"**
4. Select the `LOAD_UNPACKED` folder from the wplacer directory
5. Repeat for each browser you want to use

#### 3. **Install Dependencies**
```bash
npm install
```

#### 4. **Configure Environment (Optional)**
Create a `.env` file to customize server settings:
```env
# Default configuration
HOST=127.0.0.1
PORT=30
```

---

## 🚀 Usage Guide

### **Starting wplacer**
```bash
npm start
```
The console will display your local server URL (typically `http://127.0.0.1:3000/`)

### **Account Setup**
1. **Open the wplacer interface** in your browser using the provided URL
2. **Log into wplace.live** in each browser window with the extension installed
3. **Verify account detection**: Accounts should appear automatically in the user manager
   - If an account doesn't appear, click the browser extension icon to manually register it
4. **Refresh the manager** to confirm all accounts are properly connected

### **Creating Templates**
Navigate to the **"Add Template"** page:

#### **Template Configuration**
- **Template Name**: Choose a descriptive name for your drawing project
- **Image Upload**: Upload your template image (PNG, JPG, GIF supported)
- **Coordinate Setup**: 
  - `Tile X/Y`: The tile coordinates where your image will be placed
  - `Pixel X/Y`: Precise pixel coordinates within the tile (top-left corner of your image)
  
#### **Finding Coordinates**
**Method 1: Manual Discovery**
1. Go to [wplace.live](https://wplace.live/)
2. Click on your desired starting pixel
3. Open browser DevTools (F12) → Network tab
4. Look for the `pixel` request and note the coordinates

**Method 2: Blue Marble Userscript**
- Install the [Blue Marble userscript](https://github.com/SwingTheVine/Wplace-BlueMarble) via Tampermonkey
- Coordinates will be displayed directly on the canvas

#### **User Assignment**
- Select which accounts should work on this template
- Multiple users can collaborate on a single template for faster completion

### **Template Management**
Go to **"Manage Templates"** to:
- **Start/Stop** template execution
- **Monitor progress** in real-time
- **Pause/Resume** as needed
- **Replace images** without restarting
- **View detailed statistics** and completion rates

---

## 🐳 Docker Deployment

wplacer includes full Docker support for containerized deployment:

### **Docker Configuration**
```dockerfile
# Default start command
CMD ["node", "."]
```

### **Running with Docker**
```bash
# Basic run
docker run -d --restart always -p 3000:3000 luluwaffless/wplacer

# With environment variables
docker run -d --restart always \
  -p 3000:3000 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  luluwaffless/wplacer

# With persistent data volumes
docker run -d --restart always \
  -p 3000:3000 \
  -v "$(pwd)/data/users.json:/usr/src/app/users.json" \
  -v "$(pwd)/data/templates.json:/usr/src/app/templates.json" \
  -v "$(pwd)/data/settings.json:/usr/src/app/settings.json" \
  --name wplacer \
  luluwaffless/wplacer
```

### **Non-TTY Environment Support**
wplacer automatically detects non-interactive environments (Docker, CI/CD) and disables TTY-dependent features to prevent crashes while maintaining full functionality.

---

## ⚠️ Important Notes

> [!CAUTION]
> **Use at Your Own Risk**: wplacer is not affiliated with [wplace.live](https://wplace.live/). Using automation tools may violate the site's terms of service. The developers assume no responsibility for account penalties or restrictions.

### **System Requirements**
- **Automatic Refreshing**: wplacer periodically refreshes browser windows to maintain valid Turnstile tokens
- **Resource Usage**: Multiple accounts require proportional system resources
- **Network Stability**: Stable internet connection recommended for optimal performance

---

## 🗺️ Roadmap

### **Planned Features**
- [ ] **Proxy Support**: Route different accounts through various proxy servers
- [ ] **Auto-Farming System**: Automated EXP and droplet farming for user accounts
- [x] ~~Paid Color Support~~ ✅ **Completed**
- [x] ~~Multi-Tile Painting~~ ✅ **Completed**
- [x] ~~Enhanced Multi-Account Support~~ ✅ **Completed**
- [x] ~~Intelligent Queueing System~~ ✅ **Completed**
- [x] ~~Docker Integration~~ ✅ **Completed**

---

## 🤝 Contributors

### **Core Development Team**
- [luluwaffless](https://github.com/luluwaffless) - *Lead Developer*
- [Jinx](https://github.com/JinxTheCatto) - *Core Contributor*

### **Community Contributors**
<div align="center">
  <img src="https://contrib.rocks/image?repo=luluwaffless/wplacer" alt="Contributors">
</div>

---

## 📜 License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

---

## 🆘 Support

- **Discord Community**: [Join our support server](https://discord.gg/qbtcWrHJvR)
- **Issues & Bugs**: [GitHub Issues](https://github.com/luluwaffless/wplacer/issues)
- **Documentation**: Check this README and in-app help tooltips

---

<div align="center">
  <strong>Happy Drawing! 🎨</strong>
  <br>
  <em>Made with ❤️ by the wplacer community</em>
</div>