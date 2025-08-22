<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-green"></a>
<a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue"></a></p>

A massively updated auto-drawing bot for [wplace.live](https://wplace.live/).

## Features ✅

-   **Simple and easy-to-use web UI:** For managing users and templates
-   **Advanced Multi-Account System:** Run templates with multiple users simultaneously. The system intelligently prioritizes users with the most charges available to maximize efficiency.
-   **Multiple Drawing Modes:** Choose from several drawing strategies (Top to Bottom, Bottom to Top, Edges First, Random Color, etc.) to optimize your approach for different templates.
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
1. Install the extension on each browser window with an account you want to be used by wplacer and to automatically solve Turnstiles (CAPTCHAs) by going to the extensions page of your browser, turning on developer mode, pressing load unpacked, and then selecting the LOAD_UNPACKED folder included with wplacer.
2. Download the repository using [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) or download the ZIP directly from GitHub (not recommended).
3. In the terminal, navigate to the project directory and install the dependencies with `npm i`.
- If you'd like, you can change the host and port of the local server by creating a `.env` file.
### Usage:
1. To start the bot, run `npm start` in the terminal.
2. Open the URL printed in the console (usually `http://127.0.0.1/`) in your browser.
3. In each browser window with the extension installed, log into your account on wplace.live. If your account does not show up in the manager after refreshing it, you can press on the extension to manually send it to wplacer.
4. Go to the "Add Template" page to create your drawing templates.
   - The coordinates (`Tile X/Y`, `Pixel X/Y`) are for the top-left corner of your image. You can find these by clicking a pixel on wplace.live and inspecting the `pixel` request in the Network tab of DevTools. You can also use the [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble) userscript (user TamperMonkey) to see a pixel's coordinates.
   - You can assign multiple users to a single template.
5. Finally, go to "Manage Templates" and click "Start" on any template to begin drawing.
   - The script will occasionally refresh one of the active bot windows on [wplace.live](https://wplace.live/). This is required to refresh the Turnstile token needed for painting.

## Notes 📝

> [!CAUTION]
> This bot is not affiliated with [wplace.live](https://wplace.live/) and its use may be against the site's rules. The developers are not responsible for any punishments against your accounts. Use at your own risk.

### Running in Docker / non-interactive (non-TTY) environments

Interactive console features (progress bars, cursor movement) are now guarded and will only run when `process.stdout.isTTY` is `true`. In Docker or other non-TTY contexts, these calls are skipped to prevent crashes (for example, `TypeError: process.stdout.clearLine is not a function`).

No interactive features were removed; they simply don't render when there is no TTY.

### Docker start command
The Dockerfile starts the app with `CMD ["node", "."]`.
To pass environment variables when running the container:
  - Use `docker run --env-file .env ...`
  - Or pass specific vars: `docker run -e HOST=0.0.0.0 -e PORT=3000 ...`
  - Or bake defaults via `ENV` in a custom Dockerfile.

- Example docker run command:
`docker run -d --restart always -p 3000:3000 `
  -v "E:\.github\wplacer\data\users.json:/usr/src/app/users.json" `
  -v "E:\.github\wplacer\data\templates.json:/usr/src/app/templates.json" `
  -v "E:\.github\wplacer\data\settings.json:/usr/src/app/settings.json" `
  --name wplacer luluwaffless/wplacer`
Note: HOST and PORT can be omitted if you passed them in the .env file or the Dockerfile.

### To-dos ✅
- [ ] **Proxy support**
- [ ] **Auto-farm EXP and droplets function for users**
- [x] ~~Add support for paid colors~~
- [x] ~~Support for painting between multiple tiles~~
- [x] ~~Easier multi-account support for one template~~
- [x] ~~Queueing system for multi-accounts~~
- [x] ~~Docker support~~

### Credits 🙏

-   [luluwaffless](https://github.com/luluwaffless)
-   [Jinx](https://github.com/JinxTheCatto)

And to our amazing contributors!
<p align="center"><img src="https://contrib.rocks/image?repo=luluwaffless/wplacer"></p>

### License 📜

[GNU AGPL v3](LICENSE)



