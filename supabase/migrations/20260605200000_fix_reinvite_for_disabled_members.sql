-- 一度削除（論理削除: status='disabled'）したメンバーを再招待できるよう修正。
--
-- 問題:
--   accept_family_invite が family_members テーブルをチェックしていたため、
--   disabled のメンバーも「すでに家族に所属している」と誤判定していた。
--
-- 修正:
--   1. 所属チェックを family_memberships + status='active' に変更
--   2. INSERT を ON CONFLICT DO UPDATE に変更（再参加時の PK 競合を回避）
--      → sync_family_members_to_family_memberships トリガーが発火し、
--        family_memberships.status が 'active' に自動更新される

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
  accepted_at_value timestamptz := now();
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

  -- アクティブなメンバーシップのみを確認（disabled は再参加を許可）
  if exists (
    select 1
    from public.family_memberships
    where user_id = current_user_id
      and status = 'active'
  ) then
    raise exception 'User already belongs to a family';
  end if;

  -- family_members は source of truth。再参加時は ON CONFLICT DO UPDATE で対応。
  -- sync トリガーが発火して family_memberships.status が 'active' に更新される。
  insert into public.family_members (
    family_id,
    user_id,
    role
  )
  values (
    invite_record.family_id,
    current_user_id,
    invite_record.role
  )
  on conflict (family_id, user_id)
  do update set role = excluded.role;

  update public.family_invites
  set status = 'accepted',
      accepted_at = accepted_at_value
  where id = invite_record.id;

  return query
  select invite_record.family_id, invite_record.role, 'accepted'::text;
end;
$$;

revoke all on function public.accept_family_invite(uuid) from public;
grant execute on function public.accept_family_invite(uuid) to authenticated;
