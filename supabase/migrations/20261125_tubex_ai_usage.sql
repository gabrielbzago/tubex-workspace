-- TubeX AI monthly message quotas. Run once in Supabase SQL Editor.
create table if not exists public.tubex_ai_usage (
  user_id uuid not null,
  month_key text not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

alter table public.tubex_ai_usage enable row level security;
revoke all on public.tubex_ai_usage from anon, authenticated;
grant all on public.tubex_ai_usage to service_role;

create or replace function public.consume_tubex_ai_usage(
  p_user_id uuid,
  p_month_key text,
  p_monthly_limit integer
)
returns table(allowed boolean, used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into public.tubex_ai_usage(user_id, month_key, used)
  values (p_user_id, p_month_key, 0)
  on conflict (user_id, month_key) do nothing;

  update public.tubex_ai_usage
     set used = used + 1, updated_at = now()
   where user_id = p_user_id
     and month_key = p_month_key
     and used < greatest(p_monthly_limit, 0)
   returning tubex_ai_usage.used into v_used;

  if found then
    return query select true, v_used;
  else
    select u.used into v_used
      from public.tubex_ai_usage u
     where u.user_id = p_user_id and u.month_key = p_month_key;
    return query select false, coalesce(v_used, 0);
  end if;
end;
$$;

create or replace function public.release_tubex_ai_usage(
  p_user_id uuid,
  p_month_key text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tubex_ai_usage
     set used = greatest(used - 1, 0), updated_at = now()
   where user_id = p_user_id and month_key = p_month_key;
$$;

revoke all on function public.consume_tubex_ai_usage(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_tubex_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_tubex_ai_usage(uuid, text, integer) to service_role;
grant execute on function public.release_tubex_ai_usage(uuid, text) to service_role;
