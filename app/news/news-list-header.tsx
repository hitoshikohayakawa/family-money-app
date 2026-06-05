"use client";

import { AutoHiragana } from "@/app/components/auto-hiragana";
import useElementaryMode from "@/app/components/use-elementary-mode";

export default function NewsListHeader() {
  const { elementaryMode } = useElementaryMode();

  return (
    <div className="mt-8 mb-6">
      <h1 className="text-2xl font-extrabold text-[#1F2D20] sm:text-3xl">
        <AutoHiragana enabled={elementaryMode}>ニュース一覧</AutoHiragana>
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-[#516251] sm:text-base">
        <AutoHiragana enabled={elementaryMode}>親子でお金のことを楽しく学べるニュースをお届けします</AutoHiragana>
      </p>
    </div>
  );
}
