-- TubeX: one-time affiliate code generation.
-- Apply in Supabase SQL Editor before deploying this release.
-- Existing affiliate codes are preserved and remain locked.

create or replace function public.generate_tubex_affiliate_code_once(
  p_user_id uuid,
  p_code text
)
returns table(affiliate_code text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_candidate text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
begin
  if p_user_id is null or length(v_candidate) < 6 or length(v_candidate) > 24 then
    raise exception 'Código de afiliado inválido';
  end if;

  select u.affiliate_code into v_existing
    from public.users u
   where u.id = p_user_id
   for update;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  -- Once assigned, a code can only be changed manually by support/admin.
  if v_existing is not null and length(trim(v_existing)) > 0 then
    return query select upper(v_existing), false;
    return;
  end if;

  -- A collision is reported to the API, which generates a new random candidate.
  if exists (
    select 1 from public.users u
     where upper(u.affiliate_code) = v_candidate
  ) then
    return query select null::text, false;
    return;
  end if;

  update public.users
     set affiliate_code = v_candidate,
         updated_at = now()
   where id = p_user_id
     and (affiliate_code is null or length(trim(affiliate_code)) = 0);

  select upper(u.affiliate_code) into v_existing
    from public.users u
   where u.id = p_user_id;

  return query select v_existing, (v_existing = v_candidate);
exception
  when unique_violation then
    -- Protect against a simultaneous assignment to a different account.
    return query select null::text, false;
end;
$$;

revoke all on function public.generate_tubex_affiliate_code_once(uuid, text)
  from public, anon, authenticated;
grant execute on function public.generate_tubex_affiliate_code_once(uuid, text)
  to service_role;
