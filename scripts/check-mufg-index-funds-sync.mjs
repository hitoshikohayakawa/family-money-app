/**
 * check-mufg-index-funds-sync.mjs
 *
 * MUFG CSV の最新価格と DB の最新価格を比較して、
 * 全4銘柄が正しく同期されているか検証する。
 * GitHub Actions の sync 後に実行するチェックスクリプト。
 *
 * Usage:
 *   npm run prices:check:mufg-index
 */

import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";
import { fetchLatestAllCountryPrice } from "./all-country-price-source.mjs";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const MUFG_CSV_BASE =
  "https://fs.bk.mufg.jp/webasp/mufg/fund/detail/chart/csv";

const INDEX_FUNDS = [
  {
    assetCode: "emaxis_slim_all_country",
    mufgCode: "m00355920",
    label: "全世界株式（オール・カントリー）",
  },
  {
    assetCode: "emaxis_slim_us_sp500",
    mufgCode: "m00355320",
    label: "米国株式（S&P500）",
  },
  {
    assetCode: "emaxis_slim_domestic_topix",
    mufgCode: "m00355420",
    label: "国内株式（TOPIX）",
  },
  {
    assetCode: "emaxis_slim_emerging",
    mufgCode: "m00355220",
    label: "新興国株式インデックス",
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  fail("Missing Supabase env vars.");
}

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const failures = [];

for (const fund of INDEX_FUNDS) {
  const csvUrl = `${MUFG_CSV_BASE}/${fund.mufgCode}.csv`;
  const expectedSource = `mufg_bank_csv:${fund.mufgCode}`;

  try {
    console.log(`\n[${fund.label}] Verifying...`);

    const sourcePrice = await fetchLatestAllCountryPrice(csvUrl);

    const { data: asset, error: assetError } = await serviceClient
      .from("investment_assets")
      .select("id")
      .eq("asset_code", fund.assetCode)
      .single();

    if (assetError || !asset) {
      throw new Error(`Asset not found: ${fund.assetCode}`);
    }

    const { data: rows, error: priceError } = await serviceClient
      .from("investment_asset_prices")
      .select("price_date, unit_price_jpy, source")
      .eq("asset_id", asset.id)
      .order("price_date", { ascending: false })
      .limit(1);

    if (priceError) throw new Error(`DB error: ${priceError.message}`);
    if (!rows?.[0]) throw new Error("No price row found in DB");

    const stored = rows[0];

    console.log(`  source: date=${sourcePrice.priceDate} price=¥${sourcePrice.unitPriceJpy.toLocaleString()}`);
    console.log(`  stored: date=${stored.price_date}    price=¥${stored.unit_price_jpy?.toLocaleString()}`);

    const errors = [];
    if (stored.price_date !== sourcePrice.priceDate) {
      errors.push(`price_date mismatch: expected ${sourcePrice.priceDate}, got ${stored.price_date}`);
    }
    if (stored.unit_price_jpy !== sourcePrice.unitPriceJpy) {
      errors.push(`unit_price_jpy mismatch: expected ${sourcePrice.unitPriceJpy}, got ${stored.unit_price_jpy}`);
    }
    if (stored.source !== expectedSource) {
      errors.push(`source mismatch: expected ${expectedSource}, got ${stored.source}`);
    }

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    console.log(`  ✓ OK`);
  } catch (err) {
    console.error(`  ✗ ${formatError(err)}`);
    failures.push({ label: fund.label, error: formatError(err) });
  }
}

console.log("\n─────────────────────────────────────");
if (failures.length > 0) {
  console.error(`Verification failed for ${failures.length} fund(s):`);
  for (const f of failures) {
    console.error(`  - ${f.label}: ${f.error}`);
  }
  process.exit(1);
}
console.log("All MUFG index fund price verifications passed.");
