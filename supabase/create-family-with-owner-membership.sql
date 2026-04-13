create or replace function public.create_family_with_owner_membership(
  input_family_name text
)
returns table (
  family_id uuid,
  family_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_family_name text := trim(coalesce(input_family_name, ''));
  created_family public.families%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_family_name = '' then
    raise exception 'Family name is required';
  end if;

  if exists (
    select 1
    from public.family_members
    where user_id = current_user_id
  ) then
    raise exception 'User already belongs to a family';
  end if;

  insert into public.families (
    family_name,
    created_by_user_id
  )
  values (
    normalized_family_name,
    current_user_id
  )
  returning * into created_family;

  insert into public.family_members (
    family_id,
    user_id,
    role
  )
  values (
    created_family.id,
    current_user_id,
    'guardian_admin'
  );

  return query
  select created_family.id, created_family.family_name, 'guardian_admin'::text;
end;
$$;

revoke all on function public.create_family_with_owner_membership(text) from public;
grant execute on function public.create_family_with_owner_membership(text) to authenticated;