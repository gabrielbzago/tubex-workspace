# TubeX — Feed Inteligente do Canal

## O que foi implementado
- Seleção entre os canais retornados pela conta Google conectada (quando houver mais de um).
- Resumo do canal, inscritos públicos, visualizações acumuladas e volume de publicações.
- Filtro de 7, 28 ou 90 dias.
- Comparação de visualizações por vídeo, vídeos em destaque e vídeos abaixo de metade da média do período.
- Engajamento público calculado como (curtidas + comentários) / visualizações.
- Comparação exploratória entre vídeos curtos (até 60 segundos) e vídeos longos.
- Palavras recorrentes nos títulos e média de visualizações associada.
- Média de visualizações por dia da semana, exigindo ao menos dois vídeos para destacar um padrão.
- Comentários sem resposta nos 12 vídeos mais recentes, com link para o YouTube Studio.
- Aviso de transparência sobre métricas indisponíveis na YouTube Data API.

## Fonte e limites dos indicadores
O feed consulta a YouTube Data API usando o `provider_token` da sessão Supabase. Ele não cria uma série histórica de visualizações por hora/dia: o gráfico compara visualizações atuais dos vídeos publicados no período selecionado.

CTR, impressões, retenção, tempo de exibição, origem de tráfego, receita e variação diária de inscritos exigem YouTube Analytics API e permissões adicionais. Esses indicadores não são simulados nem inferidos neste módulo.

A divisão Shorts/vídeos longos é apenas uma aproximação pela duração (até 60 segundos); a Data API usada aqui não informa diretamente a classificação oficial do formato nem a orientação do vídeo.

## Permissões e operação
A conexão Google precisa fornecer um `provider_token` válido com permissões de leitura do YouTube. A leitura de comentários pode falhar separadamente se a conta não tiver acesso ao recurso ou se o escopo/permissão não estiver disponível; nesse caso o painel exibe um aviso e não deve ser interpretado como contagem completa.

## Arquivos
- `components/feed-dashboard.tsx`: interface e consultas do Feed Inteligente.
- `components/dashboard-layout.tsx`: já importa, apresenta no menu e monta o Feed do Canal.
