import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";
import {
  defaultAllCountryCsvUrl,
  defaultAllCountryPriceSource,
  defaultAssetCode,
  fetchLatestAllCountryPrice,
} from "./all-country-price-source.mjs";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const assetCode = process.env.INVESTMENT_ASSET_CODE?.trim() || defaultAssetCode;
const csvUrl =
  process.env.ALL_COUNTRY_PRICE_CSV_URL?.trim() || defaultAllCountryCsvUrl;
const priceSource =
  process.env.INVESTMENT_PRICE_SOURCE?.trim() || defaultAllCountryPriceSource;
const dryRun = ["1", "true", "yes"].includes(
  (process.env.PRICE_SYNC_DRY_RUN ?? "").toLowerCase()
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function requireSupabaseEnv() {
  const missingVars = [];

  if (!supabaseUrl) {
    missingVars.push("TEST_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    missingVars.push("TEST_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missingVars.length > 0) {
    fail(
      [
        "Missing Supabase env vars for all-country price sync.",
        "Missing:",
        ...missingVars.map((name) => `- ${name}`),
      ].join("\n")
    );
  }
}

async function fetchLatestPrice() {
  console.log("Fetching all-country price CSV...");
  return fetchLatestAllCountryPrice(csvUrl);
}

async function findAsset(serviceClient) {
  console.log("Looking up investment asset...");
  const { data: asset, error: assetError } = await serviceClient
    .from("investment_assets")
    .select("id, asset_code, asset_name")
    .eq("asset_code", assetCode)
    .single();

  if (assetError) {
    throw new Error(`Failed to fetch investment asset: ${assetError.message}`);
  }

  return asset;
}

async function upsertPrice(serviceClient, priceRow) {
  const { error: upsertError } = await serviceClient
    .from("investment_asset_prices")
    .upsert(priceRow, {
      onConflict: "asset_id,price_date",
    });

  if (upsertError) {
    throw new Error(`Failed to upsert investment asset price: ${upsertError.message}`);
  }
}

async function main() {
  requireSupabaseEnv();

  const latestPrice = await fetchLatestPrice();
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const asset = await findAsset(serviceClient);

  const priceRow = {
    asset_id: asset.id,
    price_date: latestPrice.priceDate,
    unit_price_jpy: latestPrice.unitPriceJpy,
    source: priceSource,
  };

  console.log("All-country price sync target:");
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
    return;
  }

  await upsertPrice(serviceClient, priceRow);
  console.log("All-country price sync completed.");
}

try {
  await main();
} catch (error) {
  fail(`All-country price sync failed.\n${formatError(error)}`);
}
