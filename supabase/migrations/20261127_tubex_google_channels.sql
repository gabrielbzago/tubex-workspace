-- TubeX: vários canais do YouTube por conta (um e-mail Google pode ter canal pessoal + contas de marca).
-- Um refresh token (criptografado AES-256-GCM no servidor) por (usuário TubeX, canal).
-- O canal ativo é o que o site carrega. O acesso de owner continua ligado ao usuário/e-mail, não ao canal.
create table if not exists public.tubex_google_channels (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  title text,
  thumbnail text,
  custom_url text,
  google_email text,
  refresh_token text,
  scopes text,
  is_active boolean not null default false,
  last_error text,
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index if not exists tubex_google_channels_channel_idx on public.tubex_google_channels (channel_id);

-- Só o service role (rotas do servidor) lê/escreve. Nenhuma policy = nenhum acesso pelo navegador.
alter table public.tubex_google_channels enable row level security;
revoke all on public.tubex_google_channels from anon, authenticated;
