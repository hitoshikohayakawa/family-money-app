-- news_articles: status が published に変わったとき published_at を自動セット
-- published_at が NULL のまま公開すると降順ソートで末尾に落ちる問題の対策

create or replace function set_published_at_on_publish()
returns trigger as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger news_articles_set_published_at
  before update on news_articles
  for each row execute function set_published_at_on_publish();
