-- TubeX Keyword Explorer: quota diária por plano (America/Sao_Paulo).
create table if not exists public.tubex_keyword_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  created_at timestamptz not null default now()
);

create index if not exists tubex_keyword_usage_user_created_idx
  on public.tubex_keyword_usage (user_id, created_at desc);

alter table public.tubex_keyword_usage enable row level security;
revoke all on public.tubex_keyword_usage from anon, authenticated;
grant all on public.tubex_keyword_usage to service_role;

drop function if exists public.consume_tubex_keyword_usage(uuid, text, integer);

create function public.consume_tubex_keyword_usage(
  p_user_id uuid,
  p_keyword text,
  p_daily_limit integer
)
returns table(usage_id bigint, allowed boolean, used integer, daily_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_used integer;
  v_usage_id bigint;
begin
  -- Serializa tentativas simultâneas do mesmo usuário para impedir ultrapassar o limite.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  v_start := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  select count(*)::integer into v_used
  from public.tubex_keyword_usage
  where user_id = p_user_id and created_at >= v_start;

  if p_daily_limit > 0 and v_used >= p_daily_limit then
    return query select null::bigint, false, v_used, p_daily_limit;
    return;
  end if;

  insert into public.tubex_keyword_usage(user_id, keyword)
  values (p_user_id, left(coalesce(p_keyword, ''), 100))
  returning id into v_usage_id;

  return query select v_usage_id, true, v_used + 1, p_daily_limit;
end;
$$;

revoke all on function public.consume_tubex_keyword_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_tubex_keyword_usage(uuid, text, integer) to service_role;
