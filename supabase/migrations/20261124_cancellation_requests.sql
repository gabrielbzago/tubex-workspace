-- TubeX: histórico de solicitações de cancelamento e agendamento Stripe.
-- As operações são feitas exclusivamente pelas rotas de servidor com service role.
create extension if not exists pgcrypto;

create table if not exists public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_email text not null,
  account_name text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text not null,
  reason text not null,
  feedback text,
  improvement text,
  would_return text,
  status text not null default 'processing'
    check (status in ('processing', 'scheduled', 'completed', 'failed')),
  stripe_cancel_scheduled boolean not null default false,
  period_end timestamptz,
  completed_at timestamptz,
  failure_reason text,
  owner_email_sent boolean not null default false,
  user_email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cancellation_requests_user_created_idx
  on public.cancellation_requests (user_id, created_at desc);

create index if not exists cancellation_requests_status_created_idx
  on public.cancellation_requests (status, created_at desc);

create index if not exists cancellation_requests_subscription_idx
  on public.cancellation_requests (stripe_subscription_id);

-- Impede solicitações simultâneas duplicadas para a mesma conta.
create unique index if not exists cancellation_requests_one_open_per_user_idx
  on public.cancellation_requests (user_id)
  where status in ('processing', 'scheduled');

alter table public.cancellation_requests enable row level security;

-- Não permitir leitura ou escrita direta pelo navegador.
revoke all on public.cancellation_requests from anon, authenticated;
grant all on public.cancellation_requests to service_role;
