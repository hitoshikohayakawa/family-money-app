create table if not exists public.pending_admin_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  family_name text not null,
  status text not null default 'pending',
  auth_invite_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pending_admin_signups_status_check
    check (status in ('pending', 'completed', 'expired', 'cancelled'))
);

create index if not exists pending_admin_signups_email_idx
  on public.pending_admin_signups (lower(email));

create index if not exists pending_admin_signups_status_idx
  on public.pending_admin_signups (status);

create unique index if not exists pending_admin_signups_pending_email_unique_idx
  on public.pending_admin_signups (lower(email))
  where status = 'pending';