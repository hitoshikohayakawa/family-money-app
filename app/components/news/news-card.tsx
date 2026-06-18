"use client";

import Link from "next/link";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import useElementaryMode from "@/app/components/use-elementary-mode";

type Props = {
  id: string;
  title: string;
  summary: string | null;
  heroImageUrl: string | null;
  publishedAt: string | null;
  isNew?: boolean;
};

export default function NewsCard({
  id,
  title,
  summary,
  heroImageUrl,
  publishedAt,
  isNew = false,
}: Props) {
  const { elementaryMode } = useElementaryMode();

  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("ja-JP")
    : null;

  return (
    <Link href={`/news/${id}`} className="group block">
      <article className="relative flex h-full flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_4px_20px_rgba(76,163,104,0.10)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0">
        {/* NEW badge (latest article only) */}
        {isNew && (
          <span className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-[var(--danger)] px-2.5 py-1 text-xs font-black tracking-wide text-white shadow-[0_2px_8px_rgba(191,110,82,0.4)]">
            NEW
          </span>
        )}

        {/* Hero image or placeholder */}
        {heroImageUrl ? (
          <div className="aspect-[16/9] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-[linear-gradient(135deg,rgba(76,163,104,0.09),rgba(241,226,174,0.16))]">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-[#4BAF57] opacity-40"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
            >
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
            </svg>
          </div>
        )}

        <div className="flex flex-1 flex-col px-5 py-4">
          {/* Category badge */}
          <span className="inline-flex w-fit items-center rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-bold text-[#378C41]">
            <AutoHiragana enabled={elementaryMode}>経済・投資の話題</AutoHiragana>
          </span>

          {/* Title */}
          <h2 className="mt-2.5 text-base font-bold leading-snug text-[#1F2D20] sm:text-[1.05rem]">
            <AutoHiragana enabled={elementaryMode}>{title}</AutoHiragana>
          </h2>

          {/* Summary */}
          {summary && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#516251]">
              <AutoHiragana enabled={elementaryMode}>{summary}</AutoHiragana>
            </p>
          )}

          {/* Footer: date + read link */}
          <div className="mt-auto flex items-center justify-between pt-4">
            {dateStr && (
              <span className="text-xs text-[#7A9E7E]">{dateStr}</span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#4BAF57] transition-colors group-hover:text-[#378C41]">
              <AutoHiragana enabled={elementaryMode}>くわしく見る</AutoHiragana>
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
