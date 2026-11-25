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

## 3. Aplicar a migração Supabase (obrigatório para limites)
1. Abra o projeto Supabase → SQL Editor.
2. Abra o arquivo `supabase/migrations/20261125_tubex_ai_usage.sql` deste pacote.
3. Cole o conteúdo no SQL Editor e execute.
4. Confirme que a tabela `tubex_ai_usage` e as funções `consume_tubex_ai_usage` e `release_tubex_ai_usage` foram criadas.

Sem essa migração, o endpoint não consegue reservar e controlar os créditos de IA.

## 4. Limites iniciais do TubeX AI
Os limites abaixo são mensagens de chat por usuário/mês, reiniciadas no primeiro dia de cada mês UTC:

| Plano reconhecido pelo backend | Mensagens/mês |
|---|---:|
| Free | 25 |
| Start | 200 |
| Pro | 600 |
| Expert | 1.600 |
| Owner/Admin | ilimitado na prática |

O painel mostra plano e consumo. As chamadas são contadas no servidor, com atualização atômica no Supabase para impedir que requisições simultâneas ultrapassem facilmente a franquia. Se o provedor falhar, a reserva é devolvida.

A franquia conta mensagens enviadas ao chat. Geração de thumbnails não está incluída nesta quota e continua usando o endpoint de imagens existente, que requer `OPENAI_API_KEY`. Defina uma franquia separada para imagens antes de liberar essa função amplamente.

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
- Definir franquia/custo para geração de imagens. A geração de thumbnail continua com o provedor de imagem já configurado, não com Groq.
- Criar no Stripe os preços e produtos correspondentes ao novo catálogo comercial e atualizar o webhook para persistir o identificador de plano correto.

## 8. Monitoramento
Acompanhe consumo e limites no Groq Console. A API tem limites por organização/modelo (RPM, RPD e TPM); respostas 429 devem ser tratadas como indisponibilidade temporária e não como crédito do usuário. Veja https://console.groq.com/docs/rate-limits.
