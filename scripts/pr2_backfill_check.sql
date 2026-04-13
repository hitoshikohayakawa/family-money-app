-- Counts in each table.
select 'family_members_count' as check_name, count(*)::bigint as value
from public.family_members
union all
select 'family_memberships_count' as check_name, count(*)::bigint as value
from public.family_memberships;

-- Role counts in each table.
select
  'family_members_role_count' as check_name,
  fm.role as key,
  count(*)::bigint as value
from public.family_members fm
group by fm.role
order by fm.role;

select
  'family_memberships_role_count' as check_name,
  fms.role::text as key,
  count(*)::bigint as value
from public.family_memberships fms
group by fms.role
order by fms.role;

-- Rows missing in family_memberships.
select
  fm.family_id,
  fm.user_id,
  fm.role,
  'missing_in_family_memberships' as issue
from public.family_members fm
left join public.family_memberships fms
  on fms.family_id = fm.family_id
 and fms.user_id = fm.user_id
where fms.user_id is null
order by fm.family_id, fm.user_id;

-- Rows existing only in family_memberships.
select
  fms.family_id,
  fms.user_id,
  fms.role::text as role,
  'extra_in_family_memberships' as issue
from public.family_memberships fms
left join public.family_members fm
  on fm.family_id = fms.family_id
 and fm.user_id = fms.user_id
where fm.user_id is null
order by fms.family_id, fms.user_id;

-- Role mismatches.
select
  fm.family_id,
  fm.user_id,
  fm.role as family_members_role,
  fms.role::text as family_memberships_role,
  'role_mismatch' as issue
from public.family_members fm
join public.family_memberships fms
  on fms.family_id = fm.family_id
 and fms.user_id = fm.user_id
where fm.role <> fms.role::text
order by fm.family_id, fm.user_id;

-- invited_by_user_id fill summary.
select
  count(*) filter (where invited_by_user_id is not null)::bigint as invited_by_filled_count,
  count(*) filter (where invited_by_user_id is null)::bigint as invited_by_null_count,
  count(*)::bigint as total_count
from public.family_memberships;

-- Null status / created_at sanity counts.
select
  count(*) filter (where status is null)::bigint as null_status_count,
  count(*) filter (where created_at is null)::bigint as null_created_at_count,
  count(*) filter (where updated_at is null)::bigint as null_updated_at_count
from public.family_memberships;

-- Rows that stayed null for invited_by_user_id, for manual inspection.
select
  fms.family_id,
  fms.user_id,
  fms.role::text as role,
  p.email,
  fms.invited_by_user_id
from public.family_memberships fms
left join public.profiles p
  on p.id = fms.user_id
where fms.invited_by_user_id is null
order by fms.family_id, fms.role, p.email nulls last, fms.user_id;