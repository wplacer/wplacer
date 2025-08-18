<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-gris?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="LEIAME.md"><img src="https://img.shields.io/badge/traduction-portugais_(brésil)-green"></a><//p>
<a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue"></a><//p>

Un bot de dessin automatique massivement mis à jour pour [wplace.live](https://wplace.live/).

## Fonctionnalités ✅

-   **Interface web simple et facile à utiliser :** Pour gérer les utilisateurs et les modèles
-   **Système multi-compte avancé :** Exécutez des modèles avec plusieurs utilisateurs simultanément. Le système priorise intelligemment les utilisateurs avec le plus de charges disponibles afin de maximiser l’efficacité.
-   **Modes de dessin multiples :** Choisissez parmi plusieurs stratégies de dessin (de haut en bas, de bas en haut, couleur aléatoire, etc.) pour optimiser votre approche selon les modèles.
-   **Achat automatique d’améliorations :** Si activé, le bot achètera automatiquement les améliorations de charges maximales ou des charges supplémentaires lorsque vos comptes en manquent, dès qu’ils ont assez de gouttes.
-   **Vérificateur d’état des comptes :** Un outil dans l’onglet "Gérer les utilisateurs" permet de vérifier rapidement si les cookies de vos comptes sont encore valides.
-   **Contrôles avancés des modèles :** Options telles que redémarrer, remplacer l’image d’un modèle ou le mettre en pause à la volée, tout en vous donnant des mises à jour en temps réel sur l’état du modèle.
-   **Gestion automatique des jetons Captcha (Turnstile) :** Réduit le besoin de surveiller le bot en permanence.
-   **Notifications de bureau :** Le programme enverra une notification lorsque qu’un nouveau jeton Turnstile est nécessaire, évitant de devoir surveiller constamment la console.

## Installation et utilisation 💻
### Prérequis :
- [Node.js et NPM](https://nodejs.org/en/download)
- [Tampermonkey](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (optionnel mais recommandé)
### Installation :
1. [Installez le userscript pour résoudre manuellement les Turnstiles (CAPTCHAs)](https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/wplacer.user.js)
2. Téléchargez le dépôt via [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) ou téléchargez directement le ZIP depuis GitHub.
3. Dans le terminal, allez dans le répertoire du projet et installez les dépendances avec `npm i`.
- Vous pouvez changer l’hôte et le port du serveur local en créant un fichier `.env`.
### Utilisation :
1. Pour démarrer le bot, lancez `npm start` dans le terminal.
2. Ouvrez l’URL affichée dans la console (généralement `http://127.0.0.1/`) dans votre navigateur.
3. Allez sur la page "Gérer les utilisateurs" pour ajouter vos comptes.
   - Dans [wplace.live](https://wplace.live/), ouvrez DevTools (F12 ou Inspecter), allez dans `Application > Cookies` et copiez les valeurs des cookies nommés `s` et `j`. Seuls les anciens comptes ont le cookie `s`, vous pouvez donc souvent l’ignorer.
   - Collez les valeurs des cookies dans le formulaire "Ajouter un utilisateur".
4. Allez sur la page "Ajouter un modèle" pour créer vos modèles de dessin.
   - Les coordonnées (`Tile X/Y`, `Pixel X/Y`) correspondent au coin supérieur gauche de votre image. Vous pouvez les trouver en cliquant sur un pixel sur wplace.live et en inspectant la requête `pixel` dans l’onglet Réseau de DevTools. Vous pouvez aussi utiliser le userscript [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble) pour voir les coordonnées d’un pixel.
   - Vous pouvez assigner plusieurs utilisateurs à un seul modèle.
5. Enfin, allez sur "Gérer les modèles" et cliquez sur "Démarrer" sur n’importe quel modèle pour commencer à dessiner.
   - Le script vous demandera parfois de peindre un pixel sur [wplace.live](https://wplace.live/). Cela est nécessaire pour rafraîchir le jeton Turnstile utilisé pour peindre.

## Remarques 📝

> [!ATTENTION]
> Ce bot n’est pas affilié à [wplace.live](https://wplace.live/) et son utilisation peut être contraire aux règles du site. Les développeurs ne sont pas responsables des sanctions appliquées à vos comptes. Utilisez-le à vos risques et périls.

## Auteurs 🙏

-   [luluwaffless](https://github.com/luluwaffless)
-   [Jinx](https://github.com/JinxTheCatto)

### Licence 📜

[GNU AGPL v3](LICENSE)
