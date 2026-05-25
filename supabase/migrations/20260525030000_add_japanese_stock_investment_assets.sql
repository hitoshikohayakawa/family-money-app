insert into public.investment_assets (
  asset_code,
  asset_name,
  description,
  is_active
)
values
  (
    'toyota_motor_stock',
    'トヨタ自動車',
    '日本の大きな自動車会社です。車をたくさん作って世界で売っています。',
    true
  ),
  (
    'nintendo_stock',
    '任天堂',
    'ゲーム機やゲームソフトで知られる日本の会社です。',
    true
  ),
  (
    'sony_group_stock',
    'ソニーグループ',
    'ゲーム、音楽、映画、半導体など、いろいろな事業を持つ日本の会社です。',
    true
  )
on conflict (asset_code) do update
set asset_name = excluded.asset_name,
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
    ('toyota_motor_stock', '2026-05-21'::date, 2978, 'seed_yahoo_finance_jp:7203.T:2026-05-21'),
    ('toyota_motor_stock', '2026-05-22'::date, 2987, 'seed_yahoo_finance_jp:7203.T:2026-05-22'),
    ('nintendo_stock', '2026-05-21'::date, 7274, 'seed_yahoo_finance_jp:7974.T:2026-05-21'),
    ('nintendo_stock', '2026-05-22'::date, 7240, 'seed_yahoo_finance_jp:7974.T:2026-05-22'),
    ('sony_group_stock', '2026-05-21'::date, 3554, 'seed_yahoo_finance_jp:6758.T:2026-05-21'),
    ('sony_group_stock', '2026-05-22'::date, 3525, 'seed_yahoo_finance_jp:6758.T:2026-05-22')
) as seed(asset_code, price_date, unit_price_jpy, source)
  on seed.asset_code = ia.asset_code
on conflict (asset_id, price_date) do update
set unit_price_jpy = excluded.unit_price_jpy,
    source = excluded.source;
