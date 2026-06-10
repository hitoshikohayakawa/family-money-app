-- 米国個別株 3 銘柄を investment_assets に追加
-- Apple (AAPL) / Amazon (AMZN) / NVIDIA (NVDA)
-- 価格は USD 建て → JPY 換算。実際の同期は sync-market-prices / sync-daily-prices で行う。

insert into public.investment_assets (
  asset_code,
  asset_name,
  asset_category_code,
  description,
  market_symbol,
  is_active
)
values
  (
    'apple_stock',
    'アップル',
    'single_stock',
    'iPhone や Mac を作っているアメリカの大きなテクノロジー会社です。',
    'AAPL',
    true
  ),
  (
    'amazon_stock',
    'アマゾン',
    'single_stock',
    'ネット通販やクラウドサービスで世界中に広がっているアメリカの大手テクノロジー会社です。',
    'AMZN',
    true
  ),
  (
    'nvidia_stock',
    'エヌビディア',
    'single_stock',
    'AI やゲームに使われるチップ（半導体）を作っているアメリカの会社です。',
    'NVDA',
    true
  )
on conflict (asset_code) do update
set asset_name          = excluded.asset_name,
    asset_category_code = excluded.asset_category_code,
    description         = excluded.description,
    market_symbol       = excluded.market_symbol,
    is_active           = excluded.is_active;

-- シード価格（2026-06-05 / 2026-06-09 の概算 JPY 換算値）
-- 実際の価格は prices:sync:market / prices:sync で自動更新される
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
    ('apple_stock',  '2026-06-05'::date, 32100, 'seed_manual:AAPL:2026-06-05'),
    ('apple_stock',  '2026-06-09'::date, 32400, 'seed_manual:AAPL:2026-06-09'),
    ('amazon_stock', '2026-06-05'::date, 34700, 'seed_manual:AMZN:2026-06-05'),
    ('amazon_stock', '2026-06-09'::date, 35000, 'seed_manual:AMZN:2026-06-09'),
    ('nvidia_stock', '2026-06-05'::date, 21000, 'seed_manual:NVDA:2026-06-05'),
    ('nvidia_stock', '2026-06-09'::date, 21400, 'seed_manual:NVDA:2026-06-09')
) as seed(asset_code, price_date, unit_price_jpy, source)
  on seed.asset_code = ia.asset_code
on conflict (asset_id, price_date) do update
set unit_price_jpy = excluded.unit_price_jpy,
    source         = excluded.source;
