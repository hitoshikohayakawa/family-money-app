-- investment_assets に Yahoo Finance 用シンボルを追加する
-- 日本株のみ設定。インデックスファンド・コモディティ・仮想通貨は
-- Yahoo Finance からの日次ヒストリカルデータ取得対象外のため NULL のまま。

ALTER TABLE public.investment_assets
  ADD COLUMN IF NOT EXISTS market_symbol text;

-- 日本株 3 銘柄
UPDATE public.investment_assets SET market_symbol = '7974.T' WHERE asset_code = 'nintendo_stock';
UPDATE public.investment_assets SET market_symbol = '7203.T' WHERE asset_code = 'toyota_motor_stock';
UPDATE public.investment_assets SET market_symbol = '6758.T' WHERE asset_code = 'sony_group_stock';
