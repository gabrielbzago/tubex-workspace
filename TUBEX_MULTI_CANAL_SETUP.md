# TubeX: vários canais por conta Google (2026-11-27)

Um e-mail Google pode ter vários canais (pessoal + contas de marca). Agora o site guarda um token por
canal e carrega sempre o **canal ativo**, escolhido no seletor do topo do dashboard.

## O que configurar (uma vez)
1. Supabase > SQL Editor: rode `supabase/migrations/20261127_tubex_google_channels.sql`.
2. Google Cloud > APIs e serviços > Credenciais > cliente OAuth (o mesmo do provedor Google do Supabase) >
   **URIs de redirecionamento autorizados**: adicione `https://SEU-DOMINIO/api/youtube/oauth/callback`
   (e `http://localhost:3000/api/youtube/oauth/callback` para testes).
3. Vercel: `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` já usados pelo refresh do token. Opcional:
   `TUBEX_OAUTH_ORIGIN=https://SEU-DOMINIO` se o domínio público for diferente do host da requisição.

## Como funciona
- Login Google (Supabase): o servidor descobre o canal escolhido na tela do Google (channels.list mine=true
  com o token desse login), salva o refresh token dele e o torna ativo.
- "Adicionar outro canal" (seletor no topo): fluxo OAuth próprio (`/api/youtube/oauth/start` → Google →
  `/api/youtube/oauth/callback`). A pessoa continua logada na MESMA conta TubeX; só o canal é adicionado.
- Trocar de canal: `/api/youtube/channels` (activate/remove). Todas as telas recarregam com o canal novo.
- Owner: continua ligado ao usuário/e-mail (lib/tubex-owner.ts). Se alguém entrar direto com uma conta de
  marca e o Supabase criar outra conta, ela vira owner se o consentimento veio de um e-mail owner ou se o
  mesmo canal está conectado à conta do owner.
