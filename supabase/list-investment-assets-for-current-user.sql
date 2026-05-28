create or replace function public.list_investment_assets_for_current_user()
returns table (
  asset_id uuid,
  asset_code text,
  asset_name text,
  asset_category_code text,
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
    ia.asset_category_code,
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
  order by
    case ia.asset_category_code
      when 'index_stock' then 1
      when 'single_stock' then 2
      when 'resource' then 3
      when 'crypto' then 4
      else 99
    end,
    ia.created_at,
    ia.asset_name;
end;
$$;

revoke all on function public.list_investment_assets_for_current_user()
  from public;
grant execute on function public.list_investment_assets_for_current_user()
  to authenticated;
