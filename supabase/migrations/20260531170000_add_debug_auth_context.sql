-- Temporary diagnostic function to verify auth.uid() in RPC context.
-- This helps determine if the issue is in auth context or RLS.
-- Remove this function after debugging is complete.

create or replace function public.debug_auth_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
  frole text;
  grant_count bigint;
begin
  select fms.family_id, fms.role::text
    into fid, frole
  from public.family_memberships fms
  where fms.user_id = uid
    and fms.status = 'active'
  limit 1;

  select count(*)
    into grant_count
  from public.allowance_grants ag
  where fid is not null and ag.family_id = fid;

  return jsonb_build_object(
    'auth_uid', uid,
    'family_id', fid,
    'role', frole,
    'uid_is_null', uid is null,
    'family_found', fid is not null,
    'grant_count_in_family', grant_count
  );
end;
$$;

revoke all on function public.debug_auth_context() from public;
grant execute on function public.debug_auth_context() to authenticated;
