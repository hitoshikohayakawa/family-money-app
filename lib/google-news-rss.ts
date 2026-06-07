import { unstable_cache } from "next/cache";

export type RssNewsItem = {
  title: string;
  url: string;
  sourceName: string | null;
  pubDateStr: string | null;
};

export type NewsResult =
  | { ok: true; items: RssNewsItem[] }
  | { ok: false; error: string };

function parseCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function extractFirst(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}(?:[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = regex.exec(xml);
  return m ? parseCdata(m[1]).trim() : null;
}

function parseRssItems(xml: string, limit: number): RssNewsItem[] {
  const items: RssNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const title = extractFirst(block, "title");
    const link = extractFirst(block, "link");
    const pubDate = extractFirst(block, "pubDate");
    const source = extractFirst(block, "source");

    if (!title || !link) continue;

    items.push({
      title,
      url: link,
      sourceName: source,
      pubDateStr: pubDate,
    });
  }

  return items;
}

function buildQuery(assetName: string, categoryCode: string): string {
  switch (categoryCode) {
    case "single_stock":
      return `${assetName} 株 ニュース`;
    case "resource":
      return `${assetName} 価格 ニュース`;
    default:
      return `${assetName} ニュース`;
  }
}

async function fetchRssInternal(assetName: string, categoryCode: string): Promise<NewsResult> {
  const query = buildQuery(assetName, categoryCode);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Miramane/1.0; +https://miramane.app)" },
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const xml = await res.text();
    const items = parseRssItems(xml, 5);
    return { ok: true, items };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

// Cache for 1 hour regardless of force-dynamic on the consuming page.
// unstable_cache uses Next.js's server-side Data Cache, not the fetch cache,
// so it works even when the route has force-dynamic.
export const fetchGoogleNewsRss = unstable_cache(
  fetchRssInternal,
  ["google-news-rss"],
  { revalidate: 3600 }
);
