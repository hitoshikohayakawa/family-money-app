import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import FooterNav from "@/app/components/ui/footer-nav";
import ChartDetailContent from "@/app/charts/[assetId]/chart-detail-content";
import { createServiceRoleServerClient } from "@/lib/server-supabase";
import { fetchGoogleNewsRss } from "@/lib/google-news-rss";

export const dynamic = "force-dynamic";

type Params = Promise<{ assetId: string }>;

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_category_code: string;
  description: string | null;
};

type PriceRow = {
  price_date: string;
  unit_price_jpy: number;
};

async function fetchAsset(assetId: string): Promise<AssetRow | null> {
  const client = createServiceRoleServerClient();
  const { data } = await client
    .from("investment_assets")
    .select("id, asset_code, asset_name, asset_category_code, description")
    .eq("id", assetId)
    .eq("is_active", true)
    .maybeSingle();
  return data as AssetRow | null;
}

async function fetchPrices(assetId: string): Promise<PriceRow[]> {
  const client = createServiceRoleServerClient();
  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const { data } = await client
    .from("investment_asset_prices")
    .select("price_date, unit_price_jpy")
    .eq("asset_id", assetId)
    .gte("price_date", since.toISOString().slice(0, 10))
    .order("price_date", { ascending: true });
  return (data ?? []) as PriceRow[];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { assetId } = await params;
  const asset = await fetchAsset(assetId);
  if (!asset) return { title: "チャート | ミラマネ" };
  return {
    title: `${asset.asset_name} | チャート | ミラマネ`,
    description: asset.description ?? `${asset.asset_name}の値動きチャートです。`,
  };
}

export default async function ChartDetailPage({ params }: { params: Params }) {
  const { assetId } = await params;

  const asset = await fetchAsset(assetId);
  if (!asset) notFound();

  const [prices, newsResult] = await Promise.all([
    fetchPrices(assetId),
    fetchGoogleNewsRss(asset.asset_name, asset.asset_category_code),
  ]);

  return (
    <>
      <AuthGuard />
      <AppHeader />
      <div className="min-h-screen bg-[#F0F9F2]">
        <ChartDetailContent
          asset={asset}
          prices={prices}
          newsResult={newsResult}
        />
      </div>
      <FooterNav />
    </>
  );
}
