<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Suporte-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="README.md"><img src="https://img.shields.io/badge/translation-english-red"></a>
<a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue"></a></p>

Um bot de desenho automático para [wplace.live](https://wplace.live/)

## Funcionalidades ✅

-   **Interface Web simples e fácil de usar:** Para gerenciar usuários e modelos
-   **Sistema avançado de múltiplas contas:** Execute modelos com vários usuários simultaneamente. O sistema prioriza inteligentemente os usuários com mais cargas disponíveis para maximizar a eficiência.
-   **Múltiplos modos de desenho:** Escolha entre várias estratégias (de cima para baixo, de baixo para cima, cor aleatória etc.) para otimizar sua abordagem em diferentes modelos.
-   **Compra automática de upgrades:** Se habilitado, o bot comprará automaticamente upgrades de carga máxima ou cargas extras sempre que suas contas tiverem gotas suficientes.
-   **Verificador de status das contas:** Uma ferramenta na aba "Gerenciar Usuários" permite verificar rapidamente se os cookies das suas contas ainda são válidos.
-   **Controles avançados de modelos:** Opções como reiniciar, substituir a imagem de um modelo ou pausar em tempo real tornam o gerenciamento mais flexível, além de fornecer atualizações instantâneas sobre o status dos modelos.
-   **Gerenciamento automático de tokens de Captcha (Turnstile):** O manuseio de Turnstile reduz bastante a necessidade de monitorar o bot.
-   **Notificações na área de trabalho:** O programa envia uma notificação quando precisar de um novo token do Turnstile, assim você não precisa ficar verificando o console.

## Instalação e Uso 💻
[Tutorial em Vídeo](https://www.youtube.com/watch?v=YR978U84LSY)
### Requisitos:
- [Node.js e NPM](https://nodejs.org/pt-br/download)
- [Tampermonkey](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (opcional, mas recomendado)
### Instalação:
1. [Instale o userscript para resolver manualmente Turnstiles (CAPTCHAs)](https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/wplacer.user.js)
2. Baixe o repositório usando [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) ou baixe o ZIP diretamente do GitHub (não recomendado).
3. No terminal, instale as dependências com `npm i`
- Se desejar, você pode alterar o host (somente host local ou todas as interfaces) e a port do servidor local em `.env`
### Uso:
1. Para iniciar o bot, basta usar `npm start`
2. Após iniciar o bot, abra a URL que aparecer no seu navegador.
3. Você pode adicionar quantos usuários quiser.
   - No [wplace.live](https://wplace.live/), abra o DevTools (Inspecionar elemento), vá em Aplicativo > Cookies e copie os valores dos cookies chamados `s` e `j` (se não aparecerem, tente clicar/pintar um pixel para gerar uma requisição ao backend) (apenas contas antigas possuem o cookie `s`, então você pode pular ele).
   - Cole-os nos campos correspondentes no formulário "Adicionar Usuário".
4. Após adicionar os usuários desejados, vá em "Adicionar Modelo" e preencha o formulário para todos os usuários que deseja usar.
   - As coordenadas são para o canto superior esquerdo da sua imagem. Recomendo usar o [BlueMarble](https://github.com/SwingTheVine/Wplace-BlueMarble) para obtê-las; as coordenadas aparecerão automaticamente ao clicar em um pixel. Alternativamente, você pode ir na aba Network do DevTools, clicar em qualquer pixel e procurar por uma requisição GET para `https://backend.wplace.live/s0/pixel/{TX}/{TY}?x={PX}&y={PY}`.
   - Cada usuário só pode trabalhar em um modelo por vez.
5. Por fim, vá em "Gerenciar Modelos" e clique em "Iniciar Todos os Modelos" para começar a desenhar.
   - O script ocasionalmente pedirá que você pinte um pixel no [wplace.live](https://wplace.live/). Isso é necessário para obter o token Turnstile usado para pintar pixels.

## Notas 📝

> [!CAUTION]
> Este bot não é afiliado ao [wplace.live](https://wplace.live/) e vai contra as regras do site. Não me responsabilizo por qualquer tipo de punição contra suas contas.

### Lista de Tarefas ✅
- [ ] **Função de farm automático de EXP e gotas para usuários**
- [ ] **Suporte para proxy**
- [x] ~~Adicionar suporte para cores pagas~~
- [x] ~~Suporte para pintura entre múltiplas telhas~~
- [x] ~~Sistema de fila para múltiplas contas~~
- [x] ~~Suporte mais fácil para múltiplas contas em um único modelo~~

### Licença 📜

[GNU AGPL v3](LICENSE)
