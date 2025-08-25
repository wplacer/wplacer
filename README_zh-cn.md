<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="README.md"><img src="https://img.shields.io/badge/translation-english-red"></a>
<a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-green"></a>
<a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue"></a></p>

针对[wplace.live](https://wplace.live/)的自动绘图机器人。

## 主要功能 ✅

-   **简单易用的网页界面：**用于管理用户和模板
-   **高级多账户系统：**支持多个用户同时运行模板。系统会智能地优先处理可用费用最多的用户，以最大化效率。
-   **多种绘制模式：** 可从多种绘制策略（自上而下、自下而上、优先边缘、随机颜色等）中选择，以优化不同模板的绘制方式。
-   **自动升级购买：** 若启用该功能，当账户可用滴数充足时，机器人将自动为账户购买最大充能升级或额外充能。
-   **账户状态检查器：**在“管理用户”选项卡中，您可以快速检查账户的Cookie是否仍有效。
-   **高级模板控制：**提供重启、替换模板图片或实时暂停等选项，使管理更加灵活，并实时更新模板状态。
-   **自动验证码（Turnstile）令牌处理：**Turnstile处理功能可大幅减少您对机器人的监控需求。
-   **桌面通知：**当程序需要新的Turnstile令牌时，将发送桌面通知，您无需频繁查看控制台。


## 使用教程 💻

[视频教程（英文）](https://www.youtube.com/watch?v=YR978U84LSY)

### 运行依赖:
- [Node.js 和 NPM](https://nodejs.org/en/download)
- [Tampermonkey（油猴）](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (选用，但推荐)
### 安装:
1. 在每个浏览器窗口中安装该扩展程序，并使用您希望由wplacer使用的账户，以自动解决验证码（CAPTCHA）问题。具体操作步骤如下：进入浏览器的扩展程序页面，启用开发者模式，点击“加载未打包扩展”，然后选择随wplacer附带的LOAD_UNPACKED文件夹。
2. 使用 [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) 克隆仓库或直接从Github上下载 ZIP 压缩包 (不推荐).
3. 在终端中打开项目目录，并执行 `npm i` 以安装依赖。
- 可以通过修改文件夹根目录下的`.env`文件更改本地服务器的主机和端口。

### 使用方法:
1. 在终端中运行 `npm start` 以启动后端。
2. 打开在终端中展示的服务器地址（通常是 `http://127.0.0.1/`）
3. 在安装了扩展程序的每个浏览器窗口中，登录您的 wplace.live 账户。如果刷新后您的账户未在管理器中显示，您可以点击扩展程序手动将其发送至 wplacer。
4. 前往“添加模板”页面创建您的绘图模板。  
   - 坐标（`Tile X/Y`，`Pixel X/Y`）指的是图像的左上角位置。您可以通过在 wplace.live 上点击一个像素，并在开发者工具的“网络”选项卡中检查 `pixel` 请求来找到这些坐标。您还可以使用 [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble) （油猴用户脚本）来查看像素的坐标。  
   - 您可将多个用户分配到同一个模板。
5. 最后，转到“管理模板”并点击任何模板上的“开始”按钮以开始绘制。
   - 脚本会不时刷新 wplace.live（https://wplace.live/）上的一个活跃机器人窗口。这是为了刷新绘制所需的 Turnstile 令牌。

## 免责声明 📝

> [!CAUTION]
> 该机器人与[wplace.live](https://wplace.live/)无关，使用该机器人可能违反该网站的规则。开发者不对您账户可能受到的任何处罚负责。使用者需自行承担风险。

### 待办 ✅
- [x] ~~代理支持~~
- [x] ~~对付费颜色的支持~~
- [x] ~~对在多个画布之间绘画的支持~~
- [x] ~~更简便的单一模板多用户支持~~
- [x] ~~多账户队列系统~~
- [x] ~~Docker 支持~~

### 致谢 🙏

-   [luluwaffless](https://github.com/luluwaffless)
-   [Jinx](https://github.com/JinxTheCatto)

以及我们出色的贡献者们！
<p align="center"><img src="https://contrib.rocks/image?repo=luluwaffless/wplacer"></p>

### 许可协议 📜

[GNU AGPL v3](LICENSE)



