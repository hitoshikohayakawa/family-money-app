create table if not exists public.investment_asset_prices (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null
    references public.investment_assets (id) on delete cascade,
  price_date date not null,
  unit_price_jpy integer not null check (unit_price_jpy > 0),
  source text,
  created_at timestamptz not null default now(),
  constraint investment_asset_prices_asset_date_unique unique (asset_id, price_date)
);

create index if not exists investment_asset_prices_asset_date_idx
  on public.investment_asset_prices (asset_id, price_date desc);

alter table public.investment_asset_prices enable row level security;

drop policy if exists "investment_asset_prices_select_authenticated"
  on public.investment_asset_prices;
create policy "investment_asset_prices_select_authenticated"
on public.investment_asset_prices
for select
to authenticated
using (true);

grant select on public.investment_asset_prices
  to authenticated;

insert into public.investment_asset_prices (
  asset_id,
  price_date,
  unit_price_jpy,
  source
)
select
  ia.id,
  '2026-04-14'::date,
  34796,
  'initial_seed_manual'
from public.investment_assets ia
where ia.asset_code = 'emaxis_slim_all_country'
on conflict (asset_id, price_date) do update
set unit_price_jpy = excluded.unit_price_jpy,
    source = excluded.source;

alter table public.grant_decisions
  add column if not exists investment_price_date date,
  add column if not exists investment_unit_price_jpy integer,
  add column if not exists investment_units numeric(20, 8);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'grant_decisions_investment_unit_price_positive'
      and conrelid = 'public.grant_decisions'::regclass
  ) then
    alter table public.grant_decisions
      add constraint grant_decisions_investment_unit_price_positive
      check (investment_unit_price_jpy is null or investment_unit_price_jpy > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'grant_decisions_investment_units_positive'
      and conrelid = 'public.grant_decisions'::regclass
  ) then
    alter table public.grant_decisions
      add constraint grant_decisions_investment_units_positive
      check (investment_units is null or investment_units > 0);
  end if;
end
$$;

drop function if exists public.list_allowance_grants_for_current_user();

create function public.list_allowance_grants_for_current_user()
returns table (
  id uuid,
  family_id uuid,
  child_user_id uuid,
  child_email text,
  child_display_label text,
  granted_by_user_id uuid,
  granted_by_email text,
  granted_by_display_label text,
  amount_jpy integer,
  note text,
  granted_at timestamptz,
  decision_status text,
  decision_asset_id uuid,
  decision_asset_code text,
  decision_asset_name text,
  investment_price_date date,
  investment_unit_price_jpy integer,
  investment_units numeric,
  decided_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_family_id uuid;
  current_role text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fm.family_id, fm.role
    into current_family_id, current_role
  from public.family_members fm
  where fm.user_id = current_user_id
  limit 1;

  if current_family_id is null then
    return;
  end if;

  return query
  select
    ag.id,
    ag.family_id,
    ag.child_user_id,
    child_profile.email as child_email,
    coalesce(
      nullif(child_profile.display_name, ''),
      child_profile.email,
      ag.child_user_id::text
    ) as child_display_label,
    ag.granted_by_user_id,
    guardian_profile.email as granted_by_email,
    coalesce(
      nullif(guardian_profile.display_name, ''),
      guardian_profile.email,
      ag.granted_by_user_id::text
    ) as granted_by_display_label,
    ag.amount_jpy,
    ag.note,
    ag.granted_at,
    coalesce(gd.decision_status, 'pending'::public.grant_decision_status)::text as decision_status,
    gd.asset_id as decision_asset_id,
    ia.asset_code as decision_asset_code,
    ia.asset_name as decision_asset_name,
    gd.investment_price_date,
    gd.investment_unit_price_jpy,
    gd.investment_units,
    gd.decided_at,
    ag.created_at
  from public.allowance_grants ag
  left join public.grant_decisions gd
    on gd.allowance_grant_id = ag.id
  left join public.investment_assets ia
    on ia.id = gd.asset_id
  left join public.profiles child_profile
    on child_profile.id = ag.child_user_id
  left join public.profiles guardian_profile
    on guardian_profile.id = ag.granted_by_user_id
  where ag.family_id = current_family_id
    and (
      current_role in ('guardian_admin', 'guardian')
      or ag.child_user_id = current_user_id
    )
  order by ag.granted_at desc, ag.created_at desc;
end;
$$;

revoke all on function public.list_allowance_grants_for_current_user()
  from public;
grant execute on function public.list_allowance_grants_for_current_user()
  to authenticated;

create or replace function public.request_investment_for_allowance(
  target_allowance_grant_id uuid
)
returns table (
  id uuid,
  family_id uuid,
  child_user_id uuid,
  child_email text,
  child_display_label text,
  granted_by_user_id uuid,
  granted_by_email text,
  granted_by_display_label text,
  amount_jpy integer,
  note text,
  granted_at timestamptz,
  decision_status text,
  decided_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_grant public.allowance_grants%rowtype;
  default_asset_id uuid;
  selected_price public.investment_asset_prices%rowtype;
  calculated_units numeric(20, 8);
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ag.*
    into target_grant
  from public.allowance_grants ag
  where ag.id = target_allowance_grant_id;

  if target_grant.id is null then
    raise exception 'Allowance grant not found';
  end if;

  if target_grant.child_user_id <> current_user_id then
    raise exception 'Only the target child can invest this allowance';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_grant.family_id
      and fm.user_id = current_user_id
      and fm.role = 'child'
  ) then
    raise exception 'Child membership not found';
  end if;

  select ia.id
    into default_asset_id
  from public.investment_assets ia
  where ia.asset_code = 'emaxis_slim_all_country'
    and ia.is_active = true
  limit 1;

  if default_asset_id is null then
    raise exception 'Default investment asset not found';
  end if;

  select iap.*
    into selected_price
  from public.investment_asset_prices iap
  where iap.asset_id = default_asset_id
    and iap.price_date <= current_date
  order by iap.price_date desc
  limit 1;

  if selected_price.id is null then
    raise exception 'Investment asset price not found';
  end if;

  calculated_units := round(
    (target_grant.amount_jpy::numeric * 10000::numeric) /
      selected_price.unit_price_jpy::numeric,
    8
  );

  insert into public.grant_decisions (
    allowance_grant_id,
    decision_status,
    asset_id,
    investment_price_date,
    investment_unit_price_jpy,
    investment_units,
    decided_at
  )
  values (
    target_grant.id,
    'invested'::public.grant_decision_status,
    default_asset_id,
    selected_price.price_date,
    selected_price.unit_price_jpy,
    calculated_units,
    now()
  )
  on conflict (allowance_grant_id) do update
  set decision_status = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then 'invested'::public.grant_decision_status
        else public.grant_decisions.decision_status
      end,
      asset_id = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then default_asset_id
        else public.grant_decisions.asset_id
      end,
      investment_price_date = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then selected_price.price_date
        else public.grant_decisions.investment_price_date
      end,
      investment_unit_price_jpy = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then selected_price.unit_price_jpy
        else public.grant_decisions.investment_unit_price_jpy
      end,
      investment_units = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then calculated_units
        else public.grant_decisions.investment_units
      end,
      decided_at = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then now()
        else public.grant_decisions.decided_at
      end;

  if exists (
    select 1
    from public.grant_decisions gd
    where gd.allowance_grant_id = target_grant.id
      and gd.decision_status <> 'invested'::public.grant_decision_status
  ) then
    raise exception 'Allowance grant has already been decided';
  end if;

  return query
  select
    ag.id,
    ag.family_id,
    ag.child_user_id,
    child_profile.email as child_email,
    coalesce(
      nullif(child_profile.display_name, ''),
      child_profile.email,
      ag.child_user_id::text
    ) as child_display_label,
    ag.granted_by_user_id,
    guardian_profile.email as granted_by_email,
    coalesce(
      nullif(guardian_profile.display_name, ''),
      guardian_profile.email,
      ag.granted_by_user_id::text
    ) as granted_by_display_label,
    ag.amount_jpy,
    ag.note,
    ag.granted_at,
    gd.decision_status::text as decision_status,
    gd.decided_at,
    ag.created_at
  from public.allowance_grants ag
  join public.grant_decisions gd
    on gd.allowance_grant_id = ag.id
  left join public.profiles child_profile
    on child_profile.id = ag.child_user_id
  left join public.profiles guardian_profile
    on guardian_profile.id = ag.granted_by_user_id
  where ag.id = target_grant.id;
end;
$$;

revoke all on function public.request_investment_for_allowance(uuid)
  from public;
grant execute on function public.request_investment_for_allowance(uuid)
  to authenticated;

comment on table public.investment_asset_prices is
  'Daily price table for investment assets. Sync jobs can append current prices without blocking the app.';

comment on function public.list_allowance_grants_for_current_user() is
  'Lists allowance grants visible to the current user, including selected investment asset and fixed investment price details.';

comment on function public.request_investment_for_allowance(uuid) is
  'Lets a child choose the default investment asset and fixes units using the latest available daily price.';
