-- update_family_name: guardian_admin can rename their own family
create or replace function public.update_family_name(new_family_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_role      text;
  v_normalized text := trim(coalesce(new_family_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized = '' then
    raise exception 'Family name cannot be empty';
  end if;

  select family_id, role::text
    into v_family_id, v_role
  from public.family_memberships
  where user_id = auth.uid()
    and status = 'active'::public.family_membership_status
  limit 1;

  if v_family_id is null then
    raise exception 'No active family membership found';
  end if;

  if v_role <> 'guardian_admin' then
    raise exception 'Only guardian_admin can rename the family';
  end if;

  update public.families
  set family_name = v_normalized
  where id = v_family_id;
end;
$$;

revoke all on function public.update_family_name(text) from public;
grant execute on function public.update_family_name(text) to authenticated;


-- withdraw_family: guardian_admin disables ALL active members of the family (logical delete)
create or replace function public.withdraw_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_role      text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select family_id, role::text
    into v_family_id, v_role
  from public.family_memberships
  where user_id = auth.uid()
    and status = 'active'::public.family_membership_status
  limit 1;

  if v_family_id is null then
    raise exception 'No active family membership found';
  end if;

  if v_role <> 'guardian_admin' then
    raise exception 'Only guardian_admin can withdraw the family';
  end if;

  -- Disable ALL active members of this family
  update public.family_memberships
  set status     = 'disabled'::public.family_membership_status,
      updated_at = now()
  where family_id = v_family_id
    and status    = 'active'::public.family_membership_status;
end;
$$;

revoke all on function public.withdraw_family() from public;
grant execute on function public.withdraw_family() to authenticated;
