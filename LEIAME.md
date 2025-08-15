<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Suporte-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="README.md"><img src="https://img.shields.io/badge/translation-english-red"></a></p>

Um bot de desenho automático para [wplace.live](https://wplace.live/)

## Recursos ✅

- Interface web simples e fácil de usar para gerenciar usuários e modelos
- Suporte para múltiplas contas de usuário
- Login automático e recuperação de informações do usuário
- Gerenciamento de modelos: adicionar, iniciar, pausar e remover
- Pinta pixels automaticamente de acordo com os modelos
- Compra automaticamente cargas de tinta (se ativado e possível)
- Lida com tokens de CAPTCHA (Turnstile) via userscript
- Atualizações de status em tempo real para cada usuário/modelo

## Instalação e Uso 💻
### Requisitos:
- [Node.js e NPM](https://nodejs.org/pt-br/download)
- [Tampermonkey](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (opcional)
### Instalação:
1. [Instale o userscript para resolver manualmente Turnstiles (CAPTCHAs)](https://raw.githubusercontent.com/luluwaffless/wplacer/refs/heads/main/public/wplacer.user.js)
2. Baixe o repositório usando [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`)
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
- [ ] Adicionar suporte para cores pagas
- [ ] Função de farm automático de EXP e gotas para usuários
- [ ] Suporte mais fácil para múltiplas contas em um único modelo
- [ ] Sistema de fila para múltiplas contas
- [ ] Suporte para proxy
- [ ] Suporte para pintura entre múltiplas telhas
- [ ] Resolução automática de Turnstile (se possível)

### Licença 📜

[GNU AGPL v3](LICENSE)
