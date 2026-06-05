"use client";

import { useEffect, useRef, useState } from "react";
import { getJapaneseConverter } from "@/lib/japanese-converter";

type Props = {
  /** The Japanese text to display. When enabled=false, rendered as-is. */
  children: string;
  /** Whether to convert kanji → hiragana. Typically tied to elementary mode. */
  enabled: boolean;
};

/**
 * Renders text as-is when enabled=false.
 * When enabled=true, converts kanji to hiragana using kuroshiro.
 * Shows original text while the conversion is in progress.
 */
export function AutoHiragana({ children, enabled }: Props) {
  const [convertedText, setConvertedText] = useState(children);
  const latestRef = useRef(0);

  useEffect(() => {
    // Increment every run so prior async calls can detect they're stale
    const requestId = ++latestRef.current;

    if (!enabled) return;

    getJapaneseConverter()
      .then((convert) => convert(children))
      .then((result) => {
        if (latestRef.current === requestId) {
          setConvertedText(result);
        }
      })
      .catch(() => {
        if (latestRef.current === requestId) {
          setConvertedText(children);
        }
      });
  }, [children, enabled]);

  return <>{enabled ? convertedText : children}</>;
}
