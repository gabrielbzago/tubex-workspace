# TubeX Analytics — implantação e validação

## O que a telemetria registra
- Instalação/atualização e inicialização da extensão.
- Identificador aleatório da instalação e sessão.
- Início, sucesso e falha do login Google.
- Abertura do YouTube e módulos acessados.
- Envios de pesquisa e chamadas reais aos endpoints da API TubeX (sucesso/falha, rota, método, duração e status HTTP; nunca o texto pesquisado).
- Análises SEO concluídas/falhas.
- Limites gratuitos atingidos e apresentação de upgrade em fluxos instrumentados.
- Início do checkout e assinatura confirmada/cancelada via integração web/Stripe.

## Entrega resiliente
A extensão mantém uma fila limitada no `chrome.storage.local`, envia lotes de até 50 eventos e tenta novamente por `chrome.alarms` a cada minuto quando há falha/offline. A fila é removida somente após confirmação do backend. A tabela `public.tubex_events` não possui políticas de cliente; gravação e leitura são mediadas por rotas server-side com `SUPABASE_SERVICE_ROLE_KEY`.

## Implantação
1. Execute `web/supabase/migrations/20261114_tubex_analytics.sql` no SQL Editor do Supabase.
2. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL` e `NEXT_PUBLIC_APP_URL` no ambiente de produção. `OWNER_EMAIL` deve corresponder ao e-mail real autenticado no Supabase.
3. Publique a pasta `web` no projeto Vercel associado ao domínio `tubexai.com.br`, incluindo `/api/analytics/events`, `/api/admin/analytics`, `/api/create-checkout-session` e `/api/stripe-webhook`. A extensão envia os eventos para `https://tubexai.com.br/api/analytics/events`.
4. Carregue a pasta `TubeX` em `chrome://extensions` para teste e depois publique o pacote da extensão conforme o fluxo da Chrome Web Store.
5. No Chrome, abra o service worker da extensão e confirme que não há erros. Faça login, abra Keyword Explorer, execute uma pesquisa, conclua uma análise SEO e acione um limite de teste controlado.
6. Confirme os eventos em `public.tubex_events` e no menu `TubeX Analytics` do painel web.

## Analytics histórico — correção v4.3.6
- O painel considera os nomes de eventos realmente presentes na tabela: `search_submitted`, `analysis_completed`, `extension_updated`, `youtube_opened`, `ui_action` e `extension_action`, além dos eventos padronizados.
- Instalações históricas são identificadas pelo `install_id` persistente mesmo quando o evento `extension_installed` não foi enviado. No gráfico diário, a série representa instalações identificadas com atividade naquele dia, não novas instalações comprovadas.
- Logins só são contabilizados quando existe `login_success` com identidade; `youtube_opened` não é tratado como login.
- Assinaturas ativas são lidas de `public.users`, exigindo plano `start`, `pro` ou `expert`, `status = active` e `stripe_subscription_id` preenchido.
- Visualização de planos e início de checkout só são contabilizados quando seus eventos existem; não são inventados a partir de outros cliques.
- Não é necessário executar uma nova migration SQL para esta correção; ela altera as consultas e a apresentação do painel web.

## Limitações honestas
- Só é possível reconstruir o histórico que ainda existe em `public.tubex_events` e `public.users`. Eventos que nunca foram enviados ou que foram apagados não podem ser recuperados retroativamente.
- A extensão não consegue garantir um evento de desinstalação: o Chrome pode encerrar o service worker sem permitir uma chamada de rede confiável.
- Cliques e formulários são sinais de interação; eventos de conclusão são emitidos apenas nos fluxos explicitamente instrumentados ou quando uma chamada API TubeX permitida termina com sucesso.
- Alguns módulos que executem operações exclusivamente via APIs Google/YouTube ainda precisam de eventos explícitos no respectivo handler para contabilizar conclusão com precisão.
- O evento de assinatura é emitido pelo webhook Stripe após processamento de `checkout.session.completed`; pagamentos de outros provedores precisam de instrumentação equivalente no webhook deles.
- `install_id` é aleatório e não contém identidade pessoal. A associação com uma conta ocorre quando o backend consegue validar o token autenticado.


## Validação da rota de ingestão (v4.3.2)
- `GET https://tubexai.com.br/api/analytics/events` deve responder `service: tubex-analytics-ingestion`.
- `OPTIONS` deve responder HTTP 204 e permitir `POST`, `Authorization` e `Content-Type`.
- Após recarregar a extensão, o Service Worker deve enviar `POST` para o mesmo domínio.
- O POST deve responder `{ "success": true, "accepted": N }`.
- Só considerar a telemetria operacional depois de confirmar linhas novas em `public.tubex_events`.


CORRECAO v4.3.3: URL canonica de ingestao atualizada para https://www.tubexai.com.br/api/analytics/events para evitar redirecionamento HTTP 308 do dominio sem www.


CORREÇÃO v4.3.6 — Analytics histórico
- Corrigido o mapeamento de eventos históricos para pesquisas/análises.
- Instalações passam a usar o install_id persistente em vez de depender apenas de extension_installed.
- Logins continuam exigindo evento login_success; não são inferidos de abertura do YouTube.
- Assinaturas ativas são reconciliadas pela tabela users com plano pago, status active e stripe_subscription_id.
- Gráfico diário mostra instalações identificadas com atividade por dia.
- Nenhuma nova migration SQL é necessária para esta correção. Publicar a pasta web na Vercel.
