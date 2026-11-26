# TubeX Creator Achievements — implantação

## O que foi adicionado
- Aba **Conquistas** no dashboard atual.
- Catálogo inicial de marcos públicos: inscritos, visualizações acumuladas e quantidade de vídeos.
- Sincronização autenticada com YouTube Data API (`youtube.readonly`).
- Histórico diário próprio, progresso, medalhas e pontos.
- Metas personalizadas por inscritos, visualizações e quantidade de vídeos.
- Comparação por faixa usando amostra de canais públicos presentes em `tubex_channel_view_snapshots`.
- E-mail imediato para marcos importantes e resumo semanal das novas conquistas usando Resend.
- Preferências de e-mail na própria tela.

## Antes do deploy
1. Execute `supabase/migrations/20261125_tubex_creator_achievements.sql` no SQL Editor do projeto Supabase usado pelo Workspace.
2. Configure no projeto Vercel do Workspace:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (remetente/domínio verificado no Resend)
   - `NEXT_PUBLIC_APP_URL=https://tubexai.com.br` (ou o domínio oficial real do Workspace)
   - `CRON_SECRET` (segredo forte e privado)
3. Faça deploy do Workspace. O `vercel.json` agenda o resumo semanal para segunda-feira às 11:00 UTC (08:00 no horário de Brasília).
4. Na Vercel, confirme que o projeto tem Cron Jobs habilitado no plano contratado.
5. O usuário deve conectar/autorizar sua conta Google com o escopo `youtube.readonly` e clicar em **Atualizar meu canal**. Se a sessão já tiver `provider_token`, a tela tenta sincronizar ao abrir.

## Backend da extensão
Nenhum arquivo do ZIP `backend.zip` foi alterado nesta entrega. O backend já contém coleta pública diária em `tubex-channel-history-cron.js` / `youtube-channel.js`; o novo módulo usa o histórico público existente como amostra opcional de comparação e faz a sincronização do canal próprio pelo token Google autorizado do usuário, no Workspace.

## Limites conhecidos desta primeira entrega
- O catálogo inicial usa métricas públicas da YouTube Data API. CTR, retenção, horas assistidas e receita não são concedidos nem estimados: exigem consulta específica à YouTube Analytics API e permissões adequadas.
- A comparação por faixa é uma amostra de canais públicos acompanhados pelo TubeX, não representa todos os canais do YouTube. O percentil só aparece com pelo menos 10 canais na mesma faixa.
- A atualização de métricas próprias ocorre quando o criador abre o módulo com autorização válida ou clica em **Atualizar meu canal**. Não armazenamos refresh tokens Google no servidor nesta versão; portanto, não há coleta privada autônoma em background.
- O resumo semanal envia apenas quando há conquistas novas na fila. Não envia mensagens vazias.
- O envio semanal depende do Vercel Cron e de `CRON_SECRET`, `RESEND_API_KEY` e `RESEND_FROM_EMAIL` válidos.
- O código foi preparado para integração com a estrutura recebida, mas deve passar por build/teste no ambiente Vercel e por teste real com Supabase, YouTube e Resend antes de ser considerado produção validada.
