create table if not exists public.grant_decisions (
  id uuid primary key default gen_random_uuid(),
  allowance_grant_id uuid not null unique
    references public.allowance_grants (id) on delete cascade,
  decision_status public.grant_decision_status not null default 'pending',
  asset_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists grant_decisions_status_idx
  on public.grant_decisions (decision_status);

create index if not exists grant_decisions_decided_at_idx
  on public.grant_decisions (decided_at);