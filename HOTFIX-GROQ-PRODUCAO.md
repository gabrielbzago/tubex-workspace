# TubeX — hotfix urgente do limite Groq TPM

## O que mudou
- Controle distribuído de tokens por modelo, compartilhado entre usuários e instâncias Vercel.
- Reserva transacional no Supabase para janela móvel de 60 segundos.
- Fila segura por rejeição temporária com `Retry-After` quando o orçamento global estiver ocupado.
- Redução do histórico/contexto enviado ao modelo e limite de tokens de saída.
- Ajuste da reserva ao uso real reportado pela Groq.
- Devolução dos créditos TubeX quando a requisição não chega a ser concluída.

## Ordem obrigatória de publicação
1. Faça backup/commit da versão atual em produção.
2. Abra Supabase > SQL Editor.
3. Execute integralmente `supabase/migrations/20261125_tubex_groq_tpm_guard.sql`.
4. Confirme que a tabela `tubex_groq_token_reservations` e as funções `reserve_tubex_groq_tokens`, `settle_tubex_groq_tokens` e `release_tubex_groq_tokens` foram criadas.
5. Na Vercel, adicione `GROQ_TPM_LIMIT` com valor `6800` para a conta/modelo que mostra 8.000 TPM. Mantenha `GROQ_API_KEY` e `GROQ_CHAT_MODEL` atuais.
6. Faça deploy do código.
7. Teste com duas contas/usuários enviando mensagens ao mesmo tempo. A segunda chamada deve esperar/rejeitar temporariamente com mensagem clara, sem descontar créditos TubeX.
8. Confira os logs da Vercel e o painel Usage da Groq durante os primeiros minutos.

## Importante
- Não faça deploy do código antes de aplicar a migração SQL: o endpoint depende das funções novas.
- O limitador cobre as chamadas feitas por este endpoint/projeto. Outros serviços que usem a mesma organização e modelo Groq continuam consumindo a cota da Groq.
- O limitador evita que o próprio TubeX exceda seu orçamento estimado, mas não aumenta a cota concedida pela Groq.
- O ambiente de produção não foi acessado nem alterado por esta tarefa. É necessário executar os passos acima para ativar a correção.
- O build completo não foi executado porque o ZIP recebido não contém `node_modules` nem lockfile. A rota passou pela verificação sintática TypeScript; faça `npm install`, `npm run typecheck` e `npm run build` no pipeline antes de promover para produção.
