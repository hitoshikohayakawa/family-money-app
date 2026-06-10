/**
 * sync-market-prices.mjs
 *
 * 株式・仮想通貨・金銀の現在価格を取得して investment_asset_prices に upsert する。
 *
 * 対象銘柄:
 *   株式:         任天堂(7974.T)・トヨタ(7203.T)・ソニー(6758.T) — Yahoo Finance JP
 *   仮想通貨:     ビットコイン・イーサリアム — CoinGecko
 *   コモディティ: 金・銀 — Yahoo Finance 先物 + USD/JPY 換算（円/g）
 *
 * 非対応（自動取得不可）:
 *   emaxis_slim_domestic_topix / emaxis_slim_emerging
 *   → MUFG のファンド基準価額 CSV の公開 URL が不明なため手動更新
 *
 * Usage:
 *   npm run prices:sync:market
 *   PRICE_SYNC_DRY_RUN=1 npm run prices:sync:market
 *
 * Required env vars (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or TEST_SUPABASE_SERVICE_ROLE_KEY)
 */

import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = ["1", "true", "yes"].includes(
  (process.env.PRICE_SYNC_DRY_RUN ?? "").toLowerCase()
);
const FETCH_TIMEOUT_MS = 20_000;
const TROY_OZ_TO_GRAM = 31.1035;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。");
  process.exit(1);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toJstDate(unixSeconds) {
  const jst = new Date(unixSeconds * 1000 + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function todayJst() {
  return toJstDate(Date.now() / 1000);
}

// ── Price fetchers ────────────────────────────────────────────────────────────

async function fetchYahooFinance(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`;
  const res = await fetch(url, {
    headers: { "user-agent": "family-money-app price sync" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} for ${ticker}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${ticker}`);
  return result.meta;
}

async function fetchStockPrice(ticker) {
  const meta = await fetchYahooFinance(ticker);
  const unitPriceJpy = Math.round(meta.regularMarketPrice);
  if (!unitPriceJpy || unitPriceJpy <= 0) throw new Error(`Invalid price for ${ticker}: ${meta.regularMarketPrice}`);
  return {
    unitPriceJpy,
    priceDate: toJstDate(meta.regularMarketTime),
    source: `yahoo_finance_jp:${ticker}`,
  };
}

async function fetchCryptoPrices() {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=jpy";
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const today = todayJst();
  return {
    bitcoin: { unitPriceJpy: Math.round(data.bitcoin.jpy), priceDate: today, source: "coingecko:bitcoin" },
    ethereum: { unitPriceJpy: Math.round(data.ethereum.jpy), priceDate: today, source: "coingecko:ethereum" },
  };
}

async function fetchCommodityPrices() {
  const [goldMeta, silverMeta, fxMeta] = await Promise.all([
    fetchYahooFinance("GC=F"),
    fetchYahooFinance("SI=F"),
    fetchYahooFinance("USDJPY=X"),
  ]);
  const usdJpy = fxMeta.regularMarketPrice;
  const today = todayJst();
  return {
    gold: {
      unitPriceJpy: Math.round(goldMeta.regularMarketPrice * usdJpy / TROY_OZ_TO_GRAM),
      priceDate: today,
      source: "yahoo_finance:GC=F:usdjpy",
    },
    silver: {
      unitPriceJpy: Math.round(silverMeta.regularMarketPrice * usdJpy / TROY_OZ_TO_GRAM),
      priceDate: today,
      source: "yahoo_finance:SI=F:usdjpy",
    },
  };
}

async function fetchUsStockPrices() {
  const [aaplMeta, amznMeta, nvdaMeta, fxMeta] = await Promise.all([
    fetchYahooFinance("AAPL"),
    fetchYahooFinance("AMZN"),
    fetchYahooFinance("NVDA"),
    fetchYahooFinance("USDJPY=X"),
  ]);
  const usdJpy = fxMeta.regularMarketPrice;
  return {
    apple:  { unitPriceJpy: Math.round(aaplMeta.regularMarketPrice * usdJpy), priceDate: toJstDate(aaplMeta.regularMarketTime), source: "yahoo_finance:AAPL:usdjpy" },
    amazon: { unitPriceJpy: Math.round(amznMeta.regularMarketPrice * usdJpy), priceDate: toJstDate(amznMeta.regularMarketTime), source: "yahoo_finance:AMZN:usdjpy" },
    nvidia: { unitPriceJpy: Math.round(nvdaMeta.regularMarketPrice * usdJpy), priceDate: toJstDate(nvdaMeta.regularMarketTime), source: "yahoo_finance:NVDA:usdjpy" },
  };
}

// ── DB upsert ─────────────────────────────────────────────────────────────────

async function upsertPrice(client, assetCode, { unitPriceJpy, priceDate, source }) {
  const { data: asset, error: assetError } = await client
    .from("investment_assets")
    .select("id, asset_name")
    .eq("asset_code", assetCode)
    .maybeSingle();

  if (assetError) throw new Error(`asset lookup failed: ${assetError.message}`);
  if (!asset) throw new Error(`asset not found: ${assetCode}`);

  if (dryRun) {
    console.log(`  [dry-run] ${asset.asset_name}: ¥${unitPriceJpy.toLocaleString()} (${priceDate})`);
    return;
  }

  const { error } = await client
    .from("investment_asset_prices")
    .upsert(
      { asset_id: asset.id, price_date: priceDate, unit_price_jpy: unitPriceJpy, source },
      { onConflict: "asset_id,price_date" }
    );

  if (error) throw new Error(`upsert failed: ${error.message}`);
  console.log(`  ✓ ${asset.asset_name}: ¥${unitPriceJpy.toLocaleString()} (${priceDate})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (dryRun) console.log("🔍  Dry-run モード（DB への書き込みをスキップします）\n");

const results = { success: [], failed: [] };

async function run(label, assetCode, fetchFn) {
  try {
    const price = await fetchFn();
    await upsertPrice(client, assetCode, price);
    results.success.push(assetCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${label}: ${msg}`);
    results.failed.push({ assetCode, label, error: msg });
  }
}

// 株式
console.log("📈  株式価格を取得中...");
await run("任天堂",     "nintendo_stock",    () => fetchStockPrice("7974.T"));
await run("トヨタ自動車", "toyota_motor_stock", () => fetchStockPrice("7203.T"));
await run("ソニーグループ", "sony_group_stock",   () => fetchStockPrice("6758.T"));

// 仮想通貨
console.log("\n🪙  仮想通貨価格を取得中...");
let cryptoPrices = null;
try {
  cryptoPrices = await fetchCryptoPrices();
} catch (err) {
  console.error(`  ✗ CoinGecko 取得失敗: ${err instanceof Error ? err.message : err}`);
  results.failed.push({ assetCode: "bitcoin_crypto,ethereum_crypto", label: "CoinGecko", error: String(err) });
}
if (cryptoPrices) {
  await run("ビットコイン", "bitcoin_crypto",  async () => cryptoPrices.bitcoin);
  await run("イーサリアム", "ethereum_crypto", async () => cryptoPrices.ethereum);
}

// 金・銀
console.log("\n🥇  コモディティ価格を取得中...");
let commodityPrices = null;
try {
  commodityPrices = await fetchCommodityPrices();
} catch (err) {
  console.error(`  ✗ コモディティ取得失敗: ${err instanceof Error ? err.message : err}`);
  results.failed.push({ assetCode: "gold_spot_asset,silver_spot_asset", label: "Yahoo Finance Futures", error: String(err) });
}
if (commodityPrices) {
  await run("金（ゴールド）", "gold_spot_asset",   async () => commodityPrices.gold);
  await run("銀（シルバー）", "silver_spot_asset", async () => commodityPrices.silver);
}

// 米国株
console.log("\n🇺🇸  米国株価格を取得中...");
let usStockPrices = null;
try {
  usStockPrices = await fetchUsStockPrices();
} catch (err) {
  console.error(`  ✗ 米国株取得失敗: ${err instanceof Error ? err.message : err}`);
  results.failed.push({ assetCode: "apple_stock,amazon_stock,nvidia_stock", label: "Yahoo Finance US Stocks", error: String(err) });
}
if (usStockPrices) {
  await run("Apple",   "apple_stock",  async () => usStockPrices.apple);
  await run("Amazon",  "amazon_stock", async () => usStockPrices.amazon);
  await run("NVIDIA",  "nvidia_stock", async () => usStockPrices.nvidia);
}

// 結果サマリー
console.log(`\n${"─".repeat(40)}`);
console.log(`📊  結果: 成功 ${results.success.length}件 / 失敗 ${results.failed.length}件`);
if (results.failed.length > 0) {
  console.error("失敗した銘柄:");
  for (const f of results.failed) console.error(`  - ${f.label}: ${f.error}`);
  process.exit(1);
}
