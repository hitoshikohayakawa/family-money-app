create or replace function public.get_family_invite_details(target_invite_id uuid)
returns table (
  invite_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  is_expired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.family_invites%rowtype;
begin
  select *
    into invite_record
  from public.family_invites
  where id = target_invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  return query
  select
    invite_record.id,
    invite_record.email,
    invite_record.role,
    invite_record.status,
    invite_record.expires_at,
    (invite_record.status = 'expired' or invite_record.expires_at <= now()) as is_expired;
end;
$$;

revoke all on function public.get_family_invite_details(uuid) from public;
grant execute on function public.get_family_invite_details(uuid) to anon, authenticated;