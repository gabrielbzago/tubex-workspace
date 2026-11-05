# TubeX Web — Workspace SEO

## O que foi adicionado

- Área **Workspace SEO** como tela inicial depois do login.
- Leitura automática dos canais retornados para a conta Google autenticada via `channels.list?mine=true`.
- Seletor para alternar entre os canais detectados e indicadores públicos do canal selecionado.
- Keyword Explorer com pesquisa por palavra-chave, país e idioma.
- Análise dos até 50 vídeos relevantes retornados pelo YouTube.
- Velocímetros de **volume de pesquisa estimado** e **concorrência (índice invertido)**, usando as fórmulas do motor da extensão TubeX v4.2.5.
- TubeX Score de oportunidade, visualizações médias e medianas, engajamento público, publicações recentes, termos relacionados extraídos dos títulos e tabela de vídeos concorrentes.
- Cache local de seis horas para reduzir chamadas repetidas à API.

## Requisitos Google / YouTube

1. No Google Cloud Console do projeto associado ao cliente OAuth usado pelo Supabase, habilite **YouTube Data API v3**.
2. No provedor Google do Supabase, mantenha permitido o escopo `https://www.googleapis.com/auth/youtube.readonly`.
3. O login Google da aplicação já solicita `youtube.readonly`. O botão **Conectar YouTube** no workspace permite repetir o consentimento quando o token não estiver disponível ou tiver expirado.
4. O endpoint `channels.list` com `mine=true` lista, com paginação, os canais que a API reconhece como pertencentes à conta autenticada (o workspace carrega até 5.000 canais por segurança). O acesso de parceiros/CMS a canais gerenciados por Content Owner é um fluxo separado e exige credenciais próprias de parceiro.

## Como são calculadas as métricas

- **Volume de pesquisa estimado (0–100):** replica a fórmula da extensão TubeX v4.2.5: desempenho dos vídeos, amplitude estimada dos resultados, adoção dos termos nos títulos e velocidade de publicação recente.
- **Baixa concorrência (0–100):** replica a fórmula invertida da extensão: pontuação maior representa menor pressão competitiva estimada.
- **Oportunidade (0–100):** combina espaço no título, baixa concorrência e frescor dos resultados, seguindo o motor da extensão.

Esses indicadores são estimativas do TubeX calculadas a partir dos resultados públicos retornados. A YouTube Data API não fornece volume mensal oficial de buscas nem uma métrica oficial de concorrência por palavra-chave.

## Cota da API

A documentação atual do Google informa uma cota padrão de 100 chamadas por dia para `search.list` (bucket separado; cada chamada custa 1 unidade nesse bucket). Por isso a pesquisa é manual e as respostas ficam em cache local por seis horas. `videos.list` e `channels.list` usam a cota geral da YouTube Data API.

## Executar localmente

```bash
npm install
npm run dev
```

Configure as variáveis de ambiente já usadas pelo projeto conforme `.env.example`. Não distribua `.env.local`, chaves de serviço ou credenciais OAuth no ZIP.


## Creator Workspace (com integração ao motor da extensão)

O Creator Workspace inclui detecção de canais Google (escopo OAuth `youtube.readonly`), leitura de uploads recentes, radar de ideias, Content Outliers e análise de palavras-chave.

### Backend TubeX compartilhado com a extensão

O Workspace SEO utiliza diretamente o mesmo backend oficial da extensão TubeX Analyzer:

- URL: `https://tubex-backend.vercel.app/api`
- Header `x-api-key`: mesma chave definida no `background.js` da extensão (`tubex_secure_2026_ultra`).
- Header `x-client`: `tubex-extension-v1`.

Não é necessário cadastrar `TUBEX_BACKEND_API_KEY` nem `TUBEX_BACKEND_URL` na Vercel. As chamadas são feitas exclusivamente pelo servidor Next.js; a chave não é enviada ao navegador. As rotas `/youtube` e `/trends` usam o mesmo backend da extensão.

### Google OAuth

O provedor Google do Supabase deve autorizar `https://www.googleapis.com/auth/youtube.readonly`. A conta autenticada deve ter acesso de gerenciamento aos canais que deseja listar. Contas CMS/Content Owner podem exigir configuração específica do YouTube/Google e não são garantidas pelo `channels.list?mine=true`.

### Acesso Owner ao painel de afiliados

A rota verifica o e-mail autenticado na allowlist `OWNER_EMAILS` / `NEXT_PUBLIC_OWNER_EMAIL`, `app_metadata` e os campos de role no registro `users` (por ID ou e-mail). Configure `OWNER_EMAILS` com os e-mails separados por vírgula no servidor para não depender do fallback. Erros 401/403 são exibidos dentro do painel, sem lançar uma exceção de autorização para o overlay do Next.js.

### Limitações dos indicadores

- Volume e concorrência são índices comparativos do TubeX derivados da amostra `/youtube`; não são contagens mensais oficiais de busca.
- Google Trends fornece interesse relativo de 0 a 100 quando o backend entrega uma série válida. Se a série não existir, o gráfico informa indisponibilidade e não fabrica valores.
- Outlier é o múltiplo de visualizações em relação à média recente do próprio canal, quando o backend fornece essa média. Vídeos sem baseline confiável não são ranqueados como outliers.
- Ideias de IA usam nicho, vídeos recentes, autocomplete e sinais reais de Trends; a IA não deve afirmar que um assunto está em alta sem evidência coletada.


### Cache da análise e avatar do canal
- A última análise bem-sucedida fica salva localmente durante a navegação entre menus.
- Pesquisar outra palavra-chave substitui a análise ativa anterior.
- Ao sair explicitamente da conta, a análise ativa e os caches antigos de palavras-chave são removidos.
- O avatar prioriza a miniatura `high` da YouTube Data API e exibe a inicial do canal se a imagem falhar.

### Keyword Explorer — paridade visual e Google Trends

- O item anteriormente chamado `Creator Workspace` passa a se chamar `Keyword Explorer` no menu e no cabeçalho.
- O painel de análise segue o layout do `content.js` da extensão: um único velocímetro `Keyword Score` com zonas vermelho/amarelo/verde, ponteiro branco, valor central e status; volume e concorrência aparecem como barras horizontais com cores e marcadores.
- A série Google Trends consulta o mesmo endpoint privado `/trends`, com `keyword`, `range`, `property: youtube` e região global, alinhado ao fluxo `googleTrends` da extensão.
- A extração da série aceita os formatos comuns do backend/Google Trends (`trend7d`, `trend30d`, `trend12m`, `trend`, `history`, `timelineData` e `interestOverTime`), com normalização dos pontos.
- Séries válidas são armazenadas por palavra-chave e período por até 6 horas; requisições antigas são descartadas ao trocar termo ou período. Quando não há série real, o painel informa a ausência e oferece nova tentativa, sem inventar pontos.


### Planos e limites do Keyword Explorer

- **Free:** 5 análises novas por dia; visualiza os indicadores principais e uma amostra de até 5 vídeos; termos relacionados limitados a 4; Google Trends bloqueado com prévia e CTA Pro.
- **Pro:** 50 análises novas por dia; até 20 vídeos por pesquisa; Google Trends (7 dias, 30 dias e 12 meses); até 8 termos relacionados.
- **Expert:** análises ilimitadas; lista completa de vídeos e todos os termos relacionados.
- O servidor valida o plano diretamente na tabela `users` e consome a cota de forma atômica no RPC `consume_tubex_keyword_usage`.
- **Obrigatório antes do deploy:** executar `supabase/migrations/20261105_tubex_keyword_usage.sql` no SQL Editor do Supabase.
- O Google Trends não faz quatro tentativas seguidas quando o provedor retorna HTTP 429; o Workspace exibe uma mensagem amigável e não mostra HTML bruto.


### Revisão de mensagens comerciais para produção

Consulte `PRODUCTION-MESSAGE-AUDIT.md` para a matriz Free/Pro/Expert, textos de conversão, tratamento de erros e checklist pré-publicação. Os bloqueios de Trends e IA no Keyword Explorer exibem oferta Pro; o limite de pesquisas e o bloqueio de recursos Expert exibem a oferta correspondente. Erros técnicos permanecem nos logs do servidor.


### Gerador de palavras-chave no Creator Workspace

O Creator Workspace inclui agora pesquisa de palavras-chave por nicho e por título do vídeo, utilizando o mesmo `mode: "tag_suggestions"` do backend da extensão TubeX Analyzer. A lista é classificada por relevância com base em tags públicas de vídeos e autocomplete do YouTube, sem IA. Free visualiza três sugestões e uma prévia bloqueada; Pro/Expert visualizam até 120. A rota autenticada `/api/seo/tags` aplica a cota diária e estorna tentativas sem resultados ou com falha.


## Dashboard principal e responsividade mobile (05/11/2026)

- O login agora abre diretamente em Visão Geral (`dashboard`).
- A navegação prioriza Visão Geral, seguida dos espaços web complementares.
- Visão Geral apresenta um alerta de destaque informando que a extensão TubeX é a ferramenta principal de uso no YouTube, com link oficial da Chrome Web Store e instruções rápidas de instalação/fixação.
- O painel web é descrito como complemento para análise, planejamento e gestão da conta.
- Menu mobile em duas colunas, com altura limitada e rolagem própria; conteúdo com largura fluida, controles adaptados e proteção contra overflow horizontal.
- Campos de seleção e botões que tinham largura mínima fixa passam a ocupar 100% da tela em smartphones.
