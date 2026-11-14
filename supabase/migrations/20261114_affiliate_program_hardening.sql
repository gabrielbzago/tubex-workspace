-- TubeX Affiliate Program hardening.
-- Idempotent migration: preserves existing rows and balances.

alter table public.users
  add column if not exists affiliate_code text,
  add column if not exists affiliate_balance numeric(12,2) not null default 0,
  add column if not exists affiliate_paid numeric(12,2) not null default 0,
  add column if not exists cpf text,
  add column if not exists pix_type text,
  add column if not exists pix_key text,
  add column if not exists referred_by text,
  add column if not exists last_payout timestamptz;

create unique index if not exists users_affiliate_code_unique_idx
  on public.users (upper(affiliate_code)) where affiliate_code is not null;
create index if not exists users_referred_by_idx on public.users(referred_by) where referred_by is not null;

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_code text not null,
  referred_email text not null,
  referred_name text,
  plan text,
  commission numeric(12,2) not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliate_referrals
  add column if not exists affiliate_code text,
  add column if not exists referred_email text,
  add column if not exists referred_name text,
  add column if not exists plan text,
  add column if not exists commission numeric(12,2) not null default 0,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists affiliate_referrals_code_idx on public.affiliate_referrals(affiliate_code);
create index if not exists affiliate_referrals_customer_idx on public.affiliate_referrals(stripe_customer_id);
create unique index if not exists affiliate_referrals_subscription_unique_idx
  on public.affiliate_referrals(stripe_subscription_id);

create table if not exists public.affiliate_sales (
  id uuid primary key default gen_random_uuid(),
  affiliate_code text not null,
  customer_email text,
  customer_name text,
  plan text,
  amount numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  stripe_invoice_id text,
  stripe_payment_intent text,
  stripe_customer_id text,
  stripe_subscription_id text,
  last_payment_date timestamptz not null default now(),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliate_sales
  add column if not exists affiliate_code text,
  add column if not exists customer_email text,
  add column if not exists customer_name text,
  add column if not exists plan text,
  add column if not exists amount numeric(12,2) not null default 0,
  add column if not exists commission numeric(12,2) not null default 0,
  add column if not exists commission_amount numeric(12,2) not null default 0,
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists last_payment_date timestamptz not null default now(),
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists refunded_amount numeric(12,2) not null default 0,
  add column if not exists reversed_commission numeric(12,2) not null default 0,
  add column if not exists reversal_previous_status text,
  add column if not exists reversal_previous_commission numeric(12,2) not null default 0,
  add column if not exists reversal_previous_refunded_amount numeric(12,2) not null default 0;

create index if not exists affiliate_sales_code_date_idx on public.affiliate_sales(affiliate_code, created_at desc);
create index if not exists affiliate_sales_payment_intent_idx on public.affiliate_sales(stripe_payment_intent);
create index if not exists affiliate_sales_subscription_idx on public.affiliate_sales(stripe_subscription_id);
create index if not exists affiliate_sales_invoice_idx on public.affiliate_sales(stripe_invoice_id);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid,
  affiliate_code text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'paid',
  created_at timestamptz not null default now(),
  paid_at timestamptz not null default now(),
  notes text
);

alter table public.affiliate_payouts
  add column if not exists affiliate_id uuid,
  add column if not exists affiliate_code text,
  add column if not exists amount numeric(12,2) not null default 0,
  add column if not exists status text not null default 'paid',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists paid_at timestamptz not null default now(),
  add column if not exists notes text;

create index if not exists affiliate_payouts_code_date_idx on public.affiliate_payouts(affiliate_code, created_at desc);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_code text not null,
  visitor_hash text not null,
  click_date date not null default current_date,
  landing_path text,
  referrer text,
  created_at timestamptz not null default now(),
  unique (affiliate_code, visitor_hash, click_date)
);
create index if not exists affiliate_clicks_code_date_idx on public.affiliate_clicks(affiliate_code, created_at desc);

create table if not exists public.affiliate_adjustments (
  id uuid primary key default gen_random_uuid(),
  affiliate_code text not null,
  sale_id uuid,
  amount numeric(12,2) not null,
  reason text not null,
  stripe_event_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists affiliate_adjustments_event_unique_idx
  on public.affiliate_adjustments(stripe_event_id) where stripe_event_id is not null;

alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_sales enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_adjustments enable row level security;

-- All financial writes are server-side via service_role RPC only.
create or replace function public.record_affiliate_sale(
  p_affiliate_code text,
  p_customer_email text,
  p_customer_name text,
  p_plan text,
  p_amount numeric,
  p_commission numeric,
  p_invoice_id text,
  p_payment_intent text,
  p_customer_id text,
  p_subscription_id text,
  p_payment_date timestamptz
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_code text := upper(trim(coalesce(p_affiliate_code, '')));
begin
  if coalesce(p_invoice_id, '') = '' or coalesce(p_amount, 0) <= 0 or coalesce(p_commission, 0) < 0 then
    raise exception 'Dados de comissão inválidos';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_invoice_id, 0));
  if exists (select 1 from public.affiliate_sales where stripe_invoice_id = p_invoice_id) then
    return false;
  end if;
  select id into v_affiliate_id from public.users where upper(affiliate_code) = v_code for update;
  if v_affiliate_id is null then raise exception 'Código de afiliado não encontrado: %', v_code; end if;

  insert into public.affiliate_sales(
    affiliate_code, customer_email, customer_name, plan, amount, commission,
    commission_amount, stripe_invoice_id, stripe_payment_intent, stripe_customer_id,
    stripe_subscription_id, last_payment_date, status, created_at, updated_at
  ) values (
    v_code, lower(trim(p_customer_email)), p_customer_name, p_plan, round(p_amount,2),
    round(p_commission,2), round(p_commission,2), p_invoice_id, nullif(p_payment_intent,''),
    nullif(p_customer_id,''), nullif(p_subscription_id,''), coalesce(p_payment_date, now()),
    'pending', now(), now()
  );

  update public.users set affiliate_balance = coalesce(affiliate_balance,0) + round(p_commission,2),
    updated_at = now() where id = v_affiliate_id;
  return true;
end;
$$;

create or replace function public.mark_affiliate_paid(p_affiliate_id uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_amount numeric(12,2);
begin
  select affiliate_code, round(coalesce(affiliate_balance,0),2)
    into v_code, v_amount from public.users where id = p_affiliate_id for update;
  if not found then raise exception 'Afiliado não encontrado'; end if;
  if v_amount <= 0 then raise exception 'Saldo pendente inexistente'; end if;

  insert into public.affiliate_payouts(affiliate_id, affiliate_code, amount, status, created_at, paid_at)
    values (p_affiliate_id, v_code, v_amount, 'paid', now(), now());

  update public.affiliate_sales set status = 'paid', updated_at = now()
    where affiliate_code = v_code and status = 'pending';

  update public.users set affiliate_balance = 0,
    affiliate_paid = coalesce(affiliate_paid,0) + v_amount,
    last_payout = now(), updated_at = now()
    where id = p_affiliate_id;
  return v_amount;
end;
$$;

create or replace function public.reverse_affiliate_sale(
  p_payment_intent text,
  p_reason text,
  p_stripe_event_id text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.affiliate_sales%rowtype;
  v_affiliate_id uuid;
  v_reason text := lower(coalesce(p_reason, 'refunded'));
begin
  if coalesce(p_payment_intent,'') = '' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payment_intent, 1));
  if coalesce(p_stripe_event_id,'') <> '' then perform pg_advisory_xact_lock(hashtextextended(p_stripe_event_id, 4)); end if;
  select * into v_sale from public.affiliate_sales
    where stripe_payment_intent = p_payment_intent order by created_at desc limit 1 for update;
  if not found then return false; end if;
  if lower(coalesce(v_sale.status,'')) in ('refunded','chargeback','reversed') then return false; end if;
  if coalesce(p_stripe_event_id,'') <> '' and exists(
    select 1 from public.affiliate_adjustments where stripe_event_id = p_stripe_event_id
  ) then return false; end if;

  select id into v_affiliate_id from public.users
    where upper(affiliate_code) = upper(v_sale.affiliate_code) for update;
  if v_affiliate_id is null then raise exception 'Afiliado da venda não encontrado'; end if;

  -- A comissão é debitada do saldo; se já tiver sido paga, o saldo fica negativo
  -- e as próximas comissões compensam o valor, sem apagar o histórico de pagamentos.
  update public.users set affiliate_balance = coalesce(affiliate_balance,0) - greatest(0, greatest(coalesce(v_sale.commission_amount,0), coalesce(v_sale.commission,0)) - coalesce(v_sale.reversed_commission,0)),
    updated_at = now() where id = v_affiliate_id;
  update public.affiliate_sales set status = case when v_reason like '%chargeback%' then 'chargeback' else 'refunded' end,
    reversal_previous_status = case when v_reason like '%chargeback%' then v_sale.status else reversal_previous_status end,
    reversal_previous_commission = case when v_reason like '%chargeback%' then coalesce(v_sale.reversed_commission,0) else reversal_previous_commission end,
    reversal_previous_refunded_amount = case when v_reason like '%chargeback%' then coalesce(v_sale.refunded_amount,0) else reversal_previous_refunded_amount end,
    reversed_commission = greatest(coalesce(commission_amount,0), coalesce(commission,0)),
    refunded_amount = amount,
    updated_at = now() where id = v_sale.id;
  insert into public.affiliate_adjustments(affiliate_code, sale_id, amount, reason, stripe_event_id)
    values (v_sale.affiliate_code, v_sale.id, -greatest(0, greatest(coalesce(v_sale.commission_amount,0), coalesce(v_sale.commission,0)) - coalesce(v_sale.reversed_commission,0)), v_reason, nullif(p_stripe_event_id,''));
  return true;
end;
$$;

create or replace function public.reverse_affiliate_refund(
  p_payment_intent text,
  p_refund_amount numeric,
  p_stripe_event_id text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.affiliate_sales%rowtype;
  v_affiliate_id uuid;
  v_new_refund numeric(12,2);
  v_target_commission numeric(12,2);
  v_delta numeric(12,2);
begin
  if coalesce(p_payment_intent,'') = '' or coalesce(p_refund_amount,0) <= 0 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payment_intent, 2));
  if coalesce(p_stripe_event_id,'') <> '' then perform pg_advisory_xact_lock(hashtextextended(p_stripe_event_id, 4)); end if;
  if coalesce(p_stripe_event_id,'') <> '' and exists(select 1 from public.affiliate_adjustments where stripe_event_id=p_stripe_event_id) then return false; end if;
  select * into v_sale from public.affiliate_sales where stripe_payment_intent=p_payment_intent order by created_at desc limit 1 for update;
  if not found then return false; end if;
  if lower(coalesce(v_sale.status,'')) in ('chargeback','refunded','reversed') then return false; end if;
  v_new_refund := least(coalesce(v_sale.amount,0), coalesce(v_sale.refunded_amount,0) + p_refund_amount);
  v_target_commission := round(greatest(coalesce(v_sale.commission_amount,0),coalesce(v_sale.commission,0)) * v_new_refund / nullif(v_sale.amount,0), 2);
  v_delta := greatest(0, v_target_commission - coalesce(v_sale.reversed_commission,0));
  if v_delta <= 0 then return false; end if;
  select id into v_affiliate_id from public.users where upper(affiliate_code)=upper(v_sale.affiliate_code) for update;
  if v_affiliate_id is null then raise exception 'Afiliado da venda não encontrado'; end if;
  update public.users set affiliate_balance=coalesce(affiliate_balance,0)-v_delta, updated_at=now() where id=v_affiliate_id;
  update public.affiliate_sales set refunded_amount=v_new_refund, reversed_commission=v_target_commission,
    status=case when v_new_refund >= coalesce(amount,0) then 'refunded' else 'partially_refunded' end,
    updated_at=now() where id=v_sale.id;
  insert into public.affiliate_adjustments(affiliate_code,sale_id,amount,reason,stripe_event_id)
    values(v_sale.affiliate_code,v_sale.id,-v_delta,'partial_refund',nullif(p_stripe_event_id,''));
  return true;
end;
$$;

create or replace function public.restore_affiliate_sale(p_payment_intent text, p_stripe_event_id text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.affiliate_sales%rowtype;
  v_affiliate_id uuid;
  v_restore numeric(12,2);
  v_status text;
begin
  if coalesce(p_payment_intent,'') = '' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payment_intent, 1));
  if coalesce(p_stripe_event_id,'') <> '' then perform pg_advisory_xact_lock(hashtextextended(p_stripe_event_id, 5)); end if;
  if coalesce(p_stripe_event_id,'') <> '' and exists(select 1 from public.affiliate_adjustments where stripe_event_id=p_stripe_event_id) then return false; end if;
  select * into v_sale from public.affiliate_sales where stripe_payment_intent=p_payment_intent order by created_at desc limit 1 for update;
  if not found or lower(coalesce(v_sale.status,'')) <> 'chargeback' then return false; end if;
  v_restore := greatest(0, coalesce(v_sale.reversed_commission,0) - coalesce(v_sale.reversal_previous_commission,0));
  if v_restore <= 0 then return false; end if;
  select id into v_affiliate_id from public.users where upper(affiliate_code)=upper(v_sale.affiliate_code) for update;
  if v_affiliate_id is null then raise exception 'Afiliado da venda não encontrado'; end if;
  update public.users set affiliate_balance=coalesce(affiliate_balance,0)+v_restore, updated_at=now() where id=v_affiliate_id;
  v_status := coalesce(v_sale.reversal_previous_status,'pending');
  update public.affiliate_sales set status=v_status,
    reversed_commission=coalesce(v_sale.reversal_previous_commission,0),
    refunded_amount=coalesce(v_sale.reversal_previous_refunded_amount,0),
    reversal_previous_status=null, reversal_previous_commission=0,
    reversal_previous_refunded_amount=0, updated_at=now() where id=v_sale.id;
  insert into public.affiliate_adjustments(affiliate_code,sale_id,amount,reason,stripe_event_id)
    values(v_sale.affiliate_code,v_sale.id,v_restore,'chargeback_won',nullif(p_stripe_event_id,''));
  return true;
end;
$$;

create or replace function public.get_affiliate_click_counts()
returns table(affiliate_code text, clicks bigint)
language sql security definer set search_path = public
as $$
  select upper(c.affiliate_code), count(*)::bigint
  from public.affiliate_clicks c
  group by upper(c.affiliate_code);
$$;

revoke all on function public.record_affiliate_sale(text,text,text,text,numeric,numeric,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.mark_affiliate_paid(uuid) from public, anon, authenticated;
revoke all on function public.reverse_affiliate_sale(text,text,text) from public, anon, authenticated;
revoke all on function public.reverse_affiliate_refund(text,numeric,text) from public, anon, authenticated;
revoke all on function public.restore_affiliate_sale(text,text) from public, anon, authenticated;
revoke all on function public.get_affiliate_click_counts() from public, anon, authenticated;
grant execute on function public.record_affiliate_sale(text,text,text,text,numeric,numeric,text,text,text,text,timestamptz) to service_role;
grant execute on function public.mark_affiliate_paid(uuid) to service_role;
grant execute on function public.reverse_affiliate_sale(text,text,text) to service_role;
grant execute on function public.reverse_affiliate_refund(text,numeric,text) to service_role;
grant execute on function public.restore_affiliate_sale(text,text) to service_role;
grant execute on function public.get_affiliate_click_counts() to service_role;
