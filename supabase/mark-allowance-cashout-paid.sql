create or replace function public.mark_allowance_cashout_paid(
  target_cashout_request_id uuid
)
returns table (
  cashout_request_id uuid,
  family_id uuid,
  child_user_id uuid,
  child_email text,
  child_display_label text,
  requested_amount_jpy integer,
  request_kind text,
  status text,
  requested_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_request public.allowance_cashout_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select acr.*
    into target_request
  from public.allowance_cashout_requests acr
  where acr.id = target_cashout_request_id;

  if target_request.id is null then
    raise exception 'Cashout request not found';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_request.family_id
      and fm.user_id = current_user_id
      and fm.role in ('guardian_admin', 'guardian')
  ) then
    raise exception 'Only guardians can mark cashout paid';
  end if;

  if target_request.status <> 'requested' then
    raise exception 'Cashout request has already been handled';
  end if;

  update public.allowance_cashout_requests
  set
    status = 'paid',
    paid_by_user_id = current_user_id,
    paid_at = now(),
    updated_at = now()
  where id = target_cashout_request_id;

  return query
  select
    acr.id,
    acr.family_id,
    acr.child_user_id,
    child_profile.email,
    coalesce(nullif(child_profile.display_name, ''), child_profile.email, acr.child_user_id::text),
    acr.requested_amount_jpy,
    acr.request_kind,
    acr.status,
    acr.requested_at,
    acr.paid_at
  from public.allowance_cashout_requests acr
  left join public.profiles child_profile
    on child_profile.id = acr.child_user_id
  where acr.id = target_cashout_request_id;
end;
$$;

revoke all on function public.mark_allowance_cashout_paid(uuid)
  from public;
grant execute on function public.mark_allowance_cashout_paid(uuid)
  to authenticated;
