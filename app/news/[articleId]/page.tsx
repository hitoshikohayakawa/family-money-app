import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import FooterNav from "@/app/components/ui/footer-nav";
import { createServiceRoleServerClient } from "@/lib/server-supabase";
import ArticleContent from "./article-content";

type Params = Promise<{ articleId: string }>;

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

function articleImageUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/news-images/${path}`;
}

async function fetchArticle(articleId: string): Promise<NewsArticle | null> {
  const client = createServiceRoleServerClient();
  const { data } = await client
    .from("news_articles")
    .select(
      "id, title, summary, hero_image_path, section1_heading, section1_body, section1_image_path, section2_heading, section2_body, section2_image_path, thinking_question, source_title, source_url, published_at"
    )
    .eq("id", articleId)
    .eq("status", "published")
    .maybeSingle();
  return data as NewsArticle | null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { articleId } = await params;
  const article = await fetchArticle(articleId);
  if (!article) return { title: "ニュース | ミラマネ" };
  return {
    title: `${article.title} | ミラマネ`,
    description: article.summary ?? undefined,
  };
}

export default async function NewsArticlePage({ params }: { params: Params }) {
  const { articleId } = await params;
  const article = await fetchArticle(articleId);

  if (!article) notFound();

  const heroUrl = articleImageUrl(article.hero_image_path);
  const section1ImageUrl = articleImageUrl(article.section1_image_path);
  const section2ImageUrl = articleImageUrl(article.section2_image_path);
  const dateStr = article.published_at
    ? new Date(article.published_at).toLocaleDateString("ja-JP")
    : null;

  return (
    <>
      <AuthGuard />
      <AppHeader />
      <div className="min-h-screen bg-[#F0F9F2]">
        <ArticleContent
          article={article}
          heroUrl={heroUrl}
          section1ImageUrl={section1ImageUrl}
          section2ImageUrl={section2ImageUrl}
          dateStr={dateStr}
        />
      </div>
      <FooterNav />
    </>
  );
}
