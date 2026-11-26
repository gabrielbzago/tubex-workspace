-- TubeX AI — pacotes de créditos avulsos (compra única via Stripe Checkout).
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Depende de 20261126_tubex_shared_ai_credits.sql (tabela tubex_ai_credit_usage).
--
-- Regra de consumo: primeiro a franquia mensal do plano; quando ela acaba,
-- o restante sai do saldo de pacotes. Créditos de pacote NÃO expiram na virada do mês.

create table if not exists public.tubex_ai_credit_wallet (
  user_id uuid primary key,
  balance integer not null default 0 check (balance >= 0),
  lifetime_purchased integer not null default 0 check (lifetime_purchased >= 0),
  updated_at timestamptz not null default now()
);

-- Uma linha por Checkout pago. A chave única em stripe_session_id torna o
-- crédito idempotente: o Stripe pode reenviar o webhook quantas vezes quiser.
create table if not exists public.tubex_ai_credit_purchases (
  id bigserial primary key,
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  user_id uuid not null,
  email text,
  pack text not null,
  credits integer not null check (credits > 0),
  amount_cents integer,
  currency text,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);
create index if not exists tubex_ai_credit_purchases_user_idx on public.tubex_ai_credit_purchases(user_id, created_at desc);

alter table public.tubex_ai_credit_wallet enable row level security;
alter table public.tubex_ai_credit_purchases enable row level security;
revoke all on public.tubex_ai_credit_wallet from anon, authenticated;
revoke all on public.tubex_ai_credit_purchases from anon, authenticated;
grant all on public.tubex_ai_credit_wallet to service_role;
grant all on public.tubex_ai_credit_purchases to service_role;
grant usage, select on sequence public.tubex_ai_credit_purchases_id_seq to service_role;

-- Credita um pacote pago. Retorna granted=false se a sessão já foi creditada.
create or replace function public.grant_tubex_ai_credit_pack(
  p_session_id text,
  p_payment_intent text,
  p_user_id uuid,
  p_email text,
  p_pack text,
  p_credits integer,
  p_amount_cents integer,
  p_currency text
)
returns table(granted boolean, pack_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_balance integer;
begin
  if coalesce(p_credits, 0) <= 0 then
    raise exception 'Quantidade de créditos inválida';
  end if;

  insert into public.tubex_ai_credit_purchases(
    stripe_session_id, stripe_payment_intent, user_id, email, pack, credits, amount_cents, currency
  ) values (
    p_session_id, nullif(p_payment_intent, ''), p_user_id, nullif(p_email, ''), p_pack, p_credits, p_amount_cents, p_currency
  )
  on conflict (stripe_session_id) do nothing
  returning id into v_id;

  if v_id is null then
    select w.balance into v_balance from public.tubex_ai_credit_wallet w where w.user_id = p_user_id;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into public.tubex_ai_credit_wallet as w (user_id, balance, lifetime_purchased)
  values (p_user_id, p_credits, p_credits)
  on conflict (user_id) do update
     set balance = w.balance + excluded.balance,
         lifetime_purchased = w.lifetime_purchased + excluded.lifetime_purchased,
         updated_at = now()
  returning w.balance into v_balance;

  return query select true, v_balance;
end;
$$;

-- Consome créditos: franquia do mês primeiro, depois saldo de pacotes.
-- Retorna quanto saiu de cada lado para que a devolução seja exata.
create or replace function public.consume_tubex_ai_credits_v2(
  p_user_id uuid,
  p_month_key text,
  p_monthly_limit integer,
  p_cost integer
)
returns table(allowed boolean, used integer, from_plan integer, from_pack integer, pack_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer := greatest(coalesce(p_cost, 0), 0);
  v_limit integer := greatest(coalesce(p_monthly_limit, 0), 0);
  v_used integer;
  v_balance integer;
  v_plan_part integer;
  v_pack_part integer;
begin
  insert into public.tubex_ai_credit_usage(user_id, month_key, used)
  values (p_user_id, p_month_key, 0)
  on conflict (user_id, month_key) do nothing;
  insert into public.tubex_ai_credit_wallet(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Trava as duas linhas (sempre na mesma ordem) para pedidos simultâneos.
  select u.used into v_used from public.tubex_ai_credit_usage u
   where u.user_id = p_user_id and u.month_key = p_month_key for update;
  select w.balance into v_balance from public.tubex_ai_credit_wallet w
   where w.user_id = p_user_id for update;
  v_used := coalesce(v_used, 0);
  v_balance := coalesce(v_balance, 0);

  if v_cost = 0 then
    return query select true, v_used, 0, 0, v_balance;
    return;
  end if;

  v_plan_part := least(v_cost, greatest(v_limit - v_used, 0));
  v_pack_part := v_cost - v_plan_part;

  if v_pack_part > v_balance then
    return query select false, v_used, 0, 0, v_balance;
    return;
  end if;

  if v_plan_part > 0 then
    update public.tubex_ai_credit_usage u
       set used = u.used + v_plan_part, updated_at = now()
     where u.user_id = p_user_id and u.month_key = p_month_key;
    v_used := v_used + v_plan_part;
  end if;

  if v_pack_part > 0 then
    update public.tubex_ai_credit_wallet w
       set balance = w.balance - v_pack_part, updated_at = now()
     where w.user_id = p_user_id;
    v_balance := v_balance - v_pack_part;
  end if;

  return query select true, v_used, v_plan_part, v_pack_part, v_balance;
end;
$$;

-- Devolve exatamente o que foi reservado (quando a IA falha).
create or replace function public.release_tubex_ai_credits_v2(
  p_user_id uuid,
  p_month_key text,
  p_from_plan integer,
  p_from_pack integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_from_plan, 0) > 0 then
    update public.tubex_ai_credit_usage u
       set used = greatest(u.used - p_from_plan, 0), updated_at = now()
     where u.user_id = p_user_id and u.month_key = p_month_key;
  end if;
  if coalesce(p_from_pack, 0) > 0 then
    insert into public.tubex_ai_credit_wallet as w (user_id, balance)
    values (p_user_id, p_from_pack)
    on conflict (user_id) do update set balance = w.balance + excluded.balance, updated_at = now();
  end if;
end;
$$;

revoke all on function public.grant_tubex_ai_credit_pack(text, text, uuid, text, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.consume_tubex_ai_credits_v2(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.release_tubex_ai_credits_v2(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.grant_tubex_ai_credit_pack(text, text, uuid, text, text, integer, integer, text) to service_role;
grant execute on function public.consume_tubex_ai_credits_v2(uuid, text, integer, integer) to service_role;
grant execute on function public.release_tubex_ai_credits_v2(uuid, text, integer, integer) to service_role;
