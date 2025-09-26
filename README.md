<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/wplacer/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/wplacer/wplacer"></a>
<a href="https://discord.gg/wplacerbot"><img src="https://img.shields.io/badge/Support-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-green"></a>
<a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue"></a>
<a href="README_zh-cn.md"><img src="https://img.shields.io/badge/翻译-简体中文-red"></a></p>

A massively updated auto-drawing bot for [wplace.live](https://wplace.live/).

## Features ✅

-   **Simple and easy-to-use web UI:** For managing users and templates
-   **Advanced Multi-Account System:** Run templates with multiple users simultaneously. The system intelligently prioritizes users with the most charges available to maximize efficiency.
-   **Multiple Drawing Modes:** Choose from several drawing strategies (Top to Bottom, Bottom to Top, Edges First, Color-By-Color, etc.) to optimize your approach for different templates.
-   **Automatic Upgrade Purchasing:** If enabled, the bot will automatically purchase max charge upgrades or extra charges when running out for your accounts whenever they have enough droplets.
-   **Account Status Checker:** A tool in the "Manage Users" tab allows you to quickly check if your accounts' cookies are still valid.
-   **Advanced Template Controls:** Options such as restarting, replacing a template's image, or pausing on the fly make management more flexible as well as providing you with real time updates on the template's status.
-   **Automatic Captcha (Turnstile) Token Handling:** Turnstile handling lets you babysit the bot much less
-   **Desktop Notifications:** The program will now send a desktop notification when it needs a new Turnstile token, so you don't have to constantly check the console.

## Installation and Usage 💻

[Video Tutorial](https://www.youtube.com/watch?v=YR978U84LSY)

### Requirements:
- [Node.js and NPM](https://nodejs.org/en/download)
- [Tampermonkey](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (optional, but recommended)
### Installation:
1. Download the repository using [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) or download the ZIP directly from GitHub (not recommended).
1. In the terminal, navigate to the project directory and install the dependencies with `npm i`.
1. Install the extension on each browser window with an account you want to be used by wplacer and to automatically solve Turnstiles (CAPTCHAs) by going to the extensions page of your browser, turning on developer mode, pressing load unpacked, and then selecting the LOAD_UNPACKED folder included with wplacer.
- If you'd like, you can change the host and port of the local server by changing the `.env` file.
### Usage:
1. To start the bot, run `npm start` in the terminal.
1. Open the URL printed in the console (usually `http://127.0.0.1/`) in your browser.
1. In each browser window with the extension installed, log into your account on wplace.live. If your account does not show up in the manager after refreshing it, you can press on the extension to manually send it to wplacer.
1. Go to the "Add Template" page to create your drawing templates.
   - The coordinates (`Tile X/Y`, `Pixel X/Y`) are for the top-left corner of your image. You can find these by clicking a pixel on wplace.live and inspecting the `pixel` request in the Network tab of DevTools. You can also use the [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble) userscript (user TamperMonkey) to see a pixel's coordinates.
   - You can assign multiple users to a single template.
1. Finally, go to "Manage Templates" and click "Start" on any template to begin drawing.
   - The script will occasionally refresh one of the active bot windows on [wplace.live](https://wplace.live/). This is required to refresh the Turnstile token needed for painting.

# FAQ and Common Errors 🤔
### Browser:
- **The best supported browser is Brave, which you can get here: <https://brave.com/download/>**
- Chrome works, but is not reccomended. (zero fingerprint protection - high ban chance)
- Firefox is not supported.
  
### How to get your JWT token:
Go to [wplace.live](<https://wplace.live>), login, click anywhere on the map, then press `Ctrl` + `Shift` + `i`, go to `Application`, find the `j` column, then copy the value inside

### How to install the extension:
Go to the manage extensions tab, enable Developer mode, then click load unpacked, select the `LOAD_UNPACKED` folder.
After that, make sure to click on the extension in wplace.live, and configure your port if you changed it in `.env`

### How to run the bot:
1. Simply open `start.bat`.
2. Open a command prompt in the wplacer folder. You can type `cmd` in the address bar in the file explorer to do this. Run `npm i` in the command prompt, then after run `npm start`.
  - If you get any errors while running `npm i`, run this: `Set-ExecutionPolicy -Scope CurrentUser Bypass` then you can run `npm i`

### How to add proxies:
You need to find your own proxy provider, and once you do you must follow this format: `protocol://ip:port` or `protocol://user:pass:ip:port`
Example: `socks5://127.0.0.1:9050`
Example: `socks5://user:admin:127.0.0.1:9050`

### Why is it stuck on waiting for a token?
You must have at least one tab open to [wplace](<https://wplace.live>). You need a macro or something else that will automatically click the turnstile checkboxes.

### I keep getting error 500:
Two things will cause this, [wplace.live](<https://wplace.live>) being down, or your token is expired.
- To check if wplace is down, go here: <https://status.wplace.lol/>
- If its up, re-add your token by doing the first step.
- If NEITHER are an issue, then its probably something in the code is wrong. Open an issue or tell them in the support server and it should be fixed in future updates.

### ERR_MODULE_NOT_FOUND:
One of your modules are missing. To install them, simply use `npm i`.

**We will NOT provide support for other forks of this project. Ask the respective developers.**

## Notes 📝

> [!CAUTION]
> This bot is not affiliated with [wplace.live](https://wplace.live/) and its use may be against the site's rules. The developers are not responsible for any punishments against your accounts. Use at your own risk.

### To-dos ✅
- [x] ~~Proxy support~~
- [x] ~~Add support for paid colors~~
- [x] ~~Support for painting between multiple tiles~~
- [x] ~~Easier multi-account support for one template~~
- [x] ~~Queueing system for multi-accounts~~

### Credits 🙏

-   [Jinx](https://github.com/JinxTheCatto) [(Donate here to help us develop the project :3)](https://ko-fi.com/jinxthecat)
-   [Lulu](https://github.com/luluwaffless) [(donate here to help us develop the project!)](https://ko-fi.com/luluwaffless)

And to our amazing contributors!
<p align="center"><img src="https://contrib.rocks/image?repo=wplacer/wplacer"></p>

### License 📜

[GNU AGPL v3](LICENSE)
