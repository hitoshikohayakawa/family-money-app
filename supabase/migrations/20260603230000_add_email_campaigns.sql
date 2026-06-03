-- ─────────────────────────────────────────────────────────────────────────────
-- Email campaign tables for operator-managed marketing/update emails.
-- NOTE: These columns/tables are ONLY for marketing emails.
-- System notifications (invites, allowances, cashout, etc.) are NOT affected.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add marketing-email opt-out columns to profiles
alter table public.profiles
  add column if not exists marketing_email_enabled          boolean     not null default true,
  add column if not exists marketing_email_unsubscribed_at  timestamptz;

comment on column public.profiles.marketing_email_enabled is
  'Controls marketing/update emails only. System notifications (invites, allowance, cashout, etc.) are always sent regardless of this flag.';

-- 2. Campaign (one record per send job)
create table if not exists public.email_campaigns (
  id            uuid        primary key default gen_random_uuid(),
  subject       text        not null,
  body_text     text        not null,
  target_role   text        not null check (target_role in ('all', 'guardian', 'child')),
  campaign_type text        not null default 'update',
  status        text        not null default 'draft'
                            check (status in ('draft', 'sending', 'done', 'failed')),
  sent_by       uuid        references auth.users(id) on delete set null,
  total_count   integer     not null default 0,
  success_count integer     not null default 0,
  fail_count    integer     not null default 0,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- 3. Per-recipient log
create table if not exists public.email_campaign_recipients (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.email_campaigns(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  email       text        not null,
  status      text        not null default 'pending'
                          check (status in ('pending', 'sent', 'failed')),
  resend_id   text,
  error_msg   text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (campaign_id, user_id)
);

-- 4. Unsubscribe tokens (one persistent token per user)
create table if not exists public.email_unsubscribe_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  token      text        not null unique
                         default (
                           replace(gen_random_uuid()::text, '-', '') ||
                           replace(gen_random_uuid()::text, '-', '')
                         ),
  created_at timestamptz not null default now()
);

create unique index if not exists email_unsubscribe_tokens_user_id_idx
  on public.email_unsubscribe_tokens(user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.email_campaigns             enable row level security;
alter table public.email_campaign_recipients   enable row level security;
alter table public.email_unsubscribe_tokens    enable row level security;

-- email_campaigns: guardian_admin can CRUD their own campaigns
create policy "guardian_admin can manage own campaigns"
  on public.email_campaigns
  for all
  to authenticated
  using (
    sent_by = auth.uid()
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.role    = 'guardian_admin'
        and fm.status  = 'active'
    )
  )
  with check (
    sent_by = auth.uid()
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.role    = 'guardian_admin'
        and fm.status  = 'active'
    )
  );

-- email_campaign_recipients: guardian_admin can SELECT for their own campaigns
create policy "guardian_admin can read own campaign recipients"
  on public.email_campaign_recipients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.email_campaigns ec
      join public.family_memberships fm
        on fm.user_id = auth.uid()
       and fm.role    = 'guardian_admin'
       and fm.status  = 'active'
      where ec.id       = email_campaign_recipients.campaign_id
        and ec.sent_by  = auth.uid()
    )
  );

-- email_unsubscribe_tokens: users can see their own token
create policy "users can read own unsubscribe token"
  on public.email_unsubscribe_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

-- ─── RPC: get_campaign_recipients ─────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS to read all profiles/memberships/tokens.
-- Creates unsubscribe tokens for recipients that don't have one yet.
-- Only callable by guardian_admin.
-- Only used for marketing email sending — NOT for system notifications.

create or replace function public.get_campaign_recipients(p_target_role text)
returns table (user_id uuid, email text, unsubscribe_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.family_memberships
    where user_id = auth.uid()
      and role    = 'guardian_admin'
      and status  = 'active'
  ) then
    raise exception 'Only guardian_admin can retrieve campaign recipients';
  end if;

  -- Auto-create tokens for recipients who don't have one
  insert into public.email_unsubscribe_tokens (user_id)
  select distinct p.id
  from public.profiles p
  join public.family_memberships fm
    on fm.user_id = p.id
   and fm.status  = 'active'
  where p.marketing_email_enabled = true
    and p.email is not null
    and (
      p_target_role = 'all'
      or (p_target_role = 'guardian' and fm.role in ('guardian_admin', 'guardian'))
      or (p_target_role = 'child'   and fm.role = 'child')
    )
  on conflict (user_id) do nothing;

  return query
  select distinct on (p.id)
    p.id    as user_id,
    p.email as email,
    t.token as unsubscribe_token
  from public.profiles p
  join public.family_memberships fm
    on fm.user_id = p.id
   and fm.status  = 'active'
  join public.email_unsubscribe_tokens t
    on t.user_id = p.id
  where p.marketing_email_enabled = true
    and p.email is not null
    and (
      p_target_role = 'all'
      or (p_target_role = 'guardian' and fm.role in ('guardian_admin', 'guardian'))
      or (p_target_role = 'child'   and fm.role = 'child')
    )
  order by p.id;
end;
$$;

revoke all on function public.get_campaign_recipients(text) from public;
grant execute on function public.get_campaign_recipients(text) to authenticated;
