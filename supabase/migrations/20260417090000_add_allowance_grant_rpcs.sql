alter table public.allowance_grants enable row level security;
alter table public.grant_decisions enable row level security;

drop policy if exists "allowance_grants_select_family_members"
  on public.allowance_grants;
create policy "allowance_grants_select_family_members"
on public.allowance_grants
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = allowance_grants.family_id
      and fm.user_id = auth.uid()
  )
);

drop policy if exists "allowance_grants_insert_guardians"
  on public.allowance_grants;
create policy "allowance_grants_insert_guardians"
on public.allowance_grants
for insert
to authenticated
with check (
  granted_by_user_id = auth.uid()
  and exists (
    select 1
    from public.family_members guardian_fm
    where guardian_fm.family_id = allowance_grants.family_id
      and guardian_fm.user_id = auth.uid()
      and guardian_fm.role in ('guardian_admin', 'guardian')
  )
  and exists (
    select 1
    from public.family_members child_fm
    where child_fm.family_id = allowance_grants.family_id
      and child_fm.user_id = allowance_grants.child_user_id
      and child_fm.role = 'child'
  )
);

drop policy if exists "grant_decisions_select_family_members"
  on public.grant_decisions;
create policy "grant_decisions_select_family_members"
on public.grant_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.allowance_grants ag
    join public.family_members fm
      on fm.family_id = ag.family_id
    where ag.id = grant_decisions.allowance_grant_id
      and fm.user_id = auth.uid()
  )
);

create or replace function public.create_allowance_grant(
  target_child_user_id uuid,
  grant_amount_jpy integer,
  grant_note text default null,
  grant_granted_at timestamptz default now()
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
  current_family_id uuid;
  current_role text;
  new_grant_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if grant_amount_jpy is null or grant_amount_jpy <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select fm.family_id, fm.role
    into current_family_id, current_role
  from public.family_members fm
  where fm.user_id = current_user_id
  limit 1;

  if current_family_id is null then
    raise exception 'Family membership not found';
  end if;

  if current_role not in ('guardian_admin', 'guardian') then
    raise exception 'Only guardians can create allowance grants';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = current_family_id
      and fm.user_id = target_child_user_id
      and fm.role = 'child'
  ) then
    raise exception 'Target child is not in your family';
  end if;

  insert into public.allowance_grants (
    family_id,
    child_user_id,
    granted_by_user_id,
    amount_jpy,
    note,
    granted_at
  )
  values (
    current_family_id,
    target_child_user_id,
    current_user_id,
    grant_amount_jpy,
    nullif(trim(coalesce(grant_note, '')), ''),
    coalesce(grant_granted_at, now())
  )
  returning allowance_grants.id into new_grant_id;

  insert into public.grant_decisions (
    allowance_grant_id,
    decision_status
  )
  values (
    new_grant_id,
    'pending'::public.grant_decision_status
  )
  on conflict (allowance_grant_id) do nothing;

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
    gd.decided_at,
    ag.created_at
  from public.allowance_grants ag
  left join public.grant_decisions gd
    on gd.allowance_grant_id = ag.id
  left join public.profiles child_profile
    on child_profile.id = ag.child_user_id
  left join public.profiles guardian_profile
    on guardian_profile.id = ag.granted_by_user_id
  where ag.id = new_grant_id;
end;
$$;

create or replace function public.list_allowance_grants_for_current_user()
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
    gd.decided_at,
    ag.created_at
  from public.allowance_grants ag
  left join public.grant_decisions gd
    on gd.allowance_grant_id = ag.id
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

revoke all on function public.create_allowance_grant(uuid, integer, text, timestamptz)
  from public;
grant execute on function public.create_allowance_grant(uuid, integer, text, timestamptz)
  to authenticated;

revoke all on function public.list_allowance_grants_for_current_user()
  from public;
grant execute on function public.list_allowance_grants_for_current_user()
  to authenticated;

comment on function public.create_allowance_grant(uuid, integer, text, timestamptz) is
  'Creates an allowance grant for a child in the current user family. Source of truth for membership remains family_members.';

comment on function public.list_allowance_grants_for_current_user() is
  'Lists allowance grants visible to the current user. Guardians see family grants; children see only their own grants.';
