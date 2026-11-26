# TubeX Workspace v13 — Analytics histórico corrigido

## O que mudou
- Nova rota protegida `app/api/admin/analytics/route.ts`, agregando `tubex_events` e `tubex_installations`.
- Gráfico diário agora recebe uma série contínua com todos os dias do período (inclusive dias sem atividade = zero), usando fuso `America/Sao_Paulo`.
- Atividade por conta/módulo é agrupada por dia e identidade (`user_id`, com fallback para `install_id`).
- Ranking mensal usa o mês selecionado independentemente do período do gráfico.
- Lista de instalações mostra timestamp completo já fornecido pela tabela.
- Tela de comportamento explica que status de uso (Ativo/Em risco/Inativo) é independente da propensão de compra (Quente/Morno/Frio).
- A coluna de último uso exibe data e hora quando `lastActivityAt` existe; não inventa horário para registros sem timestamp.
- Migration adiciona índices auxiliares para consultas históricas.

## Publicação
1. Faça backup do projeto atual.
2. Substitua o código do projeto web pelo conteúdo de `TubeXPagina`.
3. Execute no Supabase SQL Editor:
   `supabase/migrations/20261125_tubex_admin_analytics_history.sql`
4. Faça deploy do projeto web.
5. Abra TubeX Analytics, selecione 30 dias e clique Atualizar.

## Limitações dos dados
- Eventos anteriores à instrumentação não podem ser recriados retroativamente.
- A nova rota agrega o que já está gravado em `tubex_events` e `tubex_installations`.
- Este ZIP não contém a implementação da rota `/api/admin/behavior` nem o backend separado que fornece os campos de comportamento/assinatura. Portanto, o painel de comportamento recebe apenas melhorias de apresentação; a divergência de “0 ações” nessa tela exige o código dessa rota para reconciliar sua fonte com `tubex_events`.
- O endpoint limita a leitura a 20.000 eventos por resposta e 5.000 instalações. Se o volume ultrapassar isso, a consulta deve ser paginada antes de escalar.
- O total de assinaturas usa os planos registrados na tabela `users`; se a tabela não for sincronizada imediatamente pelo provedor de cobrança, esse cartão pode atrasar. Não substitui o estado atual validado no Stripe.


## Ajustes complementares — comportamento e consistência das métricas

- Adicionada a rota `/api/admin/behavior`, que estava ausente do pacote do Workspace, usando autenticação de proprietário e leitura de usuários, Auth, eventos, instalações e histórico de afiliados/vendas.
- A coluna de último uso agora apresenta tempo decorrido em horas quando a atividade ocorreu há menos de 24 horas, além da data/hora exata em `America/Sao_Paulo`.
- Status de atividade separado da intenção de compra: Ativo = evento de recurso nos últimos 7 dias; Em risco = 8 a 30 dias; Inativo = mais de 30 dias; pagamento `past_due` e cancelamento mantêm precedência. Contas sem eventos de recurso usam login/sincronização como fallback, identificados no motivo.
- Pontuação Quente/Morno/Frio não é calculada para assinantes atuais. Para contas sem assinatura, continua sendo uma estimativa de intenção comercial, separada do status de atividade.
- Datas de atividade são agrupadas por dia de São Paulo, não pelo recorte UTC do timestamp.
- Analytics normaliza eventos do site e da extensão para a mesma conta quando consegue vincular `user_id`, `install_id`, `web-<user_id>` ou e-mail conhecido, evitando contar a mesma pessoa como duas contas em gráficos e rankings.
- Os gráficos diários exibem também os dias de pico de instalações, pesquisas/análises, logins e contas com uso.
- Adicionado índice por `user_id, created_at` para acelerar consultas do histórico.

**Limite histórico:** nenhum código consegue reconstruir eventos que nunca foram gravados em `tubex_events`. Dias sem telemetria anterior à implantação permanecem como zero; os registros existentes são preservados e não são artificialmente preenchidos.
