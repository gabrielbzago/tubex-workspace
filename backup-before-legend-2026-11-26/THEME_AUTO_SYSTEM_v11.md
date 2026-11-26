# TubeX — tema automático do sistema

## Comportamento
- O padrão para novas sessões é `system` (respeita `prefers-color-scheme`).
- A preferência é resolvida antes do primeiro paint para reduzir flash de tema incorreto.
- O seletor no topo percorre: Automático → Escuro → Claro → Automático.
- A escolha manual é salva em `localStorage` (`tubex-theme`).
- No modo Automático, mudanças no tema do sistema são aplicadas sem recarregar a página.
- Os tokens globais e os principais painéis do dashboard, TubeX AI, gráficos, formulários e páginas legais recebem variantes claras e escuras.

## Verificação
- `components/theme-toggle.tsx` e `app/layout.tsx`: sintaxe TypeScript/JSX verificada.
- `app/globals.css`: parse PostCSS verificado.
- Build completo Next.js não foi executado porque este pacote de trabalho não contém `node_modules`.
