# TubeX — Solicitações de cancelamento

## O que foi implementado

- Formulário autenticado na área **Assinatura** do dashboard.
- Motivo principal obrigatório; comentários, sugestão de melhoria e intenção de retorno opcionais.
- Registro de respostas e histórico em `public.cancellation_requests`.
- Ao enviar, a API agenda a não renovação no Stripe com `cancel_at_period_end=true`.
- O plano e o acesso não são rebaixados no momento da solicitação.
- O webhook só marca a solicitação como `completed` e o usuário como Free quando o Stripe envia `customer.subscription.deleted`.
- Área administrativa **Cancelamentos**, visível apenas ao owner, com filtros e histórico.
- Notificação por e-mail ao owner e ao assinante usando Resend.

## Passo 1 — Supabase

No SQL Editor do projeto Supabase usado pelo TubeX, execute o conteúdo de:

`supabase/migrations/20261124_cancellation_requests.sql`

A tabela é privada: o navegador não recebe permissão direta. As rotas do Next.js usam `SUPABASE_SERVICE_ROLE_KEY` no servidor.

## Passo 2 — Vercel (projeto TubeXPagina / site)

Configure estas variáveis em Production:

- `RESEND_API_KEY`: chave da API do Resend.
- `RESEND_FROM_EMAIL`: remetente verificado no Resend, por exemplo `TubeX <nao-responda@seudominio.com>`.
- `CANCELLATION_NOTIFICATION_EMAIL`: endereço que receberá os pedidos (padrão recomendado: `gabrielbzago@gmail.com`).

As variáveis já existentes `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` também precisam estar configuradas.

Depois de configurar, faça redeploy do projeto do site.

## Passo 3 — Resend

Verifique o domínio remetente no Resend e use esse endereço em `RESEND_FROM_EMAIL`. Sem a chave e o remetente, o registro e o agendamento no Stripe ainda são feitos, mas os e-mails não serão enviados; a API registra esse resultado no banco.

## Comportamento

O cancelamento é agendado imediatamente para o fim do período pago. O cliente continua com o plano atual até `period_end`. O webhook do Stripe confirma a conclusão no fim do período.

## Eventos Stripe

Confirme que o webhook atual do site recebe `customer.subscription.deleted`. O handler já atualiza `users` para Free apenas nesse evento e agora também conclui o histórico da solicitação.

## Teste recomendado

1. Use uma conta de teste com assinatura Stripe ativa e `stripe_subscription_id` preenchido em `public.users`.
2. Envie uma solicitação com motivo obrigatório.
3. Confirme no Stripe que a assinatura ficou com `cancel_at_period_end=true`.
4. Confirme em `cancellation_requests` que o status ficou `scheduled` e `period_end` foi preenchido.
5. Confirme o recebimento dos dois e-mails.
6. Não espere o fim do período em produção para testar o webhook; use uma assinatura de teste separada.
