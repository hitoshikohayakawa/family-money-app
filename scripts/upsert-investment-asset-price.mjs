import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const assetCode =
  process.env.INVESTMENT_ASSET_CODE?.trim() || "emaxis_slim_all_country";
const priceDate = process.env.INVESTMENT_PRICE_DATE?.trim();
const unitPriceJpyText = process.env.INVESTMENT_UNIT_PRICE_JPY?.trim();
const priceSource = process.env.INVESTMENT_PRICE_SOURCE?.trim() || "manual";
const dryRun = ["1", "true", "yes"].includes(
  (process.env.PRICE_SYNC_DRY_RUN ?? "").toLowerCase()
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  fail(
    [
      "Missing Supabase env vars for investment price upsert.",
      "Required:",
      "- TEST_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
      "- TEST_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY",
    ].join("\n")
  );
}

if (!priceDate || !isIsoDate(priceDate)) {
  fail("INVESTMENT_PRICE_DATE is required in YYYY-MM-DD format.");
}

const unitPriceJpy = Number.parseInt(unitPriceJpyText ?? "", 10);

if (!Number.isInteger(unitPriceJpy) || unitPriceJpy <= 0) {
  fail("INVESTMENT_UNIT_PRICE_JPY is required as a positive integer.");
}

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Looking up investment asset...");
const { data: asset, error: assetError } = await serviceClient
  .from("investment_assets")
  .select("id, asset_code, asset_name")
  .eq("asset_code", assetCode)
  .single();

if (assetError) {
  fail(`Failed to fetch investment asset: ${assetError.message}`);
}

const priceRow = {
  asset_id: asset.id,
  price_date: priceDate,
  unit_price_jpy: unitPriceJpy,
  source: priceSource,
};

console.log("Investment asset price upsert target:");
console.log({
  asset_code: asset.asset_code,
  asset_name: asset.asset_name,
  price_date: priceRow.price_date,
  unit_price_jpy: priceRow.unit_price_jpy,
  source: priceRow.source,
  dry_run: dryRun,
});

if (dryRun) {
  console.log("Dry run completed. No database changes were made.");
  process.exit(0);
}

const { error: upsertError } = await serviceClient
  .from("investment_asset_prices")
  .upsert(priceRow, {
    onConflict: "asset_id,price_date",
  });

if (upsertError) {
  fail(`Failed to upsert investment asset price: ${upsertError.message}`);
}

console.log("Investment asset price upsert completed.");
