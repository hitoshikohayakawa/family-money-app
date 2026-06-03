-- Returns true when the calling user has a 'disabled' family_membership
-- and no 'active' or 'invited' one.
-- Used by the login page to block logically-deleted users before they can
-- create a new family (which would re-register them as guardian_admin).
-- SECURITY DEFINER so it bypasses RLS and sees all statuses.

create or replace function public.is_own_membership_disabled()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_active   boolean;
  v_has_disabled boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select
    exists(
      select 1 from public.family_memberships
      where user_id = auth.uid()
        and status in ('active'::public.family_membership_status,
                       'invited'::public.family_membership_status)
    ),
    exists(
      select 1 from public.family_memberships
      where user_id = auth.uid()
        and status = 'disabled'::public.family_membership_status
    )
  into v_has_active, v_has_disabled;

  -- Only blocked if they have a disabled record but NO active/invited one
  return v_has_disabled and not v_has_active;
end;
$$;

revoke all on function public.is_own_membership_disabled() from public;
grant execute on function public.is_own_membership_disabled() to authenticated;
