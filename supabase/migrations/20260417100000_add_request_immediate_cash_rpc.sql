create or replace function public.request_immediate_cash_for_allowance(
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
    raise exception 'Only the invited child can request immediate cash for this allowance';
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

  insert into public.grant_decisions (
    allowance_grant_id,
    decision_status,
    decided_at
  )
  values (
    target_grant.id,
    'immediate_cash_requested'::public.grant_decision_status,
    now()
  )
  on conflict (allowance_grant_id) do update
  set decision_status = case
        when public.grant_decisions.decision_status = 'pending'::public.grant_decision_status
          then 'immediate_cash_requested'::public.grant_decision_status
        else public.grant_decisions.decision_status
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
      and gd.decision_status <> 'immediate_cash_requested'::public.grant_decision_status
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

revoke all on function public.request_immediate_cash_for_allowance(uuid)
  from public;
grant execute on function public.request_immediate_cash_for_allowance(uuid)
  to authenticated;

comment on function public.request_immediate_cash_for_allowance(uuid) is
  'Lets a child choose immediate cash for their own pending allowance grant. Cashout request table will be added in a later phase.';
