create or replace function public.list_investment_assets_for_current_user()
returns table (
  asset_id uuid,
  asset_code text,
  asset_name text,
  description text,
  latest_price_date date,
  latest_unit_price_jpy integer,
  previous_price_date date,
  previous_unit_price_jpy integer,
  daily_change_jpy integer,
  daily_change_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    ia.id as asset_id,
    ia.asset_code,
    ia.asset_name,
    ia.description,
    latest_price.price_date as latest_price_date,
    latest_price.unit_price_jpy as latest_unit_price_jpy,
    previous_price.price_date as previous_price_date,
    previous_price.unit_price_jpy as previous_unit_price_jpy,
    case
      when latest_price.unit_price_jpy is null or previous_price.unit_price_jpy is null then null
      else latest_price.unit_price_jpy - previous_price.unit_price_jpy
    end as daily_change_jpy,
    case
      when latest_price.unit_price_jpy is null
        or previous_price.unit_price_jpy is null
        or previous_price.unit_price_jpy <= 0 then null
      else round(
        (
          (latest_price.unit_price_jpy - previous_price.unit_price_jpy)::numeric /
            previous_price.unit_price_jpy::numeric
        ) * 100::numeric,
        2
      )
    end as daily_change_rate
  from public.investment_assets ia
  left join lateral (
    select iap.price_date, iap.unit_price_jpy
    from public.investment_asset_prices iap
    where iap.asset_id = ia.id
      and iap.price_date <= current_date
    order by iap.price_date desc
    limit 1
  ) latest_price on true
  left join lateral (
    select iap.price_date, iap.unit_price_jpy
    from public.investment_asset_prices iap
    where iap.asset_id = ia.id
      and latest_price.price_date is not null
      and iap.price_date < latest_price.price_date
    order by iap.price_date desc
    limit 1
  ) previous_price on true
  where ia.is_active = true
  order by ia.created_at, ia.asset_name;
end;
$$;

revoke all on function public.list_investment_assets_for_current_user()
  from public;
grant execute on function public.list_investment_assets_for_current_user()
  to authenticated;

create or replace function public.request_investment_for_allowance(
  target_allowance_grant_id uuid,
  target_asset_id uuid
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
  selected_price public.investment_asset_prices%rowtype;
  calculated_units numeric(20, 8);
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if target_asset_id is null then
    raise exception 'Investment asset is required';
  end if;

  select ag.*
    into target_grant
  from public.allowance_grants ag
  where ag.id = target_allowance_grant_id;

  if target_grant.id is null then
    raise exception 'Allowance grant not found';
  end if;

  if target_grant.child_user_id <> current_user_id then
    raise exception 'Only the target child can invest this allowance';
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

  if not exists (
    select 1
    from public.investment_assets ia
    where ia.id = target_asset_id
      and ia.is_active = true
  ) then
    raise exception 'Investment asset not found';
  end if;

  select iap.*
    into selected_price
  from public.investment_asset_prices iap
  where iap.asset_id = target_asset_id
    and iap.price_date <= current_date
  order by iap.price_date desc
  limit 1;

  if selected_price.id is null then
    raise exception 'Investment asset price not found';
  end if;

  calculated_units := round(
    (target_grant.amount_jpy::numeric * 10000::numeric) /
      selected_price.unit_price_jpy::numeric,
    8
  );

  insert into public.grant_decisions (
    allowance_grant_id,
    decision_status,
    asset_id,
    investment_price_date,
    investment_unit_price_jpy,
    investment_units,
    decided_at
  )
  values (
    target_grant.id,
    'invested'::public.grant_decision_status,
    target_asset_id,
    selected_price.price_date,
    selected_price.unit_price_jpy,
    calculated_units,
    now()
  )
  on conflict (allowance_grant_id) do update
  set decision_status = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then 'invested'::public.grant_decision_status
        else public.grant_decisions.decision_status
      end,
      asset_id = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then target_asset_id
        else public.grant_decisions.asset_id
      end,
      investment_price_date = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then selected_price.price_date
        else public.grant_decisions.investment_price_date
      end,
      investment_unit_price_jpy = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then selected_price.unit_price_jpy
        else public.grant_decisions.investment_unit_price_jpy
      end,
      investment_units = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then calculated_units
        else public.grant_decisions.investment_units
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
      and gd.decision_status <> 'invested'::public.grant_decision_status
  ) then
    raise exception 'Allowance grant has already been decided';
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

revoke all on function public.request_investment_for_allowance(uuid, uuid)
  from public;
grant execute on function public.request_investment_for_allowance(uuid, uuid)
  to authenticated;
