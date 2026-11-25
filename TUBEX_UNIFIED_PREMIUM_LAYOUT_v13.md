# TubeX v13 — Unified Premium Layout

## Objetivo
Unificar a experiência visual dos módulos principais com o padrão do menu lateral aprovado pelo usuário, sem alterar a navegação ou a lógica de negócio.

## Implementação
- Camada visual global em `app/globals.css`, aplicada a todos os módulos renderizados em `.tx-dashboard-content.is-page`.
- Superfícies translúcidas com blur moderado, bordas discretas, elevação e estados hover consistentes.
- Hierarquia tipográfica e espaçamento unificados para títulos, subtítulos, cards e indicadores.
- Azul/ciano para interação, navegação e dados informativos; verde para estados positivos; amarelo reservado a detalhes da marca e chamadas primárias.
- Campos, tabelas, tooltips e painéis de gráficos recebem o mesmo tratamento visual.
- Estados de medalhas/conquistas distinguem desbloqueado (verde) e bloqueado (neutro).
- Mantida a adaptação ao tema `system`, `light` e `dark` existente.
- Mantidas as regras responsivas existentes e acrescentado acabamento consistente em telas menores.

## Escopo
A camada é compartilhada por TubeX AI, Workspace SEO, Creator Workspace, Inteligência, Feed, Afiliados, Conquistas, Analytics, Comportamento do Assinante, Cancelamentos, Conta, Assinatura e Suporte.

## Observação de validação
A alteração foi aplicada ao CSS compartilhado. A instalação de dependências para executar `next build` não concluiu neste ambiente; portanto, o build de produção precisa ser validado no ambiente do projeto antes do deploy.
