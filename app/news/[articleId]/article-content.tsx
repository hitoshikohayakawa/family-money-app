"use client";

import Link from "next/link";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import NewsPageHeader from "@/app/components/news/news-page-header";
import useElementaryMode from "@/app/components/use-elementary-mode";

type NewsArticle = {
  id: string;
  title: string;
  summary: string | null;
  hero_image_path: string | null;
  section1_heading: string | null;
  section1_body: string | null;
  section1_image_path: string | null;
  section2_heading: string | null;
  section2_body: string | null;
  section2_image_path: string | null;
  thinking_question: string | null;
  source_title: string | null;
  source_url: string | null;
  published_at: string | null;
};

type Props = {
  article: NewsArticle;
  heroUrl: string | null;
  section1ImageUrl: string | null;
  section2ImageUrl: string | null;
  dateStr: string | null;
};

export default function ArticleContent({
  article,
  heroUrl,
  section1ImageUrl,
  section2ImageUrl,
  dateStr,
}: Props) {
  const { elementaryMode } = useElementaryMode();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <Link
        href="/news"
        className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-[#378C41] transition-colors hover:text-[#2F6F3A]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <AutoHiragana enabled={elementaryMode}>ニュース一覧に戻る</AutoHiragana>
      </Link>

      <NewsPageHeader />

      {/* Article hero card */}
      <div className="mt-6 overflow-hidden rounded-[24px] bg-white shadow-[0_4px_24px_rgba(76,163,104,0.10)]">
        <div className="px-6 pt-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-bold text-[#378C41]">
              <AutoHiragana enabled={elementaryMode}>経済・投資の話題</AutoHiragana>
            </span>
            {dateStr && (
              <span className="text-xs text-[#7A9E7E]">{dateStr}</span>
            )}
          </div>

          <h1 className="mt-3 text-[1.65rem] font-extrabold leading-tight tracking-tight text-[#1F2D20] sm:text-[2rem]">
            <AutoHiragana enabled={elementaryMode}>{article.title}</AutoHiragana>
          </h1>

          {article.summary && (
            <p className="mt-2.5 text-base leading-relaxed text-[#516251] sm:text-lg">
              <AutoHiragana enabled={elementaryMode}>{article.summary}</AutoHiragana>
            </p>
          )}

          {article.summary && (
            <div className="mt-5 flex items-start gap-3 rounded-[14px] bg-[#F0F9F2] px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#4BAF57]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
              </div>
              <p className="text-sm leading-relaxed text-[#516251]">
                <AutoHiragana enabled={elementaryMode}>{article.summary}</AutoHiragana>
              </p>
            </div>
          )}
        </div>

        {heroUrl ? (
          <div className="mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroUrl}
              alt={article.title}
              className="block h-auto w-full"
            />
          </div>
        ) : (
          <div className="pb-6" />
        )}
      </div>

      {/* Article body */}
      <div className="mt-5 space-y-5">
        {article.section1_heading && (
          <section className="rounded-[24px] bg-white px-6 py-6 shadow-[0_4px_20px_rgba(76,163,104,0.08)] sm:px-8">
            <h2 className="text-[1.2rem] font-bold text-[#1F2D20] sm:text-[1.35rem]">
              <AutoHiragana enabled={elementaryMode}>{article.section1_heading}</AutoHiragana>
            </h2>
            {article.section1_body && (
              <p className="mt-3 whitespace-pre-wrap text-base leading-[1.85] text-[#516251]">
                <AutoHiragana enabled={elementaryMode}>{article.section1_body}</AutoHiragana>
              </p>
            )}
            {section1ImageUrl && (
              <div className="mt-5 overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={section1ImageUrl}
                  alt={article.section1_heading}
                  className="h-auto w-full"
                />
              </div>
            )}
          </section>
        )}

        {article.section2_heading && (
          <section className="rounded-[24px] bg-white px-6 py-6 shadow-[0_4px_20px_rgba(76,163,104,0.08)] sm:px-8">
            <h2 className="text-[1.2rem] font-bold text-[#1F2D20] sm:text-[1.35rem]">
              <AutoHiragana enabled={elementaryMode}>{article.section2_heading}</AutoHiragana>
            </h2>
            {article.section2_body && (
              <p className="mt-3 whitespace-pre-wrap text-base leading-[1.85] text-[#516251]">
                <AutoHiragana enabled={elementaryMode}>{article.section2_body}</AutoHiragana>
              </p>
            )}
            {section2ImageUrl && (
              <div className="mt-5 overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={section2ImageUrl}
                  alt={article.section2_heading}
                  className="h-auto w-full"
                />
              </div>
            )}
          </section>
        )}

        {article.thinking_question && (
          <section className="rounded-[24px] border border-[rgba(76,163,104,0.18)] bg-[linear-gradient(135deg,rgba(76,163,104,0.07),rgba(241,226,174,0.12))] px-6 py-6 sm:px-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#4BAF57]">
              <AutoHiragana enabled={elementaryMode}>考えてみよう</AutoHiragana>
            </p>
            <p className="text-base font-semibold leading-relaxed text-[#1F2D20]">
              <AutoHiragana enabled={elementaryMode}>{article.thinking_question}</AutoHiragana>
            </p>
          </section>
        )}

        {article.source_url && article.source_title && (
          <section className="rounded-[20px] bg-white px-6 py-4 shadow-[0_2px_12px_rgba(76,163,104,0.06)] sm:px-8">
            <p className="text-xs font-semibold text-[#7A9E7E]">
              <AutoHiragana enabled={elementaryMode}>出典</AutoHiragana>
            </p>
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm font-bold text-[#4BAF57] underline underline-offset-2 hover:text-[#378C41]"
            >
              {article.source_title}（<AutoHiragana enabled={elementaryMode}>もっと詳しく見る</AutoHiragana>）
            </a>
          </section>
        )}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(76,163,104,0.25)] bg-white px-6 py-3 text-sm font-bold text-[#378C41] shadow-[0_2px_12px_rgba(76,163,104,0.08)] transition hover:bg-[#F0F9F2]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <AutoHiragana enabled={elementaryMode}>ニュース一覧に戻る</AutoHiragana>
        </Link>
      </div>
    </div>
  );
}
