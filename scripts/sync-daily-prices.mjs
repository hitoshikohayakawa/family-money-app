/**
 * sync-daily-prices.mjs
 *
 * 全投資銘柄の直近90日分の日次終値を取得し
 * investment_asset_prices に upsert する。
 *
 * 取得元:
 *   日本株        — Yahoo Finance (7974.T / 7203.T / 6758.T)
 *   仮想通貨      — Yahoo Finance (BTC-JPY / ETH-JPY)
 *   コモディティ  — Yahoo Finance 先物(GC=F / SI=F) + USDJPY=X 換算
 *   eMAXIS Slim   — MUFG Bank CSV 全履歴行
 *
 * Usage:
 *   npm run prices:sync
 *   PRICE_SYNC_DRY_RUN=1 npm run prices:sync
 *
 * Required env vars (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or TEST_SUPABASE_SERVICE_ROLE_KEY)
 */

import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";
import YahooFinance from "yahoo-finance2";
import { parseAllPrices } from "./all-country-price-source.mjs";

// ── Config ────────────────────────────────────────────────────────────────────

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = ["1", "true", "yes"].includes(
  (process.env.PRICE_SYNC_DRY_RUN ?? "").toLowerCase()
);
const TROY_OZ_TO_GRAM = 31.1035;
const MUFG_CSV_BASE = "https://fs.bk.mufg.jp/webasp/mufg/fund/detail/chart/csv";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。");
  process.exit(1);
}

// ── 銘柄定義 ──────────────────────────────────────────────────────────────────

/** 日本株: Yahoo Finance から直接 JPY 価格を取得 */
const STOCKS = [
  { asset_code: "nintendo_stock",        market_symbol: "7974.T" },
  { asset_code: "toyota_motor_stock",    market_symbol: "7203.T" },
  { asset_code: "sony_group_stock",      market_symbol: "6758.T" },
  { asset_code: "sanrio_stock",          market_symbol: "8136.T" },
  { asset_code: "sega_sammy_stock",      market_symbol: "6460.T" },
  { asset_code: "kura_sushi_stock",      market_symbol: "2695.T" },
  { asset_code: "recruit_holdings_stock", market_symbol: "6098.T" },
  { asset_code: "konami_group_stock",    market_symbol: "9766.T" },
  { asset_code: "aeon_stock",            market_symbol: "8267.T" },
  { asset_code: "softbank_group_stock",  market_symbol: "9984.T" },
];

/** 日本の株価指数: Yahoo Finance から直接 JPY（円建て指数値）を取得 */
const JP_INDICES = [
  { asset_code: "nikkei225_index", market_symbol: "^N225" },
];

/** 仮想通貨: Yahoo Finance BTC-JPY / ETH-JPY (すでに円建て) */
const CRYPTO = [
  { asset_code: "bitcoin_crypto",  market_symbol: "BTC-JPY" },
  { asset_code: "ethereum_crypto", market_symbol: "ETH-JPY" },
];

/** 米国株: Yahoo Finance USD建て + USDJPY で円換算 (1株あたり JPY) */
const US_STOCKS = [
  { asset_code: "apple_stock",  market_symbol: "AAPL" },
  { asset_code: "amazon_stock", market_symbol: "AMZN" },
  { asset_code: "nvidia_stock", market_symbol: "NVDA" },
];

/** コモディティ: USD建て先物 + USDJPY で円換算 (円/g) */
const COMMODITIES = [
  { asset_code: "gold_spot_asset",   market_symbol: "GC=F" },
  { asset_code: "silver_spot_asset", market_symbol: "SI=F" },
];

/** eMAXIS Slim インデックスファンド: MUFG Bank CSV */
const MUFG_FUNDS = [
  { asset_code: "emaxis_slim_all_country",    mufg_code: "m00355920" },
  { asset_code: "emaxis_slim_us_sp500",       mufg_code: "m00355320" },
  { asset_code: "emaxis_slim_domestic_topix", mufg_code: "m00355420" },
  { asset_code: "emaxis_slim_emerging",       mufg_code: "m00355220" },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function toJstDateStr(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const yf = new YahooFinance();

if (dryRun) console.log("🔍  Dry-run モード（DB への書き込みをスキップします）\n");

// 期間: 直近90日
const now = new Date();
const past = new Date(now);
past.setDate(past.getDate() - 90);
const period1 = toJstDateStr(past);
const period2 = toJstDateStr(now);
console.log(`📅  期間: ${period1} 〜 ${period2}\n`);

// 全 asset_code を一括で DB から取得
const allAssetCodes = [
  ...STOCKS.map((s) => s.asset_code),
  ...JP_INDICES.map((s) => s.asset_code),
  ...CRYPTO.map((c) => c.asset_code),
  ...COMMODITIES.map((c) => c.asset_code),
  ...US_STOCKS.map((s) => s.asset_code),
  ...MUFG_FUNDS.map((f) => f.asset_code),
];
const { data: dbAssets, error: dbErr } = await client
  .from("investment_assets")
  .select("id, asset_code, asset_name")
  .in("asset_code", allAssetCodes)
  .eq("is_active", true);

if (dbErr) { console.error("❌  銘柄取得失敗:", dbErr.message); process.exit(1); }
const assetMap = Object.fromEntries((dbAssets ?? []).map((a) => [a.asset_code, a]));

const results = { success: [], failed: [] };

// ── Helper: upsert rows ───────────────────────────────────────────────────────

async function upsertRows(rows, label) {
  if (rows.length === 0) {
    console.log(`  ⚠️  有効データなし`);
    results.failed.push({ name: label, error: "有効データなし" });
    return;
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (dryRun) {
    console.log(`  [dry-run] ${first.price_date}〜${last.price_date}: ${rows.length}件`);
    console.log(`    先頭 ¥${first.unit_price_jpy.toLocaleString()} / 末尾 ¥${last.unit_price_jpy.toLocaleString()}`);
    results.success.push(label);
    return;
  }
  const { error } = await client
    .from("investment_asset_prices")
    .upsert(rows, { onConflict: "asset_id,price_date" });
  if (error) throw new Error(`upsert 失敗: ${error.message}`);
  console.log(`  ✓ ${first.price_date}〜${last.price_date}: ${rows.length}件 (最新 ¥${last.unit_price_jpy.toLocaleString()})`);
  results.success.push(label);
}

// ── 1. 日本株 + 仮想通貨 (Yahoo Finance 直接 JPY) ─────────────────────────────

console.log("─── 日本株");
for (const { asset_code, market_symbol } of STOCKS) {
  const asset = assetMap[asset_code];
  if (!asset) { console.log(`  ⚠️  DB に見つかりません: ${asset_code}`); continue; }
  console.log(`📈  ${asset.asset_name} (${market_symbol})`);
  try {
    const data = await yf.chart(market_symbol, { period1, period2, interval: "1d" }, { validateResult: false });
    const rows = (data.quotes ?? [])
      .filter((q) => q.close != null && !isNaN(q.close))
      .map((q) => ({
        asset_id: asset.id,
        price_date: toJstDateStr(q.date),
        unit_price_jpy: Math.round(q.close),
        source: `yahoo_finance_daily:${market_symbol}`,
      }));
    await upsertRows(rows, asset.asset_name);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    results.failed.push({ name: asset.asset_name, error: e.message });
  }
}

console.log("\n─── 日本の株価指数");
for (const { asset_code, market_symbol } of JP_INDICES) {
  const asset = assetMap[asset_code];
  if (!asset) { console.log(`  ⚠️  DB に見つかりません: ${asset_code}`); continue; }
  console.log(`📊  ${asset.asset_name} (${market_symbol})`);
  try {
    const data = await yf.chart(market_symbol, { period1, period2, interval: "1d" }, { validateResult: false });
    const rows = (data.quotes ?? [])
      .filter((q) => q.close != null && !isNaN(q.close))
      .map((q) => ({
        asset_id: asset.id,
        price_date: toJstDateStr(q.date),
        unit_price_jpy: Math.round(q.close),
        source: `yahoo_finance_daily:${market_symbol}`,
      }));
    await upsertRows(rows, asset.asset_name);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    results.failed.push({ name: asset.asset_name, error: e.message });
  }
}

console.log("\n─── 仮想通貨");
for (const { asset_code, market_symbol } of CRYPTO) {
  const asset = assetMap[asset_code];
  if (!asset) { console.log(`  ⚠️  DB に見つかりません: ${asset_code}`); continue; }
  console.log(`🪙  ${asset.asset_name} (${market_symbol})`);
  try {
    const data = await yf.chart(market_symbol, { period1, period2, interval: "1d" }, { validateResult: false });
    const rows = (data.quotes ?? [])
      .filter((q) => q.close != null && !isNaN(q.close))
      .map((q) => ({
        asset_id: asset.id,
        price_date: toJstDateStr(q.date),
        unit_price_jpy: Math.round(q.close),
        source: `yahoo_finance_daily:${market_symbol}`,
      }));
    await upsertRows(rows, asset.asset_name);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    results.failed.push({ name: asset.asset_name, error: e.message });
  }
}

// ── 2. コモディティ (GC=F / SI=F + USDJPY=X 換算) ─────────────────────────────

console.log("\n─── コモディティ");

// USDJPY 履歴を先に取得して日付→レートのマップを作成
let usdJpyMap = new Map();
try {
  const fxData = await yf.chart("USDJPY=X", { period1, period2, interval: "1d" }, { validateResult: false });
  for (const q of (fxData.quotes ?? [])) {
    if (q.close != null) usdJpyMap.set(toJstDateStr(q.date), q.close);
  }
  console.log(`  USDJPY=X: ${usdJpyMap.size}件取得`);
} catch (e) {
  console.error(`  ✗ USDJPY=X 取得失敗: ${e.message} — コモディティをスキップ`);
}

if (usdJpyMap.size > 0) {
  function lookupUsdJpy(dateStr) {
    if (usdJpyMap.has(dateStr)) return usdJpyMap.get(dateStr);
    // 直近の利用可能レートにフォールバック（最大7日さかのぼる）
    for (let i = 1; i <= 7; i++) {
      const d = new Date(dateStr);
      d.setDate(d.getDate() - i);
      const fallback = d.toISOString().slice(0, 10);
      if (usdJpyMap.has(fallback)) return usdJpyMap.get(fallback);
    }
    return null;
  }

  for (const { asset_code, market_symbol } of COMMODITIES) {
    const asset = assetMap[asset_code];
    if (!asset) { console.log(`  ⚠️  DB に見つかりません: ${asset_code}`); continue; }
    console.log(`🥇  ${asset.asset_name} (${market_symbol})`);
    try {
      const data = await yf.chart(market_symbol, { period1, period2, interval: "1d" }, { validateResult: false });
      const rows = [];
      for (const q of (data.quotes ?? [])) {
        if (q.close == null || isNaN(q.close)) continue;
        const dateStr = toJstDateStr(q.date);
        const rate = lookupUsdJpy(dateStr);
        if (rate == null) continue; // USDJPY が取得できない日はスキップ
        const priceJpy = Math.round(q.close * rate / TROY_OZ_TO_GRAM);
        if (priceJpy <= 0) continue;
        rows.push({
          asset_id: asset.id,
          price_date: dateStr,
          unit_price_jpy: priceJpy,
          source: `yahoo_finance_daily:${market_symbol}:usdjpy`,
        });
      }
      await upsertRows(rows, asset.asset_name);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      results.failed.push({ name: asset.asset_name, error: e.message });
    }
  }

  console.log("\n─── 米国株");
  for (const { asset_code, market_symbol } of US_STOCKS) {
    const asset = assetMap[asset_code];
    if (!asset) { console.log(`  ⚠️  DB に見つかりません: ${asset_code}`); continue; }
    console.log(`🇺🇸  ${asset.asset_name} (${market_symbol})`);
    try {
      const data = await yf.chart(market_symbol, { period1, period2, interval: "1d" }, { validateResult: false });
      const rows = [];
      for (const q of (data.quotes ?? [])) {
        if (q.close == null || isNaN(q.close)) continue;
        const dateStr = toJstDateStr(q.date);
        const rate = lookupUsdJpy(dateStr);
        if (rate == null) continue;
        const priceJpy = Math.round(q.close * rate);
        if (priceJpy <= 0) continue;
        rows.push({
          asset_id: asset.id,
          price_date: dateStr,
          unit_price_jpy: priceJpy,
          source: `yahoo_finance_daily:${market_symbol}:usdjpy`,
        });
      }
      await upsertRows(rows, asset.asset_name);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      results.failed.push({ name: asset.asset_name, error: e.message });
    }
  }
}

// ── 3. eMAXIS Slim ファンド (MUFG Bank CSV) ───────────────────────────────────

console.log("\n─── eMAXIS Slim インデックスファンド (MUFG CSV)");
for (const { asset_code, mufg_code } of MUFG_FUNDS) {
  const asset = assetMap[asset_code];
  if (!asset) { console.log(`  ⚠️  DB に見つかりません: ${asset_code}`); continue; }
  console.log(`📊  ${asset.asset_name}`);
  try {
    const csvUrl = `${MUFG_CSV_BASE}/${mufg_code}.csv`;
    const res = await fetch(csvUrl, {
      headers: { "user-agent": "family-money-app price sync" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`CSV fetch 失敗: HTTP ${res.status}`);
    const csvText = await res.text();
    const priceRows = parseAllPrices(csvText, period1);
    const rows = priceRows.map((p) => ({
      asset_id: asset.id,
      price_date: p.priceDate,
      unit_price_jpy: p.unitPriceJpy,
      source: `mufg_bank_csv:${mufg_code}`,
    }));
    await upsertRows(rows, asset.asset_name);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    results.failed.push({ name: asset.asset_name, error: e.message });
  }
}

// ── 結果サマリー ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`📊  結果: 成功 ${results.success.length}件 / 失敗 ${results.failed.length}件`);
if (results.success.length > 0) console.log(`  成功: ${results.success.join(", ")}`);
if (results.failed.length > 0) {
  console.error("  失敗した銘柄:");
  for (const f of results.failed) console.error(`    - ${f.name}: ${f.error}`);
  process.exit(1);
}
