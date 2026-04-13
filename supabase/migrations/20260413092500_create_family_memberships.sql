create table if not exists public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.family_member_role not null,
  status public.family_membership_status not null default 'active',
  invited_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_memberships_family_user_unique unique (family_id, user_id)
);

create index if not exists family_memberships_family_id_idx
  on public.family_memberships (family_id);

create index if not exists family_memberships_user_id_idx
  on public.family_memberships (user_id);

create index if not exists family_memberships_family_role_idx
  on public.family_memberships (family_id, role);

create index if not exists family_memberships_family_status_idx
  on public.family_memberships (family_id, status);