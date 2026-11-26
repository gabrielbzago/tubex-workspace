# TubeX Analytics — v4.4.21

## Correções desta revisão
- A API de Analytics consulta eventos em páginas ordenadas do mais recente para o mais antigo, até 100 mil registros no intervalo, em vez de depender de uma única consulta limitada a 20 mil.
- O endpoint de comportamento usa paginação ordenada para não parar nos primeiros registros antigos da tabela.
- Status e último uso deixam de tratar sincronização/heartbeat da extensão como uso de ferramenta.
- Login é mantido como fallback de acesso conhecido, mas fica identificado como login sem evento de recurso.
- Eventos operacionais (instalação, sincronização, heartbeat, autenticação e webhooks) não entram na contagem de ações de produto.
- Datas e agrupamento de dias do comportamento usam America/Sao_Paulo.
- O painel mostra tempo decorrido, data/hora local e dias de pico de instalações, pesquisas, logins e contas usando.
- Contas assinantes não recebem classificação comercial Quente/Morno/Frio; essa pontuação é destinada a contas sem assinatura ativa.

## Limites importantes
- Eventos que nunca foram gravados não podem ser reconstruídos retroativamente.
- O histórico de Analytics depende da tabela `public.tubex_events` e da telemetria que já estava ativa na data do evento.
- A paginação cobre até 100 mil eventos por requisição. Se o produto ultrapassar esse volume no intervalo, será necessário migrar agregações diárias para SQL/RPC.
- A migração `20261125_tubex_behavior_user_index.sql` adiciona índice de apoio; não altera nem apaga dados.

## Publicação
1. Manter as variáveis de ambiente atuais.
2. Executar a migração SQL já incluída na pasta `supabase/migrations`, caso ainda não tenha sido aplicada.
3. Publicar o projeto completo.
4. Abrir Analytics e Comportamento, atualizar a página e conferir o intervalo de 30 e 90 dias.
