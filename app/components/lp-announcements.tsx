"use client";

import { useEffect, useState } from "react";

type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// Section 09: アップデート情報
// 公開API (/api/announcements/public) から最新のお知らせを取得して表示する。
// 取得できない / 0件の場合はセクションごと非表示にする（プレースホルダーは出さない）。
export default function LpAnnouncements() {
  const [items, setItems] = useState<PublicAnnouncement[] | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/announcements/public", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (active) setItems([]);
          return;
        }
        const json = (await res.json()) as { announcements?: PublicAnnouncement[] };
        if (active) setItems(json.announcements ?? []);
      } catch {
        if (active) setItems([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 読み込み前 / 0件は非表示
  if (!items || items.length === 0) return null;

  return (
    <section className="px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <span className="inline-flex rounded-full bg-[#E8F5E9] px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-[#378C41]">
            アップデート情報
          </span>
          <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
            ミラマネは、
            <span className="text-[#4BAF57]">少しずつ進化</span>
            しています
          </h2>
        </div>
        {/* 1〜2件でも中央寄せにせず左詰め。md以上で3カラム・カード高さは揃える */}
        <div className="mt-9 grid items-stretch gap-5 md:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex h-full flex-col rounded-[26px] border border-[rgba(55,140,65,0.12)] bg-white p-6 shadow-[0_18px_44px_rgba(75,175,87,0.10)]"
            >
              <time className="text-xs font-bold tracking-wide text-[#8AA08C]">
                {formatDate(item.published_at)}
              </time>
              <h3 className="mt-3 text-lg font-extrabold leading-7 text-[#1F2D20]">
                {item.title}
              </h3>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-[#516251]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
