# TubeX AI Chat Analytics

O uso do TubeX AI Chat agora é registrado no fluxo existente `public.tubex_events`, no módulo `ai_chat`.

## Eventos registrados
- `chat_opened`: o usuário autenticado abriu o Chat (registrado na consulta inicial de quota).
- `chat_message_sent`: uma solicitação foi respondida com sucesso pela IA.

As propriedades registradas incluem plano, modo (rápido/profundo), tipo de ação, créditos consumidos, tamanho do prompt e tokens totais retornados pelo provedor. O texto do prompt e a resposta da IA **não** são armazenados no Analytics.

## Aplicação
1. Publique o código atualizado.
2. No Supabase SQL Editor, execute `supabase/migrations/20261125_tubex_ai_chat_analytics.sql` para criar os índices de consulta.
3. Abra TubeX Analytics com a conta Owner e consulte a seção **Uso do TubeX AI Chat**. O seletor de período filtra os últimos 7, 30, 60 ou 90 dias.

A seção lista nome/e-mail (quando disponíveis na conta), plano, aberturas/sessões, mensagens, créditos consumidos e último uso. Os registros começam a aparecer após a publicação; não há retroatividade para interações antigas.
