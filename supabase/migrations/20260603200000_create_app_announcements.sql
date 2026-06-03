-- Create app_announcements table for operator-managed notices.
-- Managed via Supabase Studio (INSERT/UPDATE/DELETE with service role).
-- Authenticated users can only SELECT active, non-expired rows.

create table if not exists public.app_announcements (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  body         text        not null,
  href         text,
  visible_to   text        not null default 'all',
  active       boolean     not null default true,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

comment on column public.app_announcements.visible_to is
  'Who sees this announcement: ''all'', ''guardian'', or ''child''';

alter table public.app_announcements enable row level security;

-- Authenticated users can read active, non-expired announcements
create policy "authenticated users can read active announcements"
  on public.app_announcements
  for select
  to authenticated
  using (
    active = true
    and (expires_at is null or expires_at > now())
  );
