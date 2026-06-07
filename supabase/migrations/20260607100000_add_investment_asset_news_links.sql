create table if not exists public.investment_asset_news_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.investment_assets(id) on delete cascade,
  title text not null,
  url text not null,
  source_name text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists investment_asset_news_links_asset_id_idx
  on public.investment_asset_news_links (asset_id, published_at desc);

alter table public.investment_asset_news_links enable row level security;

create policy "investment_asset_news_links_select_authenticated"
on public.investment_asset_news_links
for select
to authenticated
using (true);

grant select on public.investment_asset_news_links to authenticated;

comment on table public.investment_asset_news_links is
  'External news links related to each investment asset. Managed via Supabase Studio. Read-only for authenticated users.';
