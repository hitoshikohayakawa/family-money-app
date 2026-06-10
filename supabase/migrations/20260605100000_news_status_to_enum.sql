-- news_articles.status を text → enum に変換
-- Supabase Studio がドロップダウン表示するようになる

create type news_article_status as enum ('draft', 'published');

-- RLS ポリシーが status カラムを参照しているため、型変換前に一時削除
drop policy if exists "authenticated_read_published_news" on news_articles;

-- default を一時的に外してから型変換
alter table news_articles alter column status drop default;

-- inline check 制約を削除（auto命名: news_articles_status_check）
alter table news_articles drop constraint if exists news_articles_status_check;

-- text → enum にキャスト変換（既存データも変換される）
alter table news_articles
  alter column status type news_article_status
  using status::news_article_status;

-- default を enum 型で再設定
alter table news_articles
  alter column status set default 'draft'::news_article_status;

-- RLS ポリシーを再作成（enum 型で比較）
create policy "authenticated_read_published_news"
  on news_articles
  for select
  to authenticated
  using (status = 'published'::news_article_status);
