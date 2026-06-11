"use client";

import Link from "next/link";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import useElementaryMode from "@/app/components/use-elementary-mode";
import MiniLineChart from "@/app/components/charts/mini-line-chart";
import { getAssetMeta } from "@/app/components/charts/asset-meta";

type PriceRow = {
  price_date: string;
  unit_price_jpy: number;
};

type AssetWithPrices = {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_category_code: string;
  description: string | null;
  prices: PriceRow[];
};

type Props = {
  assets: AssetWithPrices[];
};

function categoryColor(code: string): { bg: string; text: string } {
  switch (code) {
    case "index_stock": return { bg: "#E8F5E9", text: "#2E7D32" };
    case "single_stock": return { bg: "#E3F2FD", text: "#1565C0" };
    case "resource":     return { bg: "#FFF8E1", text: "#E65100" };
    case "crypto":       return { bg: "#F3E5F5", text: "#6A1B9A" };
    default:             return { bg: "#F0F9F2", text: "#378C41" };
  }
}

function categoryLabel(code: string): string {
  switch (code) {
    case "index_stock": return "インデックス";
    case "single_stock": return "日本株";
    case "resource": return "コモディティ";
    case "crypto": return "仮想通貨";
    default: return code;
  }
}

function formatPrice(v: number): string {
  if (v >= 1_000_000) return `¥${(v / 1_000_000).toFixed(2)}M`;
  return `¥${v.toLocaleString("ja-JP")}`;
}

function changeInfo(prices: PriceRow[]) {
  if (prices.length < 2) return null;
  const latest = prices[prices.length - 1].unit_price_jpy;
  const prev = prices[prices.length - 2].unit_price_jpy;
  const diff = latest - prev;
  const rate = prev > 0 ? ((diff / prev) * 100).toFixed(1) : "0.0";
  const positive = diff >= 0;
  return { text: `${positive ? "+" : ""}${rate}%`, positive };
}

function ChartMascot({ elementaryMode }: { elementaryMode: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative rounded-[16px] bg-white px-4 py-2.5 shadow-[0_4px_16px_rgba(76,163,104,0.15)]">
        <p className="text-xs font-bold leading-snug text-[#1F2D20]">
          <AutoHiragana enabled={elementaryMode}>気になる会社の</AutoHiragana>
          <br />
          <AutoHiragana enabled={elementaryMode}>値動きを見てみよう！</AutoHiragana>
        </p>
        {/* 吹き出しの三角（右向き） */}
        <svg
          className="absolute -right-[14px] top-1/2 -translate-y-1/2"
          width="14"
          height="20"
          viewBox="0 0 14 20"
          aria-hidden
        >
          <path d="M0 0 L14 10 L0 20 Z" fill="white" />
        </svg>
      </div>
      <div className="relative h-24 w-24 shrink-0 sm:h-32 sm:w-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/character/mirakun-chart.png"
          alt="ミラくん"
          className="h-full w-full object-contain drop-shadow-md"
        />
      </div>
    </div>
  );
}

export default function ChartsPageContent({ assets }: Props) {
  const { elementaryMode } = useElementaryMode();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">

      {/* ── Page header ── */}
      <div className="mb-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4BAF57] to-[#2E8B57] p-5 shadow-[0_8px_32px_rgba(75,175,87,0.25)]">
        {/* モバイル: 縦積み / デスクトップ: 横並び */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-white">
                <AutoHiragana enabled={elementaryMode}>チャート</AutoHiragana>
              </h1>
            </div>
            <p className="mt-1.5 text-sm font-medium text-white/85">
              <AutoHiragana enabled={elementaryMode}>投資できる銘柄の値動きを見てみよう</AutoHiragana>
            </p>
            <p className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm">
              <AutoHiragana enabled={elementaryMode}>※価格は参考です（20分遅れ）</AutoHiragana>
            </p>
          </div>
          <div className="shrink-0 self-end sm:self-auto">
            <ChartMascot elementaryMode={elementaryMode} />
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_2px_12px_rgba(76,163,104,0.08)]">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-[#4BAF57]" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-xs leading-relaxed text-[#516251]">
          <AutoHiragana enabled={elementaryMode}>このチャートは投資の勉強のためのものです。実際の投資判断は大人と一緒に考えましょう。</AutoHiragana>
        </p>
      </div>

      {/* ── Asset grid ── */}
      {assets.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-3xl bg-white text-sm text-[#7A9E7E]">
          <AutoHiragana enabled={elementaryMode}>銘柄データがまだ登録されていません</AutoHiragana>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const { prices } = asset;
            const latest = prices[prices.length - 1];
            const change = changeInfo(prices);
            const meta = getAssetMeta(asset.asset_code);
            const cat = categoryColor(asset.asset_category_code);

            return (
              <Link key={asset.id} href={`/charts/${asset.id}`} className="group block">
                <article className="flex h-full flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_4px_24px_rgba(76,163,104,0.10)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(76,163,104,0.18)] active:translate-y-0">

                  <div className="px-5 pt-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                        style={{ backgroundColor: meta.iconBg }}
                      >
                        {meta.emoji}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: cat.bg, color: cat.text }}
                        >
                          <AutoHiragana enabled={elementaryMode}>{categoryLabel(asset.asset_category_code)}</AutoHiragana>
                        </span>
                        <h2 className="mt-1 text-[15px] font-black leading-tight text-[#1F2D20]">
                          <AutoHiragana enabled={elementaryMode}>{asset.asset_name}</AutoHiragana>
                        </h2>
                        {meta.ticker && (
                          <p className="text-[11px] text-[#7A9E7E]">
                            {meta.ticker}・<AutoHiragana enabled={elementaryMode}>{meta.exchange}</AutoHiragana>
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-[#516251]">
                      <AutoHiragana enabled={elementaryMode}>
                        {meta.shortDesc || asset.description || "この銘柄の説明は準備中です"}
                      </AutoHiragana>
                    </p>
                  </div>

                  <div className="mx-5 mt-4 border-t border-[#F0F0F0]" />

                  <div className="flex items-center justify-between gap-2 px-5 py-4">
                    <div>
                      {latest ? (
                        <>
                          <p className="text-xl font-black text-[#1F2D20]">
                            {formatPrice(latest.unit_price_jpy)}
                          </p>
                          {change ? (
                            <span
                              className={`mt-0.5 inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                                change.positive
                                  ? "bg-[#E8F5E9] text-[#4BAF57]"
                                  : "bg-[#FDECEA] text-[#E57373]"
                              }`}
                            >
                              {change.text}
                            </span>
                          ) : (
                            <p className="text-xs text-[#7A9E7E]">{latest.price_date}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-[#7A9E7E]">
                          <AutoHiragana enabled={elementaryMode}>価格データなし</AutoHiragana>
                        </p>
                      )}
                    </div>

                    <MiniLineChart
                      prices={prices}
                      positive={change?.positive}
                      width={96}
                      height={44}
                      gradientId={`mini-${asset.asset_code}`}
                    />
                  </div>

                  <div className="border-t border-[#F0F0F0] px-5 py-3">
                    <span className="flex items-center justify-end gap-1 text-xs font-bold text-[#4BAF57] transition-colors group-hover:text-[#2E8B57]">
                      <AutoHiragana enabled={elementaryMode}>詳しく見る</AutoHiragana>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Learning tips ── */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: "📊",
            title: "ポイント",
            body: "どの会社の値段がどう動いているか、グラフでチェックできるよ！",
          },
          {
            icon: "🔍",
            title: "見方のコツ",
            body: "上に上がっているときは「人気が高まっている」のかも？下に下がっているときは「心配なことがある」のかも？ニュースを読んで、大人と一緒に考えてみよう！",
          },
          {
            icon: "👨‍👩‍👧",
            title: "大人の方へ",
            body: "このチャートやニュースをきっかけに、お子さまと一緒に会社や社会のことを話す時間にしてみてください。",
          },
        ].map((tip) => (
          <div key={tip.title} className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(76,163,104,0.08)]">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{tip.icon}</span>
              <p className="text-sm font-black text-[#1F2D20]">
                <AutoHiragana enabled={elementaryMode}>{tip.title}</AutoHiragana>
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#516251]">
              <AutoHiragana enabled={elementaryMode}>{tip.body}</AutoHiragana>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
