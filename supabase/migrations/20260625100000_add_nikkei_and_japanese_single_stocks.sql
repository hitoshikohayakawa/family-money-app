-- インデックス 1 件（日経平均）と日本の個別株 7 件を investment_assets に追加する。
--
-- インデックス:
--   日経平均 (^N225) — 日本を代表する 225 社の平均株価（円建て指数値）
--
-- 個別株（東証プライム・円建て）:
--   サンリオ(8136.T) / セガサミー(6460.T) / くら寿司(2695.T) /
--   リクルート(6098.T) / コナミHD(9766.T) / イオン(8267.T) / ソフトバンクG(9984.T)
--
-- 価格は Yahoo Finance から prices:sync / prices:sync:market で自動更新される。
-- 下のシード価格は初期表示用の概算値で、同期実行時に上書きされる。

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
    'nikkei225_index',
    '日経平均',
    'index_stock',
    '日本を代表する225社の株価をまとめた、日本の景気を知る目安になる指数です。',
    '^N225',
    true
  ),
  (
    'sanrio_stock',
    'サンリオ',
    'single_stock',
    'ハローキティなど人気のキャラクターを生み出している日本の会社です。',
    '8136.T',
    true
  ),
  (
    'sega_sammy_stock',
    'セガサミー',
    'single_stock',
    'ゲームソフトや遊ぶ機械（アミューズメント）を作っている日本の会社です。',
    '6460.T',
    true
  ),
  (
    'kura_sushi_stock',
    'くら寿司',
    'single_stock',
    '回転寿司のお店を全国に広げている日本の会社です。',
    '2695.T',
    true
  ),
  (
    'recruit_holdings_stock',
    'リクルート',
    'single_stock',
    '求人情報や予約サービスなどを手がける日本の会社です。',
    '6098.T',
    true
  ),
  (
    'konami_group_stock',
    'コナミホールディングス',
    'single_stock',
    'ゲームやスポーツクラブなど、いろいろな事業を持つ日本の会社です。',
    '9766.T',
    true
  ),
  (
    'aeon_stock',
    'イオン',
    'single_stock',
    '全国にスーパーやショッピングモールを持つ日本の小売の会社です。',
    '8267.T',
    true
  ),
  (
    'softbank_group_stock',
    'ソフトバンクグループ',
    'single_stock',
    '通信や、世界中の会社への投資を手がける日本の大きな会社です。',
    '9984.T',
    true
  )
on conflict (asset_code) do update
set asset_name          = excluded.asset_name,
    asset_category_code = excluded.asset_category_code,
    description         = excluded.description,
    market_symbol       = excluded.market_symbol,
    is_active           = excluded.is_active;

-- シード価格（2026-06-23 / 2026-06-24 の概算値）。実値は同期スクリプトで上書きされる。
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
    ('nikkei225_index',        '2026-06-23'::date, 38450, 'seed_manual:^N225:2026-06-23'),
    ('nikkei225_index',        '2026-06-24'::date, 38620, 'seed_manual:^N225:2026-06-24'),
    ('sanrio_stock',           '2026-06-23'::date,  6280, 'seed_manual:8136.T:2026-06-23'),
    ('sanrio_stock',           '2026-06-24'::date,  6320, 'seed_manual:8136.T:2026-06-24'),
    ('sega_sammy_stock',       '2026-06-23'::date,  2710, 'seed_manual:6460.T:2026-06-23'),
    ('sega_sammy_stock',       '2026-06-24'::date,  2735, 'seed_manual:6460.T:2026-06-24'),
    ('kura_sushi_stock',       '2026-06-23'::date,  4180, 'seed_manual:2695.T:2026-06-23'),
    ('kura_sushi_stock',       '2026-06-24'::date,  4205, 'seed_manual:2695.T:2026-06-24'),
    ('recruit_holdings_stock', '2026-06-23'::date,  9760, 'seed_manual:6098.T:2026-06-23'),
    ('recruit_holdings_stock', '2026-06-24'::date,  9820, 'seed_manual:6098.T:2026-06-24'),
    ('konami_group_stock',     '2026-06-23'::date, 17950, 'seed_manual:9766.T:2026-06-23'),
    ('konami_group_stock',     '2026-06-24'::date, 18080, 'seed_manual:9766.T:2026-06-24'),
    ('aeon_stock',             '2026-06-23'::date,  4290, 'seed_manual:8267.T:2026-06-23'),
    ('aeon_stock',             '2026-06-24'::date,  4310, 'seed_manual:8267.T:2026-06-24'),
    ('softbank_group_stock',   '2026-06-23'::date,  9480, 'seed_manual:9984.T:2026-06-23'),
    ('softbank_group_stock',   '2026-06-24'::date,  9550, 'seed_manual:9984.T:2026-06-24')
) as seed(asset_code, price_date, unit_price_jpy, source)
  on seed.asset_code = ia.asset_code
on conflict (asset_id, price_date) do update
set unit_price_jpy = excluded.unit_price_jpy,
    source         = excluded.source;
