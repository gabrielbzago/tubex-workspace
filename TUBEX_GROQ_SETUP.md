# TubeX AI — configuração Groq e limites por plano

## 1. Criar a chave Groq
1. Acesse https://console.groq.com/
2. Crie sua conta ou entre.
3. Abra API Keys: https://console.groq.com/keys
4. Crie uma chave nova para produção, copie e guarde em um gerenciador seguro.
5. Não coloque a chave em arquivos públicos, no GitHub ou no código do navegador.

## 2. Configurar na Vercel
No projeto do TubeX Workspace:
1. Abra Settings → Environment Variables.
2. Cadastre `GROQ_API_KEY` com a chave copiada.
3. Cadastre `GROQ_CHAT_MODEL` com `openai/gpt-oss-20b`.
4. Marque Production e Preview (e Development se desejar).
5. Salve e faça redeploy.

A chave é lida somente pela rota server-side `/api/ai/chat`. Nunca use prefixo `NEXT_PUBLIC_` nela.

## 3. Aplicar a migração Supabase (obrigatório)
1. Abra o projeto Supabase → SQL Editor.
2. Abra `supabase/migrations/20261126_tubex_shared_ai_credits.sql` deste pacote.
3. Cole o conteúdo no SQL Editor e execute.
4. Confirme a criação da tabela `tubex_ai_credit_usage` e das funções `consume_tubex_ai_credits` e `release_tubex_ai_credits`.

A migração nova cria a carteira compartilhada. A tabela antiga `tubex_ai_usage` pode permanecer no banco; a aplicação deixa de utilizá-la. Não é necessário apagar dados antigos.

## 4. Carteira compartilhada de créditos
Chat e thumbnails consomem o mesmo saldo mensal por usuário. A franquia renova no primeiro dia de cada mês UTC.

| Plano interno | Créditos por mês |
|---|---:|
| Free | 150 |
| Start | 600 |
| Member | 1.000 |
| Pro | 2.000 |
| Expert | 6.000 |
| Owner/Admin | 100.000 |

### Custo por ação

| Ferramenta | Custo |
|---|---:|
| Chat rápido | 1 crédito |
| Chat profundo | 3 créditos |
| Sugestões de títulos | 3 créditos |
| Descrição | 1 crédito |
| Roteiro | 5 créditos |
| Gerar thumbnail | 22 créditos |

O chat classifica o tipo de solicitação no servidor. Thumbnails reservam 22 créditos antes de chamar o provedor. Se Groq ou o serviço de imagem falhar, os créditos reservados são devolvidos. Se o saldo for insuficiente, a API bloqueia a ação e o Workspace apresenta o atalho para `/plans`.

Os custos são parâmetros iniciais do TubeX, não valores oficiais do vidIQ. Devem ser revistos com base no custo real dos provedores e na margem de cada plano.

## 5. Planos e preços sugeridos
Para evitar dois planos chamados Pro:
- Free — gratuito.
- Start — R$ 19,90/mês.
- Creator — R$ 29,90/mês.
- Pro — R$ 49,90/mês.

Os nomes e preços comerciais não são alterados automaticamente por este pacote. O backend de assinaturas atual reconhece `free`, `start`, `pro` e `expert`; os limites acima usam esses identificadores existentes. Antes de vender Creator como plano separado, crie seu produto/preço no Stripe e atualize checkout, webhook e resolução de plano em conjunto. Não reutilize Price IDs de outros planos.

## 6. O que já está conectado
- Chat de texto do Workspace chama Groq via `https://api.groq.com/openai/v1/chat/completions`.
- Modelo inicial: `openai/gpt-oss-20b`.
- Histórico local da conversa é enviado ao modelo.
- O contexto de canal atualmente enviado pelo frontend é incluído nas instruções do modelo. Isso não substitui uma integração server-side autenticada com YouTube Analytics.
- O endpoint devolve plano, franquia e consumo ao chat.

## 7. O que ainda precisa de uma etapa própria
- Conectar dados privados reais do YouTube Analytics no servidor, com OAuth e escopos adequados.
- Implementar function calling para o modelo acionar ferramentas de SEO, Analytics e pesquisa de concorrentes com validação server-side.
- A geração de thumbnail continua com o provedor de imagem já configurado (OpenAI nesta versão), não com Groq. O custo é de 22 créditos compartilhados.
- Criar no Stripe os preços e produtos correspondentes ao novo catálogo comercial e atualizar o webhook para persistir o identificador de plano correto.

## 8. Monitoramento
Acompanhe consumo e limites no Groq Console. A API tem limites por organização/modelo (RPM, RPD e TPM); respostas 429 devem ser tratadas como indisponibilidade temporária e não como crédito do usuário. Veja https://console.groq.com/docs/rate-limits.
