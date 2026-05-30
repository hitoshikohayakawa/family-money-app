-- Add granted_by_user_id to cashout requests so each request is tied to a specific guardian.
-- This enables per-guardian notifications and restricts mark-as-paid to the granting guardian.

alter table public.allowance_cashout_requests
  add column if not exists granted_by_user_id uuid references auth.users(id) on delete restrict;

-- Update request_immediate_cash_for_allowance: store granted_by_user_id from the grant
create or replace function public.request_immediate_cash_for_allowance(
  target_allowance_grant_id uuid
)
returns table (
  id uuid,
  family_id uuid,
  child_user_id uuid,
  child_email text,
  child_display_label text,
  granted_by_user_id uuid,
  granted_by_email text,
  granted_by_display_label text,
  amount_jpy integer,
  note text,
  granted_at timestamptz,
  decision_status text,
  decided_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_grant public.allowance_grants%rowtype;
  new_request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ag.*
    into target_grant
  from public.allowance_grants ag
  where ag.id = target_allowance_grant_id;

  if target_grant.id is null then
    raise exception 'Allowance grant not found';
  end if;

  if target_grant.child_user_id <> current_user_id then
    raise exception 'Only the invited child can request immediate cash for this allowance';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_grant.family_id
      and fm.user_id = current_user_id
      and fm.role = 'child'
  ) then
    raise exception 'Child membership not found';
  end if;

  insert into public.grant_decisions (
    allowance_grant_id,
    decision_status,
    decided_at
  )
  values (
    target_grant.id,
    'immediate_cash_requested'::public.grant_decision_status,
    now()
  )
  on conflict (allowance_grant_id) do update
  set decision_status = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then 'immediate_cash_requested'::public.grant_decision_status
        else public.grant_decisions.decision_status
      end,
      decided_at = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then now()
        else public.grant_decisions.decided_at
      end;

  if exists (
    select 1
    from public.grant_decisions gd
    where gd.allowance_grant_id = target_grant.id
      and gd.decision_status <> 'immediate_cash_requested'::public.grant_decision_status
  ) then
    raise exception 'Allowance grant has already been decided';
  end if;

  if not exists (
    select 1
    from public.allowance_cashout_request_items acri
    where acri.allowance_grant_id = target_grant.id
  ) then
    insert into public.allowance_cashout_requests (
      family_id,
      child_user_id,
      requested_by_user_id,
      granted_by_user_id,
      request_kind,
      requested_amount_jpy
    )
    values (
      target_grant.family_id,
      current_user_id,
      current_user_id,
      target_grant.granted_by_user_id,
      'immediate_cash',
      target_grant.amount_jpy
    )
    returning id into new_request_id;

    insert into public.allowance_cashout_request_items (
      cashout_request_id,
      allowance_grant_id,
      amount_jpy
    )
    values (
      new_request_id,
      target_grant.id,
      target_grant.amount_jpy
    );
  end if;

  return query
  select
    ag.id,
    ag.family_id,
    ag.child_user_id,
    child_profile.email as child_email,
    coalesce(
      nullif(child_profile.display_name, ''),
      child_profile.email,
      ag.child_user_id::text
    ) as child_display_label,
    ag.granted_by_user_id,
    guardian_profile.email as granted_by_email,
    coalesce(
      nullif(guardian_profile.display_name, ''),
      guardian_profile.email,
      ag.granted_by_user_id::text
    ) as granted_by_display_label,
    ag.amount_jpy,
    ag.note,
    ag.granted_at,
    gd.decision_status::text as decision_status,
    gd.decided_at,
    ag.created_at
  from public.allowance_grants ag
  join public.grant_decisions gd
    on gd.allowance_grant_id = ag.id
  left join public.profiles child_profile
    on child_profile.id = ag.child_user_id
  left join public.profiles guardian_profile
    on guardian_profile.id = ag.granted_by_user_id
  where ag.id = target_grant.id;
end;
$$;

revoke all on function public.request_immediate_cash_for_allowance(uuid)
  from public;
grant execute on function public.request_immediate_cash_for_allowance(uuid)
  to authenticated;


-- Update request_cashout_for_allowances:
--   - validates all grants are from the same guardian
--   - stores granted_by_user_id in the cashout request
create or replace function public.request_cashout_for_allowances(
  target_allowance_grant_ids uuid[]
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
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_ids uuid[];
  target_family_id uuid;
  target_count integer;
  total_amount integer;
  new_request_id uuid;
  guardian_user_id uuid;
  guardian_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select array_agg(distinct id)
    into normalized_ids
  from unnest(coalesce(target_allowance_grant_ids, array[]::uuid[])) as id
  where id is not null;

  if normalized_ids is null or array_length(normalized_ids, 1) is null then
    raise exception 'Cashout target is empty';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.user_id = current_user_id
      and fm.role = 'child'
  ) then
    raise exception 'Only children can request cashout';
  end if;

  if exists (
    select 1
    from public.allowance_cashout_request_items acri
    where acri.allowance_grant_id = any(normalized_ids)
  ) then
    raise exception 'One or more allowance grants have already been requested for cashout';
  end if;

  -- All grants in one call must belong to the same guardian
  select count(distinct ag.granted_by_user_id)
    into guardian_count
  from public.allowance_grants ag
  where ag.id = any(normalized_ids);

  if guardian_count > 1 then
    raise exception 'All grants in a single cashout request must be from the same guardian';
  end if;

  select ag.granted_by_user_id
    into guardian_user_id
  from public.allowance_grants ag
  where ag.id = any(normalized_ids)
  limit 1;

  with eligible as (
    select
      ag.id,
      ag.family_id,
      ag.child_user_id,
      coalesce(gd.decision_status, 'pending'::public.grant_decision_status)::text as decision_status,
      case
        when gd.decision_status = 'invested'::public.grant_decision_status
          and gd.investment_units is not null
          and latest_price.unit_price_jpy is not null
          then round((gd.investment_units * latest_price.unit_price_jpy::numeric) / 10000::numeric)::integer
        else ag.amount_jpy
      end as request_amount
    from public.allowance_grants ag
    join public.grant_decisions gd
      on gd.allowance_grant_id = ag.id
    left join lateral (
      select iap.unit_price_jpy
      from public.investment_asset_prices iap
      where iap.asset_id = gd.asset_id
        and iap.price_date <= current_date
      order by iap.price_date desc
      limit 1
    ) latest_price on true
    where ag.id = any(normalized_ids)
      and ag.child_user_id = current_user_id
      and gd.decision_status = 'invested'::public.grant_decision_status
  )
  select count(*), min(family_id), sum(request_amount)
    into target_count, target_family_id, total_amount
  from eligible;

  if target_count <> array_length(normalized_ids, 1) then
    raise exception 'Cashout targets must be invested allowances owned by the current child';
  end if;

  if total_amount is null or total_amount <= 0 then
    raise exception 'Cashout amount must be positive';
  end if;

  insert into public.allowance_cashout_requests (
    family_id,
    child_user_id,
    requested_by_user_id,
    granted_by_user_id,
    request_kind,
    requested_amount_jpy
  )
  values (
    target_family_id,
    current_user_id,
    current_user_id,
    guardian_user_id,
    'investment_cashout',
    total_amount
  )
  returning id into new_request_id;

  insert into public.allowance_cashout_request_items (
    cashout_request_id,
    allowance_grant_id,
    amount_jpy
  )
  select
    new_request_id,
    eligible.id,
    eligible.request_amount
  from (
    select
      ag.id,
      case
        when gd.investment_units is not null and latest_price.unit_price_jpy is not null
          then round((gd.investment_units * latest_price.unit_price_jpy::numeric) / 10000::numeric)::integer
        else ag.amount_jpy
      end as request_amount
    from public.allowance_grants ag
    join public.grant_decisions gd
      on gd.allowance_grant_id = ag.id
    left join lateral (
      select iap.unit_price_jpy
      from public.investment_asset_prices iap
      where iap.asset_id = gd.asset_id
        and iap.price_date <= current_date
      order by iap.price_date desc
      limit 1
    ) latest_price on true
    where ag.id = any(normalized_ids)
  ) eligible;

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
    acr.requested_at
  from public.allowance_cashout_requests acr
  left join public.profiles child_profile
    on child_profile.id = acr.child_user_id
  where acr.id = new_request_id;
end;
$$;

revoke all on function public.request_cashout_for_allowances(uuid[])
  from public;
grant execute on function public.request_cashout_for_allowances(uuid[])
  to authenticated;


-- Update mark_allowance_cashout_paid:
--   - guardian can only mark paid for their own requests
--   - guardian_admin can mark paid for any request
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

  -- Must be a guardian in the family
  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_request.family_id
      and fm.user_id = current_user_id
      and fm.role in ('guardian_admin', 'guardian')
  ) then
    raise exception 'Only guardians can mark cashout paid';
  end if;

  -- If granted_by_user_id is set, only that guardian or a guardian_admin may mark paid
  if target_request.granted_by_user_id is not null
    and target_request.granted_by_user_id <> current_user_id
  then
    if not exists (
      select 1
      from public.family_members fm
      where fm.family_id = target_request.family_id
        and fm.user_id = current_user_id
        and fm.role = 'guardian_admin'
    ) then
      raise exception 'Only the guardian who granted this allowance (or a guardian_admin) can mark it as paid';
    end if;
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
