-- Switch list_allowance_grants_for_current_user to use family_memberships for user lookup.
-- This matches list_family_members_for_current_user which also uses family_memberships.
-- Previously used family_members, which could diverge from family_memberships if
-- family_members rows are deleted while family_memberships rows remain.

create or replace function public.list_allowance_grants_for_current_user()
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
  decision_asset_id uuid,
  decision_asset_code text,
  decision_asset_name text,
  investment_price_date date,
  investment_unit_price_jpy integer,
  investment_units numeric,
  latest_price_date date,
  latest_unit_price_jpy integer,
  current_value_jpy integer,
  unrealized_gain_jpy integer,
  unrealized_gain_rate numeric,
  cashout_request_id uuid,
  cashout_status text,
  cashout_requested_amount_jpy integer,
  cashout_requested_at timestamptz,
  cashout_paid_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_family_id uuid;
  current_role text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fms.family_id, fms.role::text
    into current_family_id, current_role
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status = 'active'
  limit 1;

  if current_family_id is null then
    return;
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
    coalesce(gd.decision_status, 'pending'::public.grant_decision_status)::text as decision_status,
    gd.asset_id as decision_asset_id,
    ia.asset_code as decision_asset_code,
    ia.asset_name as decision_asset_name,
    gd.investment_price_date,
    gd.investment_unit_price_jpy,
    gd.investment_units,
    latest_price.price_date as latest_price_date,
    latest_price.unit_price_jpy as latest_unit_price_jpy,
    case
      when gd.investment_units is null or latest_price.unit_price_jpy is null then null
      else round((gd.investment_units * latest_price.unit_price_jpy::numeric) / 10000::numeric)::integer
    end as current_value_jpy,
    case
      when gd.investment_units is null or latest_price.unit_price_jpy is null then null
      else round((gd.investment_units * latest_price.unit_price_jpy::numeric) / 10000::numeric)::integer - ag.amount_jpy
    end as unrealized_gain_jpy,
    case
      when gd.investment_units is null or latest_price.unit_price_jpy is null or ag.amount_jpy <= 0 then null
      else round(
        (
          (
            round((gd.investment_units * latest_price.unit_price_jpy::numeric) / 10000::numeric)::integer
              - ag.amount_jpy
          )::numeric / ag.amount_jpy::numeric
        ) * 100::numeric,
        2
      )
    end as unrealized_gain_rate,
    acr.id as cashout_request_id,
    acr.status as cashout_status,
    acr.requested_amount_jpy as cashout_requested_amount_jpy,
    acr.requested_at as cashout_requested_at,
    acr.paid_at as cashout_paid_at,
    gd.decided_at,
    ag.created_at
  from public.allowance_grants ag
  left join public.grant_decisions gd
    on gd.allowance_grant_id = ag.id
  left join public.investment_assets ia
    on ia.id = gd.asset_id
  left join lateral (
    select iap.price_date, iap.unit_price_jpy
    from public.investment_asset_prices iap
    where iap.asset_id = gd.asset_id
      and iap.price_date <= current_date
    order by iap.price_date desc
    limit 1
  ) latest_price on true
  left join public.allowance_cashout_request_items acri
    on acri.allowance_grant_id = ag.id
  left join public.allowance_cashout_requests acr
    on acr.id = acri.cashout_request_id
  left join public.profiles child_profile
    on child_profile.id = ag.child_user_id
  left join public.profiles guardian_profile
    on guardian_profile.id = ag.granted_by_user_id
  where ag.family_id = current_family_id
    and (
      current_role in ('guardian_admin', 'guardian')
      or ag.child_user_id = current_user_id
    )
  order by ag.granted_at desc, ag.created_at desc;
end;
$$;

revoke all on function public.list_allowance_grants_for_current_user()
  from public;
grant execute on function public.list_allowance_grants_for_current_user()
  to authenticated;
