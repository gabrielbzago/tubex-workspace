# TubeX — Ativação do programa de afiliados

## O que esta versão implementa
- Links rastreáveis no domínio canônico `https://www.tubexai.com.br/r/CODIGO`.
- Contagem de visitantes únicos por afiliado/dia, sem armazenar IP em texto puro.
- Atribuição first-touch por até 90 dias no navegador e persistência em `users.referred_by` após autenticação.
- Preservação do código em Payment Links Stripe usados na landing, no painel, nos upgrades do Workspace SEO e nos checkouts da extensão.
- Geração de link da extensão com validação do e-mail Google autenticado; a extensão não cria mais links com e-mail em Base64.
- A extensão transmite ao Stripe o código de quem indicou o usuário (`referred_by`), nunca o código próprio do comprador.
- Recuperação do código persistido no perfil no checkout e no webhook, inclusive quando o checkout não envia `client_reference_id`.
- Comissão recorrente de 20%, com idempotência por invoice e atualização transacional do saldo.
- Baixa de pagamentos com histórico em `affiliate_payouts`.
- Estorno proporcional de reembolsos e estorno do saldo de comissão em chargebacks; se a comissão já foi paga, o saldo pode ficar negativo e será compensado pelas próximas comissões.

## Passo obrigatório no Supabase
1. Abra **Supabase → SQL Editor → New query**.
2. Abra e copie todo o conteúdo de `supabase/migrations/20261114_affiliate_program_hardening.sql`.
3. Execute uma única vez. A migration usa `IF NOT EXISTS` e preserva registros e saldos existentes.
4. Se o SQL apontar duplicidade nos índices únicos de códigos ou subscriptions, pare e envie o erro antes de apagar ou alterar registros.

## Variáveis Vercel
- `NEXT_PUBLIC_APP_URL=https://www.tubexai.com.br`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AFFILIATE_CLICK_SALT` (opcional; se ausente, a aplicação usa a chave de serviço como segredo de hash)

Faça redeploy do projeto web depois de atualizar os arquivos e confirme que o endpoint Stripe aponta para `/api/stripe-webhook`.

## Eventos Stripe recomendados
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_succeeded` (compatibilidade; idempotência evita comissão duplicada)
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `refund.created`
- `charge.dispute.created`
- `charge.dispute.funds_withdrawn`
- `charge.dispute.closed`

## Teste controlado
1. Crie/tenha um usuário afiliado e gere o código.
2. Abra `/r/CODIGO` em janela anônima; confira clique no painel do afiliado.
3. Crie uma conta de teste com outro e-mail, faça login no dashboard e confirme `users.referred_by`.
4. Use Stripe em modo de teste e confirme que a sessão/assinatura recebe `affiliate_code`.
5. Envie eventos de teste ou faça pagamentos reais de baixo valor só depois de validar os IDs/preços.
6. Confira uma única venda por invoice, a comissão de 20%, uma renovação, um reembolso parcial, um reembolso total, um chargeback e a baixa administrativa.

**Limites:** não há pagamento automático via PIX nem conexão com Stripe Connect. O botão administrativo registra uma baixa manual depois que o pagamento PIX foi realizado fora do sistema. A atribuição first-touch só é persistida quando a pessoa chega ao site e autentica uma conta TubeX; links de afiliado abertos exclusivamente dentro de fluxos externos sem esse passo dependem de `client_reference_id` do Payment Link.
