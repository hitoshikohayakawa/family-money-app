create or replace function public.list_family_members_for_current_user()
returns table (
  family_id uuid,
  user_id uuid,
  role text,
  email text,
  display_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_family_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fms.family_id
    into current_family_id
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status = 'active'
  limit 1;

  if current_family_id is null then
    return;
  end if;

  return query
  select
    fms.family_id,
    fms.user_id,
    fms.role::text,
    p.email,
    p.display_name,
    coalesce(nullif(p.display_name, ''), p.email, fms.user_id::text) as display_label
  from public.family_memberships fms
  left join public.profiles p
    on p.id = fms.user_id
  where fms.family_id = current_family_id
    and fms.status = 'active'
  order by
    case fms.role::text
      when 'guardian_admin' then 1
      when 'guardian' then 2
      when 'child' then 3
      else 4
    end,
    coalesce(nullif(p.display_name, ''), p.email, fms.user_id::text);
end;
$$;

revoke all on function public.list_family_members_for_current_user() from public;
grant execute on function public.list_family_members_for_current_user() to authenticated;