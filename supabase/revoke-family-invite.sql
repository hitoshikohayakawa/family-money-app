create or replace function public.revoke_family_invite(target_invite_id uuid)
returns table (
  invite_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_record public.family_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into invite_record
  from public.family_invites
  where id = target_invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  if invite_record.status <> 'pending' then
    raise exception 'Only pending invites can be revoked';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = invite_record.family_id
      and fm.user_id = current_user_id
      and fm.role = 'guardian_admin'
  ) then
    raise exception 'Only guardian_admin can revoke invites';
  end if;

  update public.family_invites
  set status = 'revoked'
  where id = invite_record.id;

  return query
  select invite_record.id, 'revoked'::text;
end;
$$;

revoke all on function public.revoke_family_invite(uuid) from public;
grant execute on function public.revoke_family_invite(uuid) to authenticated;