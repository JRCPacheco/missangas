# Missangas Jane ✨

Um aplicativo Web Progressivo (PWA) simples e elegante para criação e edição de padrões de missangas. Focado em tablet, celular e desktop, o app permite desenhar moldes de missangas em uma grade personalizável, simular paletas de cores e aplicar ferramentas de espelhamento e preenchimento.

## Funcionalidades

- **Desenho Livre:** Ferramentas de Lápis, Borracha e Balde de Tinta.
- **Formas Básicas:** Desenho facilitado de Linhas Retas, Quadrados e Círculos.
- **Importação de Imagens:** Transforme fotos do seu dispositivo em padrões de missangas automaticamente! O algoritmo "pixela" a imagem mapeando-a para a paleta de cores disponível.
- **Transformações:** Espelhamento horizontal e rotação do tapete (90° horário/anti-horário).
- **Personalização de Tapete:** Controle exato sobre o número de linhas e colunas, além do nível de zoom das células.
- **Histórico (Undo/Redo):** Sistema rápido para desfazer ou refazer ações.
- **Exportação:** Salve seu molde final em PDF (Imagem renderizada) ou imprima perfeitamente em A4.
- **Armazenamento Seguro:** Salvamento automático local (LocalStorage/IndexedDB). Se fechar o app, você não perde o padrão em progresso!

## Stack Tecnológica

O Missangas Jane foi construído visando leveza, compatibilidade e performance nativa, sem sobrecargas de frameworks complexos.

- **Frontend:** HTML5, CSS3, JavaScript Vanilla (ES6+)
- **Ícones:** [Lucide Icons](https://lucide.dev/)
- **Exportação:** [jsPDF](https://parall.ax/products/jspdf) e [html2canvas](https://html2canvas.hertzen.com/)

## Como rodar localmente

Este projeto não requer servidor avançado ou Node.js (via NPM/Vite) para rodar o básico.

1. Clone o repositório ou baixe os arquivos.
2. Abra o arquivo `index.html` em qualquer navegador web moderno (Chrome, Edge, Firefox, Safari).
3. (Opcional) Para uma experiência completa de PWA e Service Workers, sirva o diretório através de um servidor local simples:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve .`

## Contribuindo

Trata-se de um projeto aberto para geradores de moldes e artistas manuais. Idéias para novas paletas (ex: cores reais das marcas Miyuki/Toho) ou novas mecânicas de exportação são bem-vindas!
