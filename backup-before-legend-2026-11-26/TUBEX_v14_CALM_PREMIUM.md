# TubeX v14 — Histórico corrigido, insights do owner, chat real e visual premium

## 1. Bug dos gráficos que "zeravam" os dias anteriores
**Causa:** o Supabase devolve no máximo 1.000 linhas por consulta, mesmo com `.limit(20000)`.
A rota de Analytics pedia os eventos do mais recente para o mais antigo, então só os eventos
de hoje chegavam e os dias anteriores apareciam com zero. Os dados nunca foram apagados.
Instalações apareciam porque vêm de outra tabela, menor.

**Correção:** `lib/tubex-paged.ts` busca todas as páginas (em paralelo) em
`/api/admin/analytics` e `/api/admin/ai-analytics`. Também pagina `users` e `tubex_installations`.
Nenhuma migration SQL é necessária. O histórico volta assim que publicar.

## 2. Insights do owner (`components/admin-insights.tsx`)
- KPIs com variação vs. período anterior (contas ativas, instalações, logins, pesquisas)
- "O que está acontecendo": alertas automáticos (retenção, conversão, módulos em alta/queda, horário de pico)
- Funil instalação → conta → uso, engajamento (média diária, últimos 7 dias, stickiness, retenção)
- Uso por hora e dia da semana, tendência por módulo, contas em risco (assinantes primeiro)
- "Contas com login" por dia agora conta contas únicas (antes contava eventos)

## 3. Chat TubeX AI
Resposta aparece digitando, botão Parar, Copiar, Gerar novamente, Tentar novamente em erro,
campo que cresce, Enter envia, rolagem inteligente com botão "ir para o fim", blocos de código e links,
apagar conversa, histórico em gaveta no celular, painel do canal como gaveta em telas menores.

## 4. Visual
Camada final "v14 Calm Premium" no fim de `app/globals.css`: paleta neutra (grafite/branco),
superfícies sólidas sem vidro/gradiente, textos mínimos de 11–13px, ajustes para celular.

## Publicar
Substitua os arquivos e faça o deploy. Nada para rodar no Supabase.
