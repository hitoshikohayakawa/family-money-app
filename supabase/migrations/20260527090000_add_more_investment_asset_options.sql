insert into public.investment_assets (
  asset_code,
  asset_name,
  asset_category_code,
  description,
  is_active
)
values
  (
    'emaxis_slim_us_sp500',
    'eMAXIS Slim 米国株式（S&P500）',
    'index_stock',
    'アメリカの代表的な会社500社に広く投資できるインデックスファンドです。',
    true
  ),
  (
    'emaxis_slim_domestic_topix',
    'eMAXIS Slim 国内株式（TOPIX）',
    'index_stock',
    '日本の幅広い会社にまとめて投資できるインデックスファンドです。',
    true
  ),
  (
    'emaxis_slim_emerging',
    'eMAXIS Slim 新興国株式インデックス',
    'index_stock',
    'これから成長していく国々の会社へ幅広く投資できるインデックスファンドです。',
    true
  ),
  (
    'gold_spot_asset',
    '金（ゴールド）',
    'resource',
    '世界で価値を認められている金です。景気や不安が強いときに注目されやすい資産です。',
    true
  ),
  (
    'silver_spot_asset',
    '銀（シルバー）',
    'resource',
    '貴金属のひとつで、工業用途にも使われる現物系の資産です。',
    true
  ),
  (
    'bitcoin_crypto',
    'ビットコイン',
    'crypto',
    '代表的な仮想通貨です。世界中で売買されていて、値動きが大きい特徴があります。',
    true
  ),
  (
    'ethereum_crypto',
    'イーサリアム',
    'crypto',
    'アプリやサービスの土台にも使われる代表的な仮想通貨です。',
    true
  )
on conflict (asset_code) do update
set asset_name = excluded.asset_name,
    asset_category_code = excluded.asset_category_code,
    description = excluded.description,
    is_active = excluded.is_active;

insert into public.investment_asset_prices (
  asset_id,
  price_date,
  unit_price_jpy,
  source
)
select
  ia.id,
  seed.price_date,
  seed.unit_price_jpy,
  seed.source
from public.investment_assets ia
join (
  values
    ('emaxis_slim_us_sp500', '2026-05-21'::date, 35912, 'seed_manual:index_sp500:2026-05-21'),
    ('emaxis_slim_us_sp500', '2026-05-22'::date, 36084, 'seed_manual:index_sp500:2026-05-22'),
    ('emaxis_slim_domestic_topix', '2026-05-21'::date, 21456, 'seed_manual:index_topix:2026-05-21'),
    ('emaxis_slim_domestic_topix', '2026-05-22'::date, 21520, 'seed_manual:index_topix:2026-05-22'),
    ('emaxis_slim_emerging', '2026-05-21'::date, 18240, 'seed_manual:index_emerging:2026-05-21'),
    ('emaxis_slim_emerging', '2026-05-22'::date, 18355, 'seed_manual:index_emerging:2026-05-22'),
    ('gold_spot_asset', '2026-05-21'::date, 15420, 'seed_manual:gold:2026-05-21'),
    ('gold_spot_asset', '2026-05-22'::date, 15580, 'seed_manual:gold:2026-05-22'),
    ('silver_spot_asset', '2026-05-21'::date, 17680, 'seed_manual:silver:2026-05-21'),
    ('silver_spot_asset', '2026-05-22'::date, 17810, 'seed_manual:silver:2026-05-22'),
    ('bitcoin_crypto', '2026-05-21'::date, 15820000, 'seed_manual:bitcoin:2026-05-21'),
    ('bitcoin_crypto', '2026-05-22'::date, 16010000, 'seed_manual:bitcoin:2026-05-22'),
    ('ethereum_crypto', '2026-05-21'::date, 458000, 'seed_manual:ethereum:2026-05-21'),
    ('ethereum_crypto', '2026-05-22'::date, 472000, 'seed_manual:ethereum:2026-05-22')
) as seed(asset_code, price_date, unit_price_jpy, source)
  on seed.asset_code = ia.asset_code
on conflict (asset_id, price_date) do update
set unit_price_jpy = excluded.unit_price_jpy,
    source = excluded.source;

drop function if exists public.list_investment_assets_for_current_user();

create function public.list_investment_assets_for_current_user()
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
