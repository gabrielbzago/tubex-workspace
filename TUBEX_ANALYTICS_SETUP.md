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

## Limitações honestas
- Eventos anteriores à implantação não são recuperados retroativamente.
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


## Mapeamento de módulos (v4.3.6)
O dashboard converte IDs internos em nomes amigáveis na resposta de `/api/admin/analytics`.
O campo `module` no banco permanece inalterado. O SEO executado pelo `content.js`
e enviado ao background por `fetchSeoData` é registrado como `seo_search` e exibido
como "SEO de Pesquisa". Não há alteração de schema nem nova migration SQL.


## Identidade Google da extensão (v4.3.11)

Para listar e-mails de usuários que entram pela extensão, execute no Supabase SQL Editor a migration `supabase/migrations/20261114_tubex_installations.sql`. A API valida o token no Google `userinfo` e só então grava e-mail verificado, nome, foto, identificador Google, instalação e última atividade. Tokens OAuth nunca são persistidos na tabela. A lista é exibida apenas no endpoint administrativo protegido pelo login do proprietário. Usuários precisam autenticar a extensão e enviar ao menos um evento após a publicação para aparecerem; não há recuperação retroativa de e-mails para instalações antigas sem login Google verificado.


## Recuperação da base histórica (Comportamento do Assinante)

A rota `app/api/admin/behavior/route.ts` reconstrói a lista de contas a partir de `public.users` e do Supabase Auth, mesmo para contas criadas antes da telemetria. O status de assinatura anterior/atual também considera os campos de assinatura preservados em `users`, além de `affiliate_referrals` e `affiliate_sales` quando disponíveis.

- `last_sign_in_at` do Supabase Auth alimenta o último login das contas antigas.
- `tubex_installations.last_seen` alimenta a última sincronização conhecida da extensão.
- `tubex_events` fornece módulos, ações, sessões, limites e jornada de checkout desde que a telemetria foi ativada.
- Para contas antigas sem eventos, o painel sinaliza que o status de atividade foi inferido pelo último login/sincronização. Não inventa histórico de módulos anterior à implantação.
- Não é necessária migração adicional se as migrations `20261114_tubex_analytics.sql` e `20261114_tubex_installations.sql` já foram aplicadas. A rota tolera a ausência dessas tabelas, mas os respectivos detalhes não estarão disponíveis.
