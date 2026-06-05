-- news_articles: 子ども向けニュース解説コンテンツ（固定テンプレート方式）

create table news_articles (
  id                   uuid         primary key default gen_random_uuid(),
  title                text         not null,
  slug                 text         unique,
  summary              text,
  hero_image_path      text,
  section1_heading     text,
  section1_body        text,
  section1_image_path  text,
  section2_heading     text,
  section2_body        text,
  section2_image_path  text,
  thinking_question    text,
  source_title         text,
  source_url           text,
  status               text         not null default 'draft'
                                    check (status in ('draft', 'published')),
  published_at         timestamptz,
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);

alter table news_articles enable row level security;

-- ログイン済みユーザーは published 記事のみ参照可
create policy "authenticated_read_published_news"
  on news_articles
  for select
  to authenticated
  using (status = 'published');

-- news-images バケット（public = true でパスから直接URL取得可）
insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do nothing;
