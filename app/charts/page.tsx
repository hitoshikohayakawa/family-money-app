import type { Metadata } from "next";
import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import FooterNav from "@/app/components/ui/footer-nav";
import ChartsPageContent from "@/app/charts/charts-page-content";
import { createServiceRoleServerClient } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "チャート | ミラマネ",
  description: "投資できる銘柄の値動きを見てみよう。",
};

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_category_code: string;
  description: string | null;
};

type PriceRow = {
  asset_id: string;
  price_date: string;
  unit_price_jpy: number;
};

export default async function ChartsPage() {
  const client = createServiceRoleServerClient();

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const since = threeMonthsAgo.toISOString().slice(0, 10);

  const [{ data: assetsRaw }, { data: pricesRaw }] = await Promise.all([
    client
      .from("investment_assets")
      .select("id, asset_code, asset_name, asset_category_code, description")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    client
      .from("investment_asset_prices")
      .select("asset_id, price_date, unit_price_jpy")
      .gte("price_date", since)
      .order("price_date", { ascending: true }),
  ]);

  const assets = (assetsRaw ?? []) as AssetRow[];
  const allPrices = (pricesRaw ?? []) as PriceRow[];

  const pricesByAsset = new Map<string, PriceRow[]>();
  for (const p of allPrices) {
    const list = pricesByAsset.get(p.asset_id) ?? [];
    list.push(p);
    pricesByAsset.set(p.asset_id, list);
  }

  const assetsWithPrices = assets.map((asset) => ({
    ...asset,
    prices: (pricesByAsset.get(asset.id) ?? []).map((p) => ({
      price_date: p.price_date,
      unit_price_jpy: p.unit_price_jpy,
    })),
  }));

  return (
    <>
      <AuthGuard />
      <AppHeader />
      <div className="min-h-screen bg-[#F0F9F2]">
        <ChartsPageContent assets={assetsWithPrices} />
      </div>
      <FooterNav />
    </>
  );
}
