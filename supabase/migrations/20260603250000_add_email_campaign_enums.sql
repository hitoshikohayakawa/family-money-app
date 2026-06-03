-- Convert email_campaigns text columns to proper enum types.
-- Prevents typos and invalid values when inserting via Supabase Studio.

-- ── 1. Create enum types ──────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'email_campaign_target_role'
                   and typnamespace = 'public'::regnamespace) then
    create type public.email_campaign_target_role as enum ('all', 'guardian', 'child');
  end if;
end $$;

comment on type public.email_campaign_target_role is
  'guardian = 親向け配信 (guardian_admin + guardian の両方が対象)';

do $$ begin
  if not exists (select 1 from pg_type where typname = 'email_campaign_type'
                   and typnamespace = 'public'::regnamespace) then
    create type public.email_campaign_type as enum ('update', 'maintenance', 'survey', 'important');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'email_campaign_status'
                   and typnamespace = 'public'::regnamespace) then
    create type public.email_campaign_status as enum ('draft', 'sending', 'done', 'failed');
  end if;
end $$;

-- ── 2. Drop auto-generated check constraints on email_campaigns ───────────────
-- Column-level CHECK constraints are named automatically by PostgreSQL.
-- We drop them all so the ALTER TYPE below can succeed.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from   pg_constraint c
    join   pg_class      t on t.oid = c.conrelid
    join   pg_namespace  n on n.oid = t.relnamespace
    where  t.relname  = 'email_campaigns'
      and  n.nspname  = 'public'
      and  c.contype  = 'c'
  loop
    execute 'alter table public.email_campaigns drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

-- ── 3. Convert columns to enum types ─────────────────────────────────────────
-- Must drop defaults before changing column types, then restore with enum casting.

alter table public.email_campaigns
  alter column campaign_type drop default,
  alter column status        drop default;

alter table public.email_campaigns
  alter column target_role   type public.email_campaign_target_role
    using target_role::public.email_campaign_target_role,
  alter column campaign_type type public.email_campaign_type
    using campaign_type::public.email_campaign_type,
  alter column status        type public.email_campaign_status
    using status::public.email_campaign_status;

-- Restore defaults with proper enum casting
alter table public.email_campaigns
  alter column campaign_type set default 'update'::public.email_campaign_type,
  alter column status        set default 'draft'::public.email_campaign_status;

-- ── 4. Update get_campaign_recipients RPC ─────────────────────────────────────
-- Argument stays as text (convenient for JS callers) but is validated internally.
-- target_role = 'guardian' includes BOTH guardian_admin AND guardian roles.

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

  -- Validate argument against enum
  if p_target_role not in ('all', 'guardian', 'child') then
    raise exception 'Invalid target_role: %. Must be all, guardian, or child.', p_target_role;
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
