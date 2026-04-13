create table if not exists public.allowance_grants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_user_id uuid not null references auth.users (id) on delete restrict,
  granted_by_user_id uuid not null references auth.users (id) on delete restrict,
  amount_jpy integer not null,
  note text,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint allowance_grants_amount_positive_check
    check (amount_jpy > 0)
);

create index if not exists allowance_grants_family_child_idx
  on public.allowance_grants (family_id, child_user_id);

create index if not exists allowance_grants_granted_by_idx
  on public.allowance_grants (granted_by_user_id);

create index if not exists allowance_grants_granted_at_idx
  on public.allowance_grants (granted_at desc);