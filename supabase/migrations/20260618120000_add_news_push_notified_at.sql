-- news_articles: 公開時プッシュ通知の再送防止フラグ
-- push_notified_at が NULL の published 記事を「未通知の新着」とみなして通知する。

alter table news_articles
  add column if not exists push_notified_at timestamptz;

-- 既存の公開済み記事は通知済み扱いにバックフィルする。
-- （これをしないと初回 cron で過去記事を全ユーザーへ一斉通知してしまう）
update news_articles
set push_notified_at = coalesce(published_at, now())
where status = 'published'
  and push_notified_at is null;
