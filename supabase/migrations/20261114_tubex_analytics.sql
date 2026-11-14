-- TubeX Analytics: event-level product telemetry.
create table if not exists public.tubex_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  install_id text not null,
  session_id text,
  event_name text not null,
  module text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tubex_events_created_at_idx on public.tubex_events(created_at desc);
create index if not exists tubex_events_user_created_idx on public.tubex_events(user_id,created_at desc);
create index if not exists tubex_events_install_idx on public.tubex_events(install_id);
create index if not exists tubex_events_event_idx on public.tubex_events(event_name);
create index if not exists tubex_events_module_idx on public.tubex_events(module);
alter table public.tubex_events enable row level security;
-- No client policies: writes/reads are mediated by server routes using service role.

-- Idempotent ingestion uses the primary key id as event_id.
create index if not exists tubex_events_user_event_created_idx
  on public.tubex_events(user_id,event_name,created_at desc);
create index if not exists tubex_events_install_event_created_idx
  on public.tubex_events(install_id,event_name,created_at desc);
