import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import {
  defaultAllCountryCsvUrl,
  defaultAllCountryPriceSource,
  defaultAssetCode,
  fetchLatestAllCountryPrice,
} from "@/scripts/all-country-price-source.mjs";

export const runtime = "nodejs";

const jstOffsetMs = 9 * 60 * 60 * 1000;

type LatestPriceRow = {
  price_date: string;
  unit_price_jpy: number;
  source: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getPreviousBusinessDateJst(now = new Date()) {
  const jstDate = new Date(now.getTime() + jstOffsetMs);
  jstDate.setUTCHours(0, 0, 0, 0);

  do {
    jstDate.setUTCDate(jstDate.getUTCDate() - 1);
  } while (jstDate.getUTCDay() === 0 || jstDate.getUTCDay() === 6);

  return jstDate.toISOString().slice(0, 10);
}

async function findAsset(serviceClient: ReturnType<typeof createServiceRoleServerClient>, assetCode: string) {
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

async function findLatestStoredPrice(
  serviceClient: ReturnType<typeof createServiceRoleServerClient>,
  assetId: string
) {
  const { data: rows, error } = await serviceClient
    .from("investment_asset_prices")
    .select("price_date, unit_price_jpy, source")
    .eq("asset_id", assetId)
    .order("price_date", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch latest stored investment asset price: ${error.message}`);
  }

  return (rows?.[0] as LatestPriceRow | undefined) ?? null;
}

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return jsonError("Supabase のサーバー環境変数が不足しています。", 500);
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonError("ログイン状態を確認できませんでした。", 401);
  }

  const userClient = createAuthenticatedServerClient(authorization);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonError("ログイン状態を確認できませんでした。", 401);
  }

  const assetCode = process.env.INVESTMENT_ASSET_CODE?.trim() || defaultAssetCode;
  const csvUrl =
    process.env.ALL_COUNTRY_PRICE_CSV_URL?.trim() || defaultAllCountryCsvUrl;
  const priceSource =
    process.env.INVESTMENT_PRICE_SOURCE?.trim() || defaultAllCountryPriceSource;
  const serviceClient = createServiceRoleServerClient();

  try {
    const asset = await findAsset(serviceClient, assetCode);
    const latestStoredPrice = await findLatestStoredPrice(serviceClient, asset.id);
    const expectedBusinessDate = getPreviousBusinessDateJst();

    if (latestStoredPrice && latestStoredPrice.price_date >= expectedBusinessDate) {
      return NextResponse.json({
        status: "skipped",
        reason: "already_up_to_date",
        expectedBusinessDate,
        storedPriceDate: latestStoredPrice.price_date,
      });
    }

    const sourcePrice = await fetchLatestAllCountryPrice(csvUrl);

    if (
      latestStoredPrice &&
      latestStoredPrice.price_date === sourcePrice.priceDate &&
      latestStoredPrice.unit_price_jpy === sourcePrice.unitPriceJpy &&
      latestStoredPrice.source === priceSource
    ) {
      return NextResponse.json({
        status: "skipped",
        reason: "source_matches_latest_stored_price",
        expectedBusinessDate,
        storedPriceDate: latestStoredPrice.price_date,
        sourcePriceDate: sourcePrice.priceDate,
      });
    }

    const priceRow = {
      asset_id: asset.id,
      price_date: sourcePrice.priceDate,
      unit_price_jpy: sourcePrice.unitPriceJpy,
      source: priceSource,
    };

    const { error: upsertError } = await serviceClient
      .from("investment_asset_prices")
      .upsert(priceRow, {
        onConflict: "asset_id,price_date",
      });

    if (upsertError) {
      throw new Error(`Failed to upsert investment asset price: ${upsertError.message}`);
    }

    return NextResponse.json({
      status: "updated",
      expectedBusinessDate,
      sourcePriceDate: sourcePrice.priceDate,
      sourceUnitPriceJpy: sourcePrice.unitPriceJpy,
    });
  } catch (error) {
    return jsonError(`価格の更新に失敗しました: ${formatError(error)}`, 500);
  }
}
