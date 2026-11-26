# TubeX Premium Refresh — v9.0

## Identidade e permissões Owner
- A autorização Owner é vinculada ao usuário autenticado no Supabase Auth (`user.id`, `app_metadata` e identidades de login vinculadas), e não ao canal do YouTube selecionado.
- Novo endpoint `GET /api/account/owner-status` retorna a confirmação da permissão para a interface.
- `lib/tubex-owner.ts` centraliza a validação do lado do servidor.
- Os endpoints de administração de afiliados e listagem administrativa de cancelamentos usam a mesma validação.
- `resolveAccountPlan()` devolve plano `owner` para a identidade autenticada autorizada, para manter os módulos premium e o backend de IA coerentes.

### Variáveis de ambiente opcionais
- `OWNER_EMAILS`: lista de e-mails autorizados separada por vírgulas.
- `OWNER_USER_IDS`: lista de UUIDs Supabase Auth autorizados, separada por vírgulas.
- `NEXT_PUBLIC_OWNER_EMAILS` e `NEXT_PUBLIC_OWNER_USER_IDS`: apenas para refletir o acesso na navegação do cliente. A validação real continua no servidor.
- `NEXT_PUBLIC_OWNER_EMAIL`: compatibilidade com a configuração anterior.

Recomendação: cadastrar o UUID do usuário Supabase em `OWNER_USER_IDS` como identificador estável. Não use e-mail de canal do YouTube ou o canal ativo como critério de autorização.

## Sistema visual premium
- Superfícies translúcidas com blur e camadas discretas.
- Azul para séries de dados e tendências; verde para métricas positivas; amarelo reservado à identidade TubeX e ações principais; vermelho/laranja para alertas.
- Tokens de cor compartilhados entre os módulos e estilos consistentes para cards, formulários, tabelas, estados e tooltips.
- Gráficos de tendência do Creator Workspace passam a usar azul; o medidor de score preserva a escala vermelho/amarelo/verde.

## IA / Groq
- Mantido o hotfix de TPM global já incluído neste workspace.
- Mantida a rota `/api/ai/chat`, as reservas globais no Supabase e os limites de contexto/tokens.
- Execute as migrações existentes na sequência documentada; não remova a migração `20261125_tubex_groq_tpm_guard.sql`.

## Publicação
1. Conferir `OWNER_EMAILS` / `OWNER_USER_IDS` na Vercel.
2. Executar migrações pendentes do Supabase, inclusive a do limitador Groq se ainda não aplicada.
3. Executar `npm install`, `npm run typecheck` e `npm run build`.
4. Fazer deploy e testar o Owner com os três canais/contas conectados, alternando o canal ativo sem trocar a sessão de login do TubeX.
5. Testar também uma conta comum e confirmar que os módulos administrativos continuam bloqueados.
