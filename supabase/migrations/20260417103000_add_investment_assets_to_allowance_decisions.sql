create table if not exists public.investment_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  asset_name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.investment_assets (
  asset_code,
  asset_name,
  description,
  is_active
)
values (
  'emaxis_slim_all_country',
  'eMAXIS Slim 全世界株式（オール・カントリー）',
  '子どもが最初に投資を学ぶための標準投資先です。価格同期は後続フェーズで追加します。',
  true
)
on conflict (asset_code) do update
set asset_name = excluded.asset_name,
    description = excluded.description,
    is_active = excluded.is_active;

alter table public.grant_decisions
  add constraint grant_decisions_asset_id_fkey
  foreign key (asset_id)
  references public.investment_assets (id)
  on delete restrict
  not valid;

alter table public.grant_decisions
  validate constraint grant_decisions_asset_id_fkey;

create index if not exists grant_decisions_asset_id_idx
  on public.grant_decisions (asset_id);

alter table public.investment_assets enable row level security;

drop policy if exists "investment_assets_select_authenticated"
  on public.investment_assets;
create policy "investment_assets_select_authenticated"
on public.investment_assets
for select
to authenticated
using (is_active = true);

grant select on public.investment_assets
  to authenticated;

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

comment on table public.investment_assets is
  'Master table for investment choices. Prices are intentionally handled in a later phase.';

comment on function public.list_allowance_grants_for_current_user() is
  'Lists allowance grants visible to the current user, including selected investment asset details when available.';

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

  insert into public.grant_decisions (
    allowance_grant_id,
    decision_status,
    asset_id,
    decided_at
  )
  values (
    target_grant.id,
    'invested'::public.grant_decision_status,
    default_asset_id,
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

comment on function public.request_investment_for_allowance(uuid) is
  'Lets a child choose the default investment asset for their own pending allowance grant. Price details will be added in a later phase.';
