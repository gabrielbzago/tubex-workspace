-- Índice adicional para acelerar a consulta de eventos por conta no painel Owner.
create index if not exists tubex_events_user_created_at_idx
  on public.tubex_events (user_id, created_at desc);
