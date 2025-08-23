# <div align="center"><img src="public/icons/favicon.png" width="32" height="32" style="vertical-align: middle;"> wplacer</div>

<div align="center">
  <img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer" alt="Version">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer" alt="License"></a>
  <a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-5865F2?style=flat&logo=Discord&logoColor=white" alt="Discord Support"></a>
  <a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-00d26a" alt="Portuguese"></a>
  <a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-0051d5" alt="French"></a>
</div>

<br>

A sophisticated, multi-account auto-drawing bot for [wplace.live](https://wplace.live/) featuring intelligent user management, advanced drawing algorithms, and comprehensive template controls.

---

## ✨ Key Features

### 🎯 **Smart Drawing Engine**
- **Advanced Multi-Account System**: Intelligently manages multiple accounts with charge-based prioritization
- **8 Drawing Modes**: Linear (4-directional), Color-based, Random, and Edge-first strategies
- **Outline Mode**: Prioritizes edge pixels for cleaner template placement
- **Real-time Progress Tracking**: Live updates on template completion status

### 🚀 **Automation & Management**
- **Auto-Purchase System**: Automatically buys max charge upgrades and pixel charges when needed
- **Anti-Grief Protection**: Monitors completed templates for vandalism and repairs damage
- **Turnstile Integration**: Seamless CAPTCHA handling with desktop notifications
- **Account Health Monitoring**: Built-in cookie validation and status checking

### 🎨 **Template System**
- **Advanced Image Processing**: Supports PNG with transparency, paid colors, and color optimization
- **Live Canvas Preview**: Real-time preview of template placement on actual canvas
- **Hot-Swap Templates**: Update images without stopping active drawing sessions
- **Coordinate Auto-Detection**: Smart parsing of wplace.live URLs and coordinate strings

### ⚙️ **Configuration & Control**
- **Web-Based Interface**: Clean, responsive UI for all management tasks
- **Granular Settings**: Customizable cooldowns, thresholds, and behavior controls
- **Template Actions**: Start, stop, pause, restart, and edit templates on-the-fly
- **Bulk Operations**: Start or stop all templates simultaneously

---

## 🛠️ Installation

### Prerequisites
- **[Node.js 16+](https://nodejs.org/)** - JavaScript runtime
- **[Tampermonkey](https://www.tampermonkey.net/)** - Browser extension for userscripts
- **Modern Browser** - Any browser that allows for unloaded extension (Firefox not reccomended)

### Quick Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/luluwaffless/wplacer.git
   cd wplacer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Install Browser Extension**
   - Open your browser's extension management page
   - Enable **Developer Mode**
   - Click **"Load Unpacked"** and select the `LOAD_UNPACKED` folder
   - Repeat for each browser you want to use

4. **Configure Environment (Optional)**
   ```bash
   # Default .env file
   echo "HOST=127.0.0.1"
   echo "PORT=80"
   ```

5. **Start wplacer**
   ```bash
   npm start
   ```

---

## 🚀 Usage Guide

### Initial Setup
1. Open the displayed URL (usually `http://127.0.0.1/`) in your browser
2. Log into [wplace.live](https://wplace.live/) in each browser tab with the extension
3. Accounts will automatically appear in the **Manage Users** section

### Creating Templates
1. Navigate to **Add Template**
2. **Upload Image**: Click "Convert Image" and select a PNG file
3. **Set Coordinates**: 
   - Enter tile coordinates (TX, TY) and pixel coordinates (PX, PY)
   - **Pro Tip**: Paste a wplace.live pixel URL directly into the TX field for auto-parsing
4. **Configure Options**:
   - **Use Paid Colors**: Enable for exact color matching with premium palette
   - **Auto-Purchase**: Enable charge/upgrade buying
   - **Anti-Grief Mode**: Keep template monitored after completion
5. **Assign Users**: Select which accounts should work on this template
6. Click **Add Template**

### Managing Templates
- **Start/Stop**: Individual template controls
- **Bulk Actions**: Start or stop all templates at once  
- **Edit Templates**: Modify settings, coordinates, or swap images
- **Real-time Status**: Monitor progress and user activity

---

## 🐳 Docker Deployment

### Basic Docker Setup
```bash
# Build and run
docker build -t wplacer .
docker run -d --restart always -p 80:80 wplacer

# With persistent data
docker run -d --restart always \
  -p 80:80 \
  -v "$(pwd)/data:/usr/src/app/data" \
  --name wplacer \
  luluwaffless/wplacer
```

### Docker Compose
```yaml
version: '3.8'
services:
  wplacer:
    image: luluwaffless/wplacer
    ports:
      - "80:80"
    volumes:
      - ./data:/usr/src/app/data
    environment:
      - HOST=0.0.0.0
      - PORT=80
    restart: unless-stopped
```

---

## ⚙️ Configuration Options

### Drawing Settings
- **Drawing Mode**: 8 different pixel placement strategies
- **Outline Mode**: Prioritize template edges for cleaner results
- **Charge Threshold**: Minimum charge percentage before user activation

### Automation Settings
- **Account Cooldown**: Delay between user switches (prevents rate limiting)
- **Purchase Cooldown**: Delay after buying items
- **Droplet Reserve**: Minimum droplets to keep before purchases
- **Anti-Grief Standby**: How long to wait between completed template checks

### Notification Settings
- **Desktop Notifications**: Toggleable lert when manual intervention needed
- **Turnstile Handling**: Automatic CAPTCHA token management

---

## 📊 Drawing Strategies Explained

| Mode | Description | Best For |
|------|-------------|----------|
| **Top to Bottom** | Linear scanning from top | Standard templates |
| **Bottom to Top** | Reverse linear scanning | Bottom-heavy designs |
| **Left to Right** | Horizontal scanning | Wide templates |
| **Right to Left** | Reverse horizontal | RTL optimized |
| **Random Color** | Shuffled color order | Balanced color distribution |
| **Color by Color** | Complete each color sequentially | Organized approach |
| **Random Pixels** | Completely randomized | Stealth drawing |
| **Edges First** | Outline before fill | Clean template boundaries |

---

## 🔧 Advanced Features

### Template Management
- **Hot-swapping**: Update template images without stopping
- **Multi-user coordination**: Intelligent user queue management  
- **Progress persistence**: Resume interrupted templates
- **Conflict resolution**: Handle overlapping templates gracefully

### Account Management
- **Cookie validation**: Automatic session health checks
- **Charge optimization**: Smart user selection based on available charges
- **Rate limit handling**: Automatic backoff and retry logic
- **Parallel processing**: Concurrent account status checking

### Canvas Integration
- **Live preview**: See template placement on actual canvas
- **Mismatch detection**: Identify pixels needing correction
- **Color palette support**: Full basic + premium color support
- **Transparency handling**: Smart transparent pixel processing

---

## 🚨 Important Considerations

> **⚠️ Disclaimer**: Wplacer is an independent tool not affiliated with wplace.live. Use at your own discretion and risk.

### Best Practices
- **Check if it runs correctly**: Test with 1-2 accounts before scaling up
- **Monitor Usage**: Watch for rate limits and adjust cooldowns accordingly
- **Keep Updated**: Regular updates include improvements and fixes

---

## 💡 Enhancement Ideas & Roadmap

### Short-term Improvements
- [ ] **Proxy Support**: Route accounts through different IP addresses
- [ ] **Advanced Statistics**: Detailed analytics dashboard with charts
- [ ] **Template Scheduler**: Time-based template activation
---

## 📜 License & Credits

### License
Licensed under [GNU Affero General Public License v3.0](LICENSE)

### Credits
- **[luluwaffless](https://github.com/luluwaffless)**
- **[Jinx](https://github.com/JinxTheCatto)**

### Community Contributors
<div align="center">
  <a href="https://github.com/luluwaffless/wplacer/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=luluwaffless/wplacer" alt="Contributors" />
  </a>
</div>

---

## 🆘 Support & Community

### Get Help
- **[Discord Server](https://discord.gg/qbtcWrHJvR)** - Real-time support and community
- **[GitHub Issues](https://github.com/luluwaffless/wplacer/issues)** - Bug reports and feature requests  

### Useful Resources
- **[wplace.live](https://wplace.live/)** - The target canvas platform
- **[Blue Marble Script](https://github.com/SwingTheVine/Wplace-BlueMarble)** - Coordinate helper
- **[Image Converter](https://pepoafonso.github.io/color_converter_wplace/e)** - Available colors reference

---

<div align="center">
  <strong>🎨 Happy Drawing! 🎨</strong>
  <br><br>
  <em>Built with ❤️ by the wplacer community</em>
  <br>
  <em>Making pixel art accessible to everyone</em>
</div>