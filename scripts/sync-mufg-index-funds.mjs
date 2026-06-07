/**
 * sync-mufg-index-funds.mjs
 *
 * MUFG Bank CSV を使ってeMAXIS Slim インデックスファンド4銘柄の
 * 基準価額を取得し investment_asset_prices に upsert する。
 *
 * 対象銘柄:
 *   emaxis_slim_all_country       (m00355920) 全世界株式（オール・カントリー）
 *   emaxis_slim_us_sp500          (m00355320) 米国株式（S&P500）
 *   emaxis_slim_domestic_topix    (m00355420) 国内株式（TOPIX）
 *   emaxis_slim_emerging          (m00355220) 新興国株式インデックス
 *
 * Usage:
 *   npm run prices:sync:mufg-index
 *   PRICE_SYNC_DRY_RUN=1 npm run prices:sync:mufg-index
 *
 * Required env vars (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or TEST_SUPABASE_SERVICE_ROLE_KEY)
 */

import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";
import { fetchLatestAllCountryPrice } from "./all-country-price-source.mjs";

// ── Config ────────────────────────────────────────────────────────────────────

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = ["1", "true", "yes"].includes(
  (process.env.PRICE_SYNC_DRY_RUN ?? "").toLowerCase()
);

const MUFG_CSV_BASE =
  "https://fs.bk.mufg.jp/webasp/mufg/fund/detail/chart/csv";

/** 同期対象ファンド一覧 */
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!supabaseUrl || !supabaseServiceRoleKey) {
  fail(
    [
      "Missing Supabase env vars.",
      "Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    ].join("\n")
  );
}

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = { succeeded: [], failed: [] };

for (const fund of INDEX_FUNDS) {
  const csvUrl = `${MUFG_CSV_BASE}/${fund.mufgCode}.csv`;
  const source = `mufg_bank_csv:${fund.mufgCode}`;

  try {
    console.log(`\n[${fund.label}] Fetching CSV...`);
    const latestPrice = await fetchLatestAllCountryPrice(csvUrl);

    const { data: asset, error: assetError } = await serviceClient
      .from("investment_assets")
      .select("id, asset_code, asset_name")
      .eq("asset_code", fund.assetCode)
      .maybeSingle();

    if (assetError) {
      throw new Error(`DB lookup failed: ${assetError.message}`);
    }
    if (!asset) {
      throw new Error(`Asset not found in DB: ${fund.assetCode}`);
    }

    console.log(`  asset:       ${asset.asset_name}`);
    console.log(`  price_date:  ${latestPrice.priceDate}`);
    console.log(`  unit_price:  ¥${latestPrice.unitPriceJpy.toLocaleString()}`);
    console.log(`  source:      ${source}`);
    console.log(`  dry_run:     ${dryRun}`);

    if (!dryRun) {
      const { error: upsertError } = await serviceClient
        .from("investment_asset_prices")
        .upsert(
          {
            asset_id: asset.id,
            price_date: latestPrice.priceDate,
            unit_price_jpy: latestPrice.unitPriceJpy,
            source,
          },
          { onConflict: "asset_id,price_date" }
        );

      if (upsertError) {
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }
    }

    results.succeeded.push(fund.assetCode);
    console.log(`  ✓ ${dryRun ? "dry-run OK" : "saved"}`);
  } catch (err) {
    results.failed.push({ assetCode: fund.assetCode, label: fund.label, error: formatError(err) });
    console.error(`  ✗ ${formatError(err)}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────");
console.log(`succeeded: ${results.succeeded.length} / ${INDEX_FUNDS.length}`);
if (results.failed.length > 0) {
  console.error("failed:");
  for (const f of results.failed) {
    console.error(`  - ${f.label}: ${f.error}`);
  }
  process.exit(1);
}
console.log("All MUFG index fund prices synced successfully.");
