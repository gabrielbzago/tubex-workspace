-- Store verified Google identity for each TubeX extension installation.
-- The extension never sends or stores Google access tokens in this table.
create table if not exists public.tubex_installations (
  install_id text primary key,
  google_sub text not null,
  email text not null,
  name text,
  picture text,
  user_id uuid references auth.users(id) on delete set null,
  extension_version text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists tubex_installations_email_idx
  on public.tubex_installations (lower(email));
create index if not exists tubex_installations_last_seen_idx
  on public.tubex_installations (last_seen desc);
create index if not exists tubex_installations_user_idx
  on public.tubex_installations (user_id);

alter table public.tubex_installations enable row level security;
-- No client policies. All writes and reads are mediated by server routes
-- using the Supabase service-role client; only the owner Analytics endpoint exposes this data.
