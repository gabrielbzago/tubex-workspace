# TubeX AI — configuração

O Workspace inclui um chat persistente no canto inferior, com contexto do canal carregado no Feed do canal, além de geração de thumbnails.

## Variáveis necessárias na Vercel

- `OPENAI_API_KEY`: chave de API da plataforma OpenAI (não é a senha do ChatGPT).
- `OPENAI_CHAT_MODEL`: opcional; padrão `gpt-4.1-mini`.

Configure as variáveis em Project → Settings → Environment Variables e faça um novo deploy. A chave é usada exclusivamente nas rotas server-side `/api/ai/chat` e `/api/ai/thumbnail`; não é enviada ao navegador.

## Como o contexto funciona

Quando o usuário abre o Feed do canal e os dados carregam, o Workspace guarda no navegador o nome/ID do canal, inscritos, visualizações totais, quantidade de vídeos e até 40 vídeos recentes (título, data, views, curtidas, comentários e duração). O chat envia esse contexto ao servidor junto com a conversa. Os dados são públicos retornados pela YouTube Data API; CTR, impressões, retenção e watch time não são inferidos.

## Recursos

- Chat com histórico da conversa atual (até 12 mensagens enviadas por chamada).
- Perguntas rápidas sobre desempenho, pautas e prioridades.
- Geração de imagem via `gpt-image-1`; custos de geração são cobrados pela API OpenAI.
- Endpoints exigem sessão autenticada do Supabase.

## Limites desta entrega

A conversa não persiste entre sessões/dispositivos e não executa ações no YouTube. A geração de thumbnail devolve uma imagem pronta; editor de camadas, texto editável, histórico de projetos e publicação direta não fazem parte desta primeira versão.


## Atualização da interface — TubeX AI Premium

A interface principal do Workspace agora abre em um ambiente de conversa com:
- navegação de conversas recentes armazenada localmente no navegador;
- botão de nova conversa;
- área central de mensagens e composer fixo;
- ações rápidas para análise do canal, ideias e desempenho;
- ferramenta de criação de thumbnail integrada ao chat;
- seletor de estilo de resposta Rápido / Análise profunda;
- painel lateral de contexto do canal, recolhível;
- layout responsivo e estilos SaaS premium.

O modo Rápido/Profundo ajusta as instruções enviadas ao endpoint atual; não troca o modelo nem habilita raciocínio avançado do provedor por si só. O histórico desta versão fica no localStorage do navegador e não sincroniza entre dispositivos. A integração do chat continua usando o endpoint `/api/ai/chat` existente e, portanto, a configuração do provedor permanece na API server-side atual. A escolha/abstração de provedores e ferramentas reais (Analytics privado, pesquisa de concorrentes, etc.) deve ser uma etapa separada.
