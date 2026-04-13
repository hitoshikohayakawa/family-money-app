create or replace function public.accept_family_invite(invite_id uuid)
returns table (
  family_id uuid,
  role text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  invite_record public.family_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email
    into current_user_email
  from public.profiles
  where id = current_user_id;

  if current_user_email is null then
    raise exception 'Profile email not found';
  end if;

  select *
    into invite_record
  from public.family_invites
  where id = invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  if invite_record.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if invite_record.expires_at <= now() then
    update public.family_invites
    set status = 'expired'
    where id = invite_record.id;

    raise exception 'Invite has expired';
  end if;

  if lower(invite_record.email) <> lower(current_user_email) then
    raise exception 'Invite email does not match current user';
  end if;

  if exists (
    select 1
    from public.family_members
    where user_id = current_user_id
  ) then
    raise exception 'User already belongs to a family';
  end if;

  insert into public.family_members (
    family_id,
    user_id,
    role
  )
  values (
    invite_record.family_id,
    current_user_id,
    invite_record.role
  );

  update public.family_invites
  set status = 'accepted',
      accepted_at = now()
  where id = invite_record.id;

  return query
  select invite_record.family_id, invite_record.role, 'accepted'::text;
end;
$$;

revoke all on function public.accept_family_invite(uuid) from public;
grant execute on function public.accept_family_invite(uuid) to authenticated;