# <div align="center"><img src="public/icons/favicon.png" width="32" height="32" style="vertical-align: middle;"> wplacer</div>

<div align="center">
  <img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer" alt="Version">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer" alt="License"></a>
  <a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-5865F2?style=flat&logo=Discord&logoColor=white" alt="Discord Support"></a>
  <a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-00d26a" alt="Portuguese"></a>
  <a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-0051d5" alt="French"></a>
</div>

<br>

An advanced, multi-account auto-drawing bot for [wplace.live](https://wplace.live/) featuring intelligent user management, sophisticated drawing algorithms, comprehensive template controls, and real-time progress tracking.

---

## ✨ Key Features

### 🎯 **Next-Generation Drawing Engine**
- **Advanced Multi-Account System**: Intelligently manages multiple accounts with charge-based prioritization and automatic user rotation
- **8+ Drawing Modes**: Linear (4-directional), Color-based, Random, and Edge-first strategies for optimal template completion
- **Outline Mode**: Prioritizes edge pixels for cleaner template boundaries and professional results
- **Smart Charge Management**: Automatic charge threshold detection with customizable activation levels
- **Real-time Progress Tracking**: Live progress bars with pixel completion statistics and ETA calculations

### 🚀 **Enhanced Automation & Management**
- **Intelligent Auto-Purchase System**: Automatically buys max charge upgrades and pixel charges based on template requirements
- **Advanced Anti-Grief Protection**: Continuous monitoring of completed templates with automatic damage repair
- **Smart User Suspension Handling**: Automatic detection and management of temporarily suspended accounts
- **Turnstile Integration**: Seamless CAPTCHA handling with desktop notifications and token management
- **Account Health Monitoring**: Built-in cookie validation, status checking, and automatic session refresh

### 🎨 **Advanced Template System**
- **Enhanced Image Processing**: Supports PNG with transparency, premium colors, and intelligent color optimization
- **Dual Image Modes**: Convert images to nearest colors OR use pre-validated images with exact color matching
- **Live Canvas Preview**: Real-time preview of template placement on actual canvas with mismatch detection
- **Hot-Swap Templates**: Update images and settings without stopping active drawing sessions
- **Smart Coordinate Parsing**: Auto-detection of wplace.live URLs, coordinate strings, and bulk coordinate entry
- **Premium Color Support**: Full access to extended color palette with paid color integration

### ⚙️ **Comprehensive Control Interface**
- **Modern Web-Based Interface**: Clean, responsive UI with dark theme and intuitive navigation
- **Granular Settings Management**: Customizable cooldowns, thresholds, and behavior controls with real-time updates
- **Advanced Template Actions**: Start, stop, pause, restart, edit, and bulk-manage templates on-the-fly
- **Progress Monitoring**: Real-time completion tracking with detailed statistics and visual progress bars
- **User Status Dashboard**: Live account monitoring with charge levels, suspension status, and health indicators

---

## 🛠️ Installation

### Prerequisites
- **[Node.js 16+](https://nodejs.org/)** - JavaScript runtime environment
- **[Tampermonkey](https://www.tampermonkey.net/)** - Browser extension for userscripts
- **Modern Browser** - Chrome, Edge, or Safari recommended (Firefox has known compatibility issues)

### Quick Setup

1. **Clone the Repository**
   **Option A: Using Git (Recommended)**
    ```bash
    git clone https://github.com/luluwaffless/wplacer.git
    cd wplacer
    ```

  **Option B: Direct Download**
  - [Download the ZIP](https://github.com/luluwaffless/wplacer/archive/refs/heads/main.zip) and extract to your preferred directory

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
   # Create .env file for custom configuration
   echo "HOST=127.0.0.1" >> .env
   echo "PORT=80" >> .env
   ```

5. **Start wplacer**
   ```bash
   npm start
   ```

---

## 🚀 Usage Guide

### Initial Setup
1. Open the displayed URL (typically `http://127.0.0.1/`) in your browser
2. Log into [wplace.live](https://wplace.live/) in your browser with the extension installed
3. Accounts will automatically appear in the **Manage Users** section
4. If users don't appear, use the manual add/update users button in the extension popup

### Creating Templates

#### Method 1: Image Conversion (Recommended for Most Users)
1. Navigate to **Add Template**
2. **Convert Image**: Click "Convert Image" and select a PNG file
   - Colors will be automatically converted to the nearest valid palette colors
   - Transparent pixels will be ignored
   - Supports both basic and premium color palettes
3. **Set Coordinates**: 
   - Enter tile coordinates (TX, TY) and pixel coordinates (PX, PY)
   - Or paste a wplace.live URL for automatic coordinate extraction
   - Or enter space-separated coordinates: `TX TY PX PY`
4. **Configure Options**:
   - **Use Paid Colors**: Enable for exact color matching with premium palette
   - **Auto-Purchase Max Charges**: Enable automatic charge upgrade buying
   - **Auto-Purchase Charges**: Enable pixel charge purchasing
   - **Anti-Grief Mode**: Keep template monitored after completion
5. **Assign Users**: Select which accounts should work on this template
6. Click **Add Template**

#### Method 2: Pre-Validated Images (Advanced Users)
1. Use the **Add Image** option instead of Convert Image
2. Upload an image that already uses exact wplace.live colors
3. System will validate all pixels and reject images with invalid colors
4. Perfect for templates created with external tools

### Managing Templates
- **Individual Controls**: Start, stop, edit, or delete templates independently
- **Bulk Actions**: Start or stop all templates simultaneously
- **Real-time Monitoring**: View live progress bars with completion percentages
- **Template Editing**: Modify settings, coordinates, or swap images without recreating
- **Progress Tracking**: Detailed statistics showing pixels painted, remaining, and completion ETA

### User Management
- **Account Status Checking**: Real-time validation of cookies and account health
- **Bulk Status Updates**: Check all accounts simultaneously with progress tracking
- **Suspension Monitoring**: Automatic detection and handling of suspended accounts
- **Charge Tracking**: Live display of current/max charges and user levels

---

## 🐳 Docker Deployment

### Basic Docker Setup
```bash
# Build and run
docker build -t wplacer .
docker run -d --restart always -p 80:80 wplacer

# With persistent data storage
docker run -d --restart always \
  -p 80:80 \
  -v "$(pwd)/data:/usr/src/app/data" \
  --name wplacer \
  luluwaffless/wplacer
```

### Docker Compose (Recommended)
```yaml
version: '3.8'
services:
  wplacer:
    image: luluwaffless/wplacer
    ports:
      - "80:80"
    volumes:
      - ./data:/usr/src/app/data
      - ./users.json:/usr/src/app/users.json
      - ./templates.json:/usr/src/app/templates.json
      - ./settings.json:/usr/src/app/settings.json
    environment:
      - HOST=0.0.0.0
      - PORT=80
    restart: unless-stopped
```

---

## ⚙️ Advanced Configuration Options

### Drawing & Performance Settings
- **Drawing Mode**: Choose from 8 different pixel placement strategies
- **Outline Mode**: Prioritize template edges for cleaner, more professional results
- **Charge Threshold**: Minimum charge percentage (0-100%) before user activation
- **Account Cooldown**: Delay between user switches (prevents rate limiting)
- **Keep Alive Cooldown**: Interval for periodic cookie validation

### Automation Settings
- **Purchase Cooldown**: Delay after buying items to prevent transaction conflicts
- **Droplet Reserve**: Minimum droplets to keep before making purchases
- **Anti-Grief Standby**: Time between completed template monitoring checks

### Notification Settings
- **Desktop Notifications**: Toggle alerts when manual intervention is needed
- **Turnstile Handling**: Automatic CAPTCHA token management and processing

---

## 📊 Drawing Strategies Explained

| Mode | Description | Best For | Performance |
|------|-------------|----------|-------------|
| **Top to Bottom** | Linear scanning from top | Standard templates | Fast |
| **Bottom to Top** | Reverse linear scanning | Bottom-heavy designs | Fast |
| **Left to Right** | Horizontal scanning | Wide templates | Fast |
| **Right to Left** | Reverse horizontal | RTL optimized designs | Fast |
| **Random Color** | Shuffled color order | Balanced color distribution | Medium |
| **Color by Color** | Complete each color sequentially | Organized, methodical approach | Medium |
| **Random Pixels** | Completely randomized | Stealth drawing, anti-detection | Slow |
| **Edges First** | Outline before fill | Professional template boundaries | Medium |

**Outline Mode Enhancement**: When enabled with any strategy, prioritizes edge pixels first for cleaner template placement and better visual results.

---

## 🔧 Advanced Features & Capabilities

### Enhanced Template Management
- **Hot-swapping**: Update template images and settings without interrupting active sessions
- **Multi-user coordination**: Intelligent user queue management with charge-based prioritization
- **Progress persistence**: Automatic resume of interrupted templates with saved state
- **Conflict resolution**: Graceful handling of overlapping templates and user conflicts
- **Template validation**: Pre-upload validation ensures only compatible images are accepted

### Intelligent Account Management
- **Cookie validation**: Continuous session health checks with automatic renewal
- **Charge optimization**: Smart user selection based on available charges and cooldowns
- **Rate limit handling**: Automatic backoff and retry logic with exponential delays
- **Suspension management**: Automatic detection and temporary exclusion of suspended accounts
- **Parallel processing**: Concurrent account status checking with configurable limits

### Advanced Canvas Integration
- **Live canvas preview**: Real-time visualization of template placement on actual canvas
- **Mismatch detection**: Intelligent identification of pixels needing correction or repair
- **Full color palette support**: Complete basic + premium color support with automatic optimization
- **Transparency handling**: Smart processing of transparent pixels with placement optimization
- **Multi-tile rendering**: Seamless handling of large templates spanning multiple canvas tiles

---

## 🚨 Important Considerations & Best Practices

> **⚠️ Disclaimer**: wplacer is an independent tool not affiliated with wplace.live. Use responsibly and at your own discretion and risk.

### Recommended Best Practices
- **Start Small**: Test with 1-2 accounts before scaling up to ensure proper configuration
- **Monitor Usage**: Watch for rate limits and adjust cooldowns accordingly based on server response
- **Regular Updates**: Keep wplacer updated for latest improvements, bug fixes, and compatibility
- **Resource Management**: Monitor system resources when running multiple large templates
- **Account Safety**: Use separate accounts for botting to protect your main wplace.live account

### Performance Optimization
- **Concurrent Limits**: Adjust account cooldowns based on your server's rate limiting
- **Template Size**: Break large templates into smaller sections for better progress tracking
- **Color Usage**: Enable paid colors only when necessary to reduce purchase costs
- **Preview Usage**: Limit canvas previews for large templates to reduce bandwidth

### Security Considerations
- **Cookie Management**: Regularly refresh account cookies to maintain session validity
- **Rate Limiting**: Respect server limits to avoid IP-based restrictions
- **Suspension Handling**: Allow automatic suspension management rather than manual override

---

## 💡 Future Development Roadmap

### Planned Improvements
- [ ] **Proxy Support**: Route different accounts through separate IP addresses for better rate limit management
- [ ] **Collaborative Features**: Multi-user template sharing and coordination tools

---

## 🔧 Troubleshooting & Common Issues

### Connection Issues
- **Server Unreachable**: Ensure bot is running and accessible on the specified port
- **Extension Not Working**: Verify Tampermonkey is enabled and extension is loaded
- **Cookie Errors**: Re-login to wplace.live to refresh authentication tokens

### Template Issues
- **Invalid Colors**: Use "Convert Image" instead of "Add Image" for automatic color correction
- **Coordinate Problems**: Double-check tile and pixel coordinates
- **Preview Not Loading**: Verify coordinates are within valid canvas bounds

---

## 📜 License & Credits

### License
Licensed under [GNU Affero General Public License v3.0](LICENSE)

### Primary Contributors
- **[luluwaffless](https://github.com/luluwaffless)**
- **[Jinx](https://github.com/JinxTheCatto)**

### Community Contributors
<div align="center">
  <a href="https://github.com/luluwaffless/wplacer/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=luluwaffless/wplacer" alt="Contributors" />
  </a>
</div>

### Special Thanks
- **wplace.live Community** - For feedback, testing, and feature suggestions
- **Documentation Contributors** - For improving guides and troubleshooting resources

---

## 🆘 Support & Community

### Get Help & Support
- **[Discord Server](https://discord.gg/qbtcWrHJvR)** - Real-time support, community discussions, and announcements
- **[GitHub Issues](https://github.com/luluwaffless/wplacer/issues)** - Bug reports, feature requests, and technical issues

### Useful Resources & Tools
- **[wplace.live](https://wplace.live/)** - The official target canvas platform
- **[Blue Marble Script](https://github.com/SwingTheVine/Wplace-BlueMarble)** - Coordinate helper and placement tools
- **[Color Converter Tool](https://pepoafonso.github.io/color_converter_wplace/e)** - Reference for available colors and palette optimization

---

<div align="center">
  <strong>🎨 Happy Drawing! 🎨</strong>
  <br><br>
  <em>Built with ❤️ by the wplacer community</em>
  <br>
  <em>Making pixel art accessible to everyone, everywhere</em>
  <br><br>
  <sub>Version 2.0+ - Now with enhanced automation, real-time progress tracking, and premium features</sub>
</div>