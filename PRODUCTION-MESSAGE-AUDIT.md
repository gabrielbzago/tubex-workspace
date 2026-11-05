# TubeX — Auditoria de mensagens para produção

## Mensagens comerciais e travas

- Free: mantém 5 análises diárias, pontuação principal e amostra de 5 vídeos. Ao atingir a cota ou acessar Google Trends/geração de ideias, recebe oferta Pro com benefícios e CTA.
- Pro: mantém até 50 análises diárias, Google Trends e amostra de até 20 vídeos. Ao atingir a cota ou tentar acessar a lista completa de concorrentes, recebe oferta Expert.
- Expert: pesquisas ilimitadas, lista completa de concorrentes e sem mensagens de upgrade.
- Os módulos Keyword Explorer e Workspace SEO usam o mesmo componente de oferta, os mesmos preços e os mesmos links de checkout.

## Mensagens operacionais

- Erros de API, backend, HTTP, Stripe/Google e detalhes de configuração não são apresentados ao usuário final nas telas de pesquisa.
- Falhas de pesquisa e indisponibilidade temporária recebem mensagens curtas, claras e orientadas à continuidade do uso.
- A limitação temporária do Google Trends (HTTP 429) não interrompe a análise de palavras-chave e não expõe HTML ou resposta técnica do provedor.
- Falhas na pesquisa não consomem a cota diária: a reserva é estornada se a análise falhar ou não retornar resultados.

## Requisitos antes da publicação

1. Executar `supabase/migrations/20261105_tubex_keyword_usage.sql` no SQL Editor do Supabase.
2. Confirmar que as contas de teste estão com `users.plan` preenchido como `free`, `pro` ou `expert`.
3. Confirmar que os dois Payment Links Stripe correspondem aos preços exibidos: Pro R$ 29,99/mês e Expert R$ 49,99/mês.
4. Testar com uma conta Free, uma Pro e uma Expert, incluindo esgotamento da cota e tentativa de abrir recursos bloqueados.
5. Instalar dependências e executar `npm run typecheck` e `npm run build` antes do deploy.

## Observação de validação

A revisão estática de mensagens e sintaxe foi realizada. O build completo não foi executado porque este ambiente de edição não contém `node_modules`; a validação final de compilação deve ocorrer após `npm install` no ambiente do projeto.


## Gerador de palavras-chave do Creator Workspace

- A detecção de nicho considera nome/descrição do canal e padrões recorrentes em até 50 títulos recentes; um título isolado não define o nicho.
- O gerador possui dois modos: palavras-chave do nicho e palavras-chave do título.
- A pesquisa usa o mesmo modo `tag_suggestions` do backend consumido pelo TubeX Analyzer, combinando tags públicas de vídeos relevantes e autocomplete do YouTube; não utiliza IA.
- Free: três sugestões utilizáveis e prévia limitada das demais; Pro e Expert: lista completa de até 120 sugestões.
- Cada geração utiliza a cota diária do plano. Falhas ou pesquisas sem resultados estornam a reserva.
- As palavras-chave podem ser copiadas individualmente ou em conjunto.


## Dashboard principal e responsividade mobile (05/11/2026)

- O login agora abre diretamente em Visão Geral (`dashboard`).
- A navegação prioriza Visão Geral, seguida dos espaços web complementares.
- Visão Geral apresenta um alerta de destaque informando que a extensão TubeX é a ferramenta principal de uso no YouTube, com link oficial da Chrome Web Store e instruções rápidas de instalação/fixação.
- O painel web é descrito como complemento para análise, planejamento e gestão da conta.
- Menu mobile em duas colunas, com altura limitada e rolagem própria; conteúdo com largura fluida, controles adaptados e proteção contra overflow horizontal.
- Campos de seleção e botões que tinham largura mínima fixa passam a ocupar 100% da tela em smartphones.
