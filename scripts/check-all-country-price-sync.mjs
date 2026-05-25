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
const expectedPriceSource =
  process.env.INVESTMENT_PRICE_SOURCE?.trim() || defaultAllCountryPriceSource;

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
        "Missing Supabase env vars for all-country price sync verification.",
        "Missing:",
        ...missingVars.map((name) => `- ${name}`),
      ].join("\n")
    );
  }
}

async function findAsset(serviceClient) {
  const { data: asset, error } = await serviceClient
    .from("investment_assets")
    .select("id, asset_code, asset_name")
    .eq("asset_code", assetCode)
    .single();

  if (error) {
    throw new Error(`Failed to fetch investment asset: ${error.message}`);
  }

  return asset;
}

async function findLatestStoredPrice(serviceClient, assetId) {
  const { data: rows, error } = await serviceClient
    .from("investment_asset_prices")
    .select("price_date, unit_price_jpy, source, created_at")
    .eq("asset_id", assetId)
    .order("price_date", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch latest stored investment asset price: ${error.message}`);
  }

  const latestRow = rows?.[0];

  if (!latestRow) {
    throw new Error("No investment_asset_prices row exists for the configured asset.");
  }

  return latestRow;
}

async function main() {
  requireSupabaseEnv();

  console.log("Fetching latest source price...");
  const sourcePrice = await fetchLatestAllCountryPrice(csvUrl);
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Looking up investment asset...");
  const asset = await findAsset(serviceClient);

  console.log("Checking latest stored price row...");
  const latestStoredPrice = await findLatestStoredPrice(serviceClient, asset.id);

  console.log("All-country price sync verification target:");
  console.log({
    asset_code: asset.asset_code,
    asset_name: asset.asset_name,
    source_price_date: sourcePrice.priceDate,
    source_unit_price_jpy: sourcePrice.unitPriceJpy,
    stored_price_date: latestStoredPrice.price_date,
    stored_unit_price_jpy: latestStoredPrice.unit_price_jpy,
    stored_source: latestStoredPrice.source,
    stored_created_at: latestStoredPrice.created_at,
  });

  if (latestStoredPrice.price_date !== sourcePrice.priceDate) {
    throw new Error(
      [
        "Stored latest price date does not match source latest price date.",
        `Expected: ${sourcePrice.priceDate}`,
        `Actual: ${latestStoredPrice.price_date}`,
      ].join("\n")
    );
  }

  if (latestStoredPrice.unit_price_jpy !== sourcePrice.unitPriceJpy) {
    throw new Error(
      [
        "Stored latest unit price does not match source latest unit price.",
        `Expected: ${sourcePrice.unitPriceJpy}`,
        `Actual: ${latestStoredPrice.unit_price_jpy}`,
      ].join("\n")
    );
  }

  if (latestStoredPrice.source !== expectedPriceSource) {
    throw new Error(
      [
        "Stored latest price source does not match configured price source.",
        `Expected: ${expectedPriceSource}`,
        `Actual: ${latestStoredPrice.source ?? "(null)"}`,
      ].join("\n")
    );
  }

  console.log("All-country price sync verification passed.");
}

try {
  await main();
} catch (error) {
  fail(`All-country price sync verification failed.\n${formatError(error)}`);
}
