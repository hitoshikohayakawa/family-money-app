-- PR3 one-way sync trigger
-- Source of truth remains public.family_members.
-- This migration only propagates INSERT / UPDATE changes into public.family_memberships.
-- It does not modify or delete rows in public.family_members.
-- It also does not handle DELETE sync in this phase.

create or replace function public.sync_family_members_to_family_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_memberships (
    family_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    created_at,
    updated_at
  )
  values (
    new.family_id,
    new.user_id,
    new.role::public.family_member_role,
    'active'::public.family_membership_status,
    null,
    coalesce(new.joined_at, now()),
    now()
  )
  on conflict (family_id, user_id)
  do update
  set role = excluded.role,
      status = 'active'::public.family_membership_status,
      invited_by_user_id = coalesce(
        public.family_memberships.invited_by_user_id,
        excluded.invited_by_user_id
      ),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_family_members_to_family_memberships
  on public.family_members;

create trigger trg_sync_family_members_to_family_memberships
after insert or update on public.family_members
for each row
execute function public.sync_family_members_to_family_memberships();

comment on function public.sync_family_members_to_family_memberships() is
  'One-way sync from family_members to family_memberships on insert/update. Keeps family_members as source of truth.';

-- TODO:
-- This trigger assumes family_members.family_id and family_members.user_id are effectively immutable.
-- If a future flow updates those key columns, a separate migration should decide how to reconcile
-- the old family_memberships row without making destructive assumptions in this phase.