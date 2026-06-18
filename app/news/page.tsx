import type { Metadata } from "next";
import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import FooterNav from "@/app/components/ui/footer-nav";
import EmptyState from "@/app/components/ui/empty-state";
import NewsPageHeader from "@/app/components/news/news-page-header";
import NewsCard from "@/app/components/news/news-card";
import NewsListHeader from "@/app/news/news-list-header";
import { createServiceRoleServerClient } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ニュース | ミラマネ",
  description: "お金と社会の話を、わかりやすく学ぼう。",
};

type NewsArticleRow = {
  id: string;
  title: string;
  summary: string | null;
  hero_image_path: string | null;
  published_at: string | null;
};

function articleImageUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/news-images/${path}`;
}

export default async function NewsPage() {
  const client = createServiceRoleServerClient();
  const { data: articles } = await client
    .from("news_articles")
    .select("id, title, summary, hero_image_path, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const rows = (articles ?? []) as NewsArticleRow[];

  return (
    <>
      <AuthGuard />
      <AppHeader />
      <div className="min-h-screen bg-[#F0F9F2]">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          {/* Common header image */}
          <NewsPageHeader />

          {/* Section title */}
          <NewsListHeader />

          {/* Articles */}
          {rows.length === 0 ? (
            <EmptyState
              title="まだ公開されているニュースはありません"
              description="ニュースが追加されるまで少しお待ちください"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((article, index) => (
                <NewsCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  summary={article.summary}
                  heroImageUrl={articleImageUrl(article.hero_image_path)}
                  publishedAt={article.published_at}
                  isNew={index === 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <FooterNav />
    </>
  );
}
