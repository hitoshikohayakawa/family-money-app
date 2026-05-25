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
    and fm.role in ('guardian_admin', 'guardian')
  order by case fm.role when 'guardian_admin' then 1 else 2 end
  limit 1;

  if current_family_id is null then
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

revoke all on function public.create_allowance_grant(uuid, integer, text, timestamptz)
  from public;
grant execute on function public.create_allowance_grant(uuid, integer, text, timestamptz)
  to authenticated;

comment on function public.create_allowance_grant(uuid, integer, text, timestamptz) is
  'Creates an allowance grant for a child in the current user family. Source of truth for membership remains family_members.';
