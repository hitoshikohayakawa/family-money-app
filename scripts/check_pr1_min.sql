select 'families' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'families'
) as ok
union all
select 'profiles' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'profiles'
)
union all
select 'family_members' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'family_members'
)
union all
select 'family_invites' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'family_invites'
)
union all
select 'family_memberships' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'family_memberships'
)
union all
select 'pending_admin_signups' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'pending_admin_signups'
)
union all
select 'allowance_grants' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'allowance_grants'
)
union all
select 'grant_decisions' as table_name, exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'grant_decisions'
);