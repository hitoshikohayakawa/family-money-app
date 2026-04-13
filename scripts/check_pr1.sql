select 'family_member_role' as item, exists (
  select 1
  from pg_type
  where typnamespace = 'public'::regnamespace
    and typname = 'family_member_role'
) as ok
union all
select 'family_membership_status' as item, exists (
  select 1
  from pg_type
  where typnamespace = 'public'::regnamespace
    and typname = 'family_membership_status'
)
union all
select 'grant_decision_status' as item, exists (
  select 1
  from pg_type
  where typnamespace = 'public'::regnamespace
    and typname = 'grant_decision_status'
)
union all
select 'family_memberships_table' as item, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'family_memberships'
)
union all
select 'pending_admin_signups_table' as item, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'pending_admin_signups'
)
union all
select 'allowance_grants_table' as item, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'allowance_grants'
)
union all
select 'grant_decisions_table' as item, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'grant_decisions'
);

select
  'families_exists' as item,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'families'
  ) as ok
union all
select
  'profiles_exists' as item,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  )
union all
select
  'family_members_exists' as item,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'family_members'
  )
union all
select
  'family_invites_exists' as item,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'family_invites'
  );