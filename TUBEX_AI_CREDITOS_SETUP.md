# TubeX AI — limites por plano e pacotes de créditos avulsos

## Como funciona
- Cada plano tem uma **franquia mensal** de créditos, que renova todo dia 1 (UTC):
  Free 150 · Start 600 · Pro 2.000 · Expert 6.000 (Membro antigo 1.000; Admin 100.000).
- Custo por ação: chat rápido 1 · análise profunda 3 · títulos 3 · descrição 1 · roteiro 5 · thumbnail 22.
- **Pacotes avulsos** (compra única, não é assinatura) somam um saldo que **não expira**.
  O consumo usa primeiro a franquia do mês e depois o saldo de pacotes.
- Quando acaba tudo, o chat mostra os pacotes e o upgrade de plano. O selo de créditos
  no topo do chat também abre a loja a qualquer momento.

| Pacote | Créditos | Preço | Por crédito |
|---|---|---|---|
| Essencial | 300 | R$ 9,90 | R$ 0,033 |
| Criador | 1.000 | R$ 24,90 | R$ 0,025 |
| Estúdio | 3.000 | R$ 59,90 | R$ 0,020 |

Comparação: Pro = R$ 0,015/crédito, Expert = R$ 0,008/crédito. O pacote é sempre mais caro
por crédito, então para quem usa muito o upgrade continua valendo mais.
Para mudar preços/quantidades: `lib/tubex-ai-packs.ts`.

## O que fazer (uma vez)
1. **Supabase**: SQL Editor > New query > cole `supabase/migrations/20261126_tubex_ai_credit_packs.sql` > Run.
   (Antes disso o site continua funcionando só com a franquia do plano.)
2. **Stripe > Developers > Webhooks** > seu endpoint `https://tubex.app.br/api/stripe-webhook`
   > Select events > adicione `checkout.session.async_payment_succeeded`
   (o `checkout.session.completed` já existe). Necessário para Pix/boleto.
3. Deploy (commit + push).

## Price IDs na Stripe: opcional
Não é preciso criar nada: o checkout cria o preço na hora com o valor do catálogo.
Se quiser ver os pacotes como produtos no painel da Stripe:
1. Stripe > Product catalog > Add product > "TubeX AI · Pacote Essencial" > One-off > R$ 9,90 BRL. Repita para 1.000 (R$ 24,90) e 3.000 (R$ 59,90).
2. Copie cada `price_...` e cadastre na Vercel (Settings > Environment Variables, Production):
   `STRIPE_PRICE_AI_PACK_300`, `STRIPE_PRICE_AI_PACK_1000`, `STRIPE_PRICE_AI_PACK_3000`. Redeploy.
3. O valor na Stripe precisa ser igual ao de `lib/tubex-ai-packs.ts` (o webhook avisa no log se não for).

## Segurança
- Créditos só entram pelo webhook, depois que a Stripe confirma o pagamento.
- Idempotente: cada Checkout Session é gravada uma única vez (`tubex_ai_credit_purchases`).
- O pacote nunca altera plano/assinatura do usuário.

## Testar
Stripe em modo teste > comprar um pacote no chat com o cartão 4242 4242 4242 4242 > voltar ao
dashboard > o saldo de "Pacotes" aparece no selo e na loja. No Supabase:
`select * from tubex_ai_credit_purchases order by created_at desc;`
