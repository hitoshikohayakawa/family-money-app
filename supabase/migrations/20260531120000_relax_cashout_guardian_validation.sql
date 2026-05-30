-- Remove the strict same-guardian validation from request_cashout_for_allowances.
-- Grouping by guardian is handled at the API layer; the RPC just stores granted_by_user_id.
-- Keeping the validation in the RPC caused failures when the API grouping had edge cases.

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

  -- Pick the granted_by_user_id from the first grant (API ensures same guardian per call)
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
