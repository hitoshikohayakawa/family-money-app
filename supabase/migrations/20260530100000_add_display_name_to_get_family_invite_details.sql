-- get_family_invite_details に display_name を追加する。
-- profiles テーブルから招待先メールアドレスに紐づく表示名を返す。
-- SECURITY DEFINER のため RLS をバイパスして profiles を読み取れる。
-- 戻り型変更のため DROP してから CREATE する。

drop function if exists public.get_family_invite_details(uuid);

create function public.get_family_invite_details(target_invite_id uuid)
returns table (
  invite_id uuid,
  email text,
  role text,
  stored_status text,
  effective_status text,
  expires_at timestamptz,
  membership_exists boolean,
  is_expired boolean,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.family_invites%rowtype;
  invite_membership_exists boolean;
  normalized_status text;
  invited_display_name text;
begin
  select *
    into invite_record
  from public.family_invites
  where id = target_invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  select exists (
    select 1
    from public.profiles p
    join public.family_memberships fms
      on fms.user_id = p.id
    where lower(p.email) = lower(invite_record.email)
      and fms.family_id = invite_record.family_id
      and fms.status = 'active'::public.family_membership_status
  )
    into invite_membership_exists;

  select p.display_name
    into invited_display_name
  from public.profiles p
  where lower(p.email) = lower(invite_record.email)
  limit 1;

  normalized_status := public.resolve_family_invite_status(
    invite_membership_exists,
    invite_record.status,
    invite_record.accepted_at,
    invite_record.expires_at
  );

  return query
  select
    invite_record.id,
    invite_record.email,
    invite_record.role,
    invite_record.status,
    normalized_status,
    invite_record.expires_at,
    invite_membership_exists,
    (normalized_status = 'expired') as is_expired,
    invited_display_name;
end;
$$;

revoke all on function public.get_family_invite_details(uuid) from public;
grant execute on function public.get_family_invite_details(uuid) to anon, authenticated;
