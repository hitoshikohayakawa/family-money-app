-- PR2 backfill migration
-- Source of truth remains public.family_members in this phase.
-- This migration only copies existing rows into public.family_memberships.
-- It is designed to be re-runnable and non-destructive.

with source_rows as (
  select
    fm.family_id,
    fm.user_id,
    fm.role::public.family_member_role as role,
    'active'::public.family_membership_status as status,
    matched_invite.invited_by_user_id,
    coalesce(fm.joined_at, now()) as created_at,
    now() as updated_at
  from public.family_members fm
  left join public.profiles p
    on p.id = fm.user_id
  left join lateral (
    select fi.invited_by_user_id
    from public.family_invites fi
    where fi.family_id = fm.family_id
      and fi.status = 'accepted'
      and lower(fi.email) = lower(p.email)
      and (
        (fm.role = 'child' and fi.role = 'child')
        or (fm.role = 'guardian' and fi.role = 'guardian')
      )
    order by fi.accepted_at desc nulls last, fi.created_at desc, fi.id desc
    limit 1
  ) as matched_invite on true
)
insert into public.family_memberships (
  family_id,
  user_id,
  role,
  status,
  invited_by_user_id,
  created_at,
  updated_at
)
select
  source_rows.family_id,
  source_rows.user_id,
  source_rows.role,
  source_rows.status,
  source_rows.invited_by_user_id,
  source_rows.created_at,
  source_rows.updated_at
from source_rows
on conflict (family_id, user_id)
do update
set role = excluded.role,
    invited_by_user_id = coalesce(public.family_memberships.invited_by_user_id, excluded.invited_by_user_id),
    updated_at = now();

-- TODO:
-- guardian_admin rows intentionally keep invited_by_user_id as NULL in PR2.
-- If owner provenance becomes important later, decide whether families.created_by_user_id
-- should be copied in a later migration or application-layer repair step.