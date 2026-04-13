create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  role text not null check (role in ('guardian', 'child')),
  invited_by_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'accepted' and accepted_at is not null)
    or (status <> 'accepted')
  )
);

create index if not exists family_invites_family_id_idx
  on public.family_invites (family_id);

create index if not exists family_invites_invited_by_user_id_idx
  on public.family_invites (invited_by_user_id);

create index if not exists family_invites_status_idx
  on public.family_invites (status);

create unique index if not exists family_invites_pending_unique_idx
  on public.family_invites (family_id, lower(email))
  where status = 'pending';

alter table public.family_invites enable row level security;

drop policy if exists "family_invites_select_family_members" on public.family_invites;
create policy "family_invites_select_family_members"
on public.family_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_invites.family_id
      and fm.user_id = auth.uid()
  )
);

drop policy if exists "family_invites_insert_guardian_admin" on public.family_invites;
create policy "family_invites_insert_guardian_admin"
on public.family_invites
for insert
to authenticated
with check (
  invited_by_user_id = auth.uid()
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_invites.family_id
      and fm.user_id = auth.uid()
      and fm.role = 'guardian_admin'
  )
);