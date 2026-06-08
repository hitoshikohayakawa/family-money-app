"use client";

import Link from "next/link";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import useElementaryMode from "@/app/components/use-elementary-mode";
import FullLineChart from "@/app/components/charts/full-line-chart";
import { getAssetMeta } from "@/app/components/charts/asset-meta";
import type { NewsResult, RssNewsItem } from "@/lib/google-news-rss";

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

type Props = {
  asset: AssetRow;
  prices: PriceRow[];
  newsResult: NewsResult;
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

function formatPubDate(s: string | null): string | null {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString("ja-JP"); } catch { return null; }
}

function NewsCard({ item, elementaryMode }: { item: RssNewsItem; elementaryMode: boolean }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-[16px] border border-[#E8F5E9] bg-[#F8FDF8] px-4 py-3.5 transition hover:bg-[#EDF7EE] hover:shadow-[0_2px_12px_rgba(76,163,104,0.10)]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-[#1F2D20] group-hover:text-[#4BAF57]">
          <AutoHiragana enabled={elementaryMode}>{item.title}</AutoHiragana>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[#7A9E7E]">
          {item.sourceName && (
            <span className="font-semibold">
              <AutoHiragana enabled={elementaryMode}>{item.sourceName}</AutoHiragana>
            </span>
          )}
          {formatPubDate(item.pubDateStr) && <span>{formatPubDate(item.pubDateStr)}</span>}
        </div>
      </div>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-[#B0C8B5]" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  );
}

export default function ChartDetailContent({ asset, prices, newsResult }: Props) {
  const { elementaryMode } = useElementaryMode();

  const meta = getAssetMeta(asset.asset_code);
  const cat = categoryColor(asset.asset_category_code);

  const latestPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 2];
  const diffJpy =
    latestPrice && prevPrice
      ? latestPrice.unit_price_jpy - prevPrice.unit_price_jpy
      : null;
  const diffRate =
    diffJpy != null && prevPrice && prevPrice.unit_price_jpy > 0
      ? ((diffJpy / prevPrice.unit_price_jpy) * 100).toFixed(1)
      : null;
  const isPositive = diffJpy != null ? diffJpy >= 0 : null;

  const googleNewsUrl = `https://news.google.com/search?q=${encodeURIComponent(asset.asset_name)}&hl=ja&gl=JP`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6">

      {/* ── Back link ── */}
      <Link
        href="/charts"
        className="inline-flex items-center gap-1 text-sm font-bold text-[#4BAF57] hover:text-[#2E8B57]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <AutoHiragana enabled={elementaryMode}>戻る</AutoHiragana>
      </Link>

      {/* ── Company header card ── */}
      <div className="mt-4 overflow-hidden rounded-[28px] bg-white shadow-[0_4px_28px_rgba(76,163,104,0.12)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#4BAF57] to-[#74C47E]" />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] text-5xl shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
              style={{ backgroundColor: meta.iconBg }}
            >
              {meta.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: cat.bg, color: cat.text }}
              >
                <AutoHiragana enabled={elementaryMode}>{categoryLabel(asset.asset_category_code)}</AutoHiragana>
              </span>

              <h1 className="mt-1.5 text-[22px] font-black leading-tight text-[#1F2D20]">
                <AutoHiragana enabled={elementaryMode}>{asset.asset_name}</AutoHiragana>
              </h1>

              {meta.ticker ? (
                <p className="mt-0.5 text-xs font-semibold text-[#7A9E7E]">
                  {meta.ticker}・<AutoHiragana enabled={elementaryMode}>{meta.exchange}</AutoHiragana>
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-semibold text-[#7A9E7E]">
                  <AutoHiragana enabled={elementaryMode}>{meta.exchange}</AutoHiragana>
                </p>
              )}
            </div>
          </div>

          {(meta.shortDesc || asset.description) && (
            <div className="mt-4 rounded-2xl bg-[#F6FBF6] px-4 py-3">
              <p className="text-sm leading-relaxed text-[#516251]">
                <AutoHiragana enabled={elementaryMode}>
                  {asset.description ?? meta.shortDesc}
                </AutoHiragana>
              </p>
            </div>
          )}

          {latestPrice ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F6FBF6] px-4 py-3">
                <p className="text-[11px] font-semibold text-[#7A9E7E]">
                  <AutoHiragana enabled={elementaryMode}>最新の価格</AutoHiragana>
                  （{latestPrice.price_date}）
                </p>
                <p className="mt-1 text-2xl font-black text-[#1F2D20]">
                  {formatPrice(latestPrice.unit_price_jpy)}
                </p>
              </div>

              {diffJpy != null && diffRate != null ? (
                <div className={`rounded-2xl px-4 py-3 ${isPositive ? "bg-[#E8F5E9]" : "bg-[#FDECEA]"}`}>
                  <p className="text-[11px] font-semibold text-[#7A9E7E]">
                    <AutoHiragana enabled={elementaryMode}>前日比</AutoHiragana>
                  </p>
                  <p className={`mt-1 text-2xl font-black ${isPositive ? "text-[#4BAF57]" : "text-[#E57373]"}`}>
                    {isPositive ? "+" : ""}{diffRate}%
                  </p>
                  <p className={`text-xs font-semibold ${isPositive ? "text-[#4BAF57]" : "text-[#E57373]"}`}>
                    {isPositive ? "+" : ""}{formatPrice(Math.abs(diffJpy))}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#F6FBF6] px-4 py-3">
                  <p className="text-[11px] font-semibold text-[#7A9E7E]">
                    <AutoHiragana enabled={elementaryMode}>前日比</AutoHiragana>
                  </p>
                  <p className="mt-1 text-sm text-[#7A9E7E]">—</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 flex h-16 items-center justify-center rounded-2xl bg-[#F6FBF6] text-sm text-[#7A9E7E]">
              <AutoHiragana enabled={elementaryMode}>価格データがまだありません</AutoHiragana>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart card ── */}
      <div className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_4px_28px_rgba(76,163,104,0.12)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#1F2D20]">
              <AutoHiragana enabled={elementaryMode}>直近3か月の値動き（終値）</AutoHiragana>
            </h2>
            <p className="mt-0.5 text-xs text-[#7A9E7E]">
              <AutoHiragana enabled={elementaryMode}>1日の最後の価格をつないだものです。細かい動きではなく、大きな流れを見てみましょう。</AutoHiragana>
            </p>
          </div>
          <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[10px] font-bold text-[#4BAF57]">
            <AutoHiragana enabled={elementaryMode}>日足</AutoHiragana>
          </span>
        </div>

        <div className="mt-4">
          <FullLineChart prices={prices} />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FFFBEA] px-3 py-2.5">
          <span className="text-base">💡</span>
          <p className="text-xs leading-relaxed text-[#856404]">
            <AutoHiragana enabled={elementaryMode}>このチャートは投資の勉強のためのものです。実際の投資判断は大人と一緒に考えましょう。</AutoHiragana>
          </p>
        </div>
      </div>

      {/* ── News card ── */}
      <div className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_4px_28px_rgba(76,163,104,0.12)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8F5E9]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#4BAF57]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
            </svg>
          </div>
          <h2 className="text-base font-black text-[#1F2D20]">
            <AutoHiragana enabled={elementaryMode}>関連ニュース</AutoHiragana>
          </h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#7A9E7E]">
          <AutoHiragana enabled={elementaryMode}>大人と一緒に読んで、なぜ値段が動いたのか考えてみましょう。</AutoHiragana>
        </p>

        <div className="mt-4 grid gap-2">
          {!newsResult.ok ? (
            <div className="flex h-16 items-center justify-center rounded-2xl bg-[#FFF8F8] text-sm text-[#E57373]">
              <AutoHiragana enabled={elementaryMode}>関連ニュースを取得できませんでした</AutoHiragana>
            </div>
          ) : newsResult.items.length === 0 ? (
            <div className="flex h-16 items-center justify-center rounded-2xl bg-[#F0F9F2] text-sm text-[#7A9E7E]">
              <AutoHiragana enabled={elementaryMode}>関連ニュースはまだありません</AutoHiragana>
            </div>
          ) : (
            newsResult.items.map((item, idx) => (
              <NewsCard key={idx} item={item} elementaryMode={elementaryMode} />
            ))
          )}

          <a
            href={googleNewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-2 rounded-2xl border-2 border-[#C8E6C9] bg-white py-3 text-sm font-bold text-[#4BAF57] transition hover:bg-[#E8F5E9]"
          >
            <AutoHiragana enabled={elementaryMode}>もっとニュースを見る</AutoHiragana>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

    </div>
  );
}
