-- TubeX: distributed Groq TPM guard shared by every production serverless instance.
-- Apply this migration in Supabase SQL Editor before deploying the application.
create table if not exists public.tubex_groq_token_reservations (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  reserved_tokens integer not null check (reserved_tokens > 0),
  created_at timestamptz not null default now()
);

create index if not exists tubex_groq_token_reservations_model_created_idx
  on public.tubex_groq_token_reservations (model, created_at);

alter table public.tubex_groq_token_reservations enable row level security;
revoke all on public.tubex_groq_token_reservations from anon, authenticated;
grant all on public.tubex_groq_token_reservations to service_role;

create or replace function public.reserve_tubex_groq_tokens(
  p_model text,
  p_token_limit integer,
  p_requested_tokens integer,
  p_window_seconds integer default 60
)
returns table(allowed boolean, reservation_id uuid, used_tokens integer, wait_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_oldest timestamptz;
  v_wait integer;
  v_window integer := greatest(15, least(coalesce(p_window_seconds, 60), 120));
  v_requested integer := greatest(1, p_requested_tokens);
  v_limit integer := greatest(1, p_token_limit);
  v_id uuid;
begin
  -- Serialize reservations for this model across all Vercel instances.
  perform pg_advisory_xact_lock(hashtextextended('tubex-groq:' || coalesce(p_model, 'default'), 0));

  delete from public.tubex_groq_token_reservations
   where model = p_model
     and created_at < now() - make_interval(secs => v_window::double precision);

  select coalesce(sum(r.reserved_tokens), 0)::integer, min(r.created_at)
    into v_used, v_oldest
    from public.tubex_groq_token_reservations r
   where r.model = p_model
     and r.created_at >= now() - make_interval(secs => v_window::double precision);

  if v_used + v_requested <= v_limit then
    insert into public.tubex_groq_token_reservations(model, reserved_tokens)
    values (p_model, v_requested)
    returning id into v_id;

    return query select true, v_id, v_used + v_requested, 0;
  else
    v_wait := case
      when v_oldest is null then v_window
      else greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => v_window::double precision) - now())))::integer)
    end;
    return query select false, null::uuid, v_used, v_wait;
  end if;
end;
$$;

create or replace function public.settle_tubex_groq_tokens(
  p_reservation_id uuid,
  p_actual_tokens integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tubex_groq_token_reservations
     set reserved_tokens = greatest(1, p_actual_tokens)
   where id = p_reservation_id;
$$;

create or replace function public.release_tubex_groq_tokens(p_reservation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.tubex_groq_token_reservations
   where id = p_reservation_id;
$$;

revoke all on function public.reserve_tubex_groq_tokens(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.settle_tubex_groq_tokens(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_tubex_groq_tokens(uuid) from public, anon, authenticated;
grant execute on function public.reserve_tubex_groq_tokens(text, integer, integer, integer) to service_role;
grant execute on function public.settle_tubex_groq_tokens(uuid, integer) to service_role;
grant execute on function public.release_tubex_groq_tokens(uuid) to service_role;
