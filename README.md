<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-green"></a><//p>

A massively updated auto-drawing bot for [wplace.live](https://wplace.live/).

## Features ✅

-   **Simple and easy-to-use web UI:** For managing users and templates
-   **Advanced Multi-Account System:** Run templates with multiple users simultaneously. The system intelligently prioritizes users with the most charges available to maximize efficiency.
-   **Multiple Drawing Modes:** Choose from several drawing strategies (Top to Bottom, Bottom to Top, Random Color, etc.) to optimize your approach for different templates.
-   **Automatic Upgrade Purchasing:** If enabled, the bot will automatically purchase max charge upgrades or extra charges when running out for your accounts whenever they have enough droplets.
-   **Account Status Checker:** A tool in the "Manage Users" tab allows you to quickly check if your accounts' cookies are still valid.
-   **Advanced Template Controls:** Options such as restarting, replacing a template's image, or pausing on the fly make management more flexible as well as providing you with real time updates on the template's status.
-   **Automatic Captcha (Turnstile) Token Handling:** Turnstile handling lets you babysit the bot much less
-   **Desktop Notifications:** The program will now send a desktop notification when it needs a new Turnstile token, so you don't have to constantly check the console.

## Installation and Usage 💻
### Requirements:
- [Node.js and NPM](https://nodejs.org/en/download)
- [Tampermonkey](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (optional, but recommended)
### Installation:
1. [Install the userscript to manually solve Turnstiles (CAPTCHAs)](https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/wplacer.user.js)
2. Download the repository using [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) or download the ZIP directly from GitHub.
3. In the terminal, navigate to the project directory and install the dependencies with `npm i`.
- If you'd like, you can change the host and port of the local server by creating a `.env` file.
### Usage:
1. To start the bot, run `npm start` in the terminal.
2. Open the URL printed in the console (usually `http://127.0.0.1/`) in your browser.
3. Navigate to the "Manage Users" page to add your accounts.
   - In [wplace.live](https://wplace.live/), open DevTools (F12 or Inspect), go to `Application > Cookies`, and copy the values of the cookies named `s` and `j`. Only older accounts have the `s` cookie, so you can often skip it.
   - Paste the cookie values into the "Add User" form.
4. Go to the "Add Template" page to create your drawing templates.
   - The coordinates (`Tile X/Y`, `Pixel X/Y`) are for the top-left corner of your image. You can find these by clicking a pixel on wplace.live and inspecting the `pixel` request in the Network tab of DevTools.
   - You can assign multiple users to a single template.
5. Finally, go to "Manage Templates" and click "Start" on any template to begin drawing.
   - The script will occasionally notify you to paint a pixel on [wplace.live](https://wplace.live/). This is required to refresh the Turnstile token needed for painting.

## Notes 📝

> [!CAUTION]
> This bot is not affiliated with [wplace.live](https://wplace.live/) and its use may be against the site's rules. The developers are not responsible for any punishments against your accounts. Use at your own risk.

## Authors 🙏

-   [luluwaffless](https://github.com/luluwaffless)
-   [Jinx](https://github.com/JinxTheCatto)

### License 📜

[GNU AGPL v3](LICENSE)