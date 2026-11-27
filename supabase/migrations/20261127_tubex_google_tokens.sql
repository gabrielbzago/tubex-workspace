-- TubeX: refresh token do Google por usuário (criptografado no servidor, AES-256-GCM).
-- Permite renovar o acesso ao YouTube / YouTube Analytics sem pedir para a pessoa reconectar
-- a cada hora (o Supabase não renova o provider_token do Google).
create table if not exists public.tubex_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  scopes text,
  last_error text,
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Só o service role (rotas do servidor) lê/escreve. Nenhuma policy = nenhum acesso pelo navegador.
alter table public.tubex_google_tokens enable row level security;
revoke all on public.tubex_google_tokens from anon, authenticated;
