-- 一度削除（論理削除: status='disabled'）したメンバーを再招待できるよう修正。
--
-- 問題:
--   accept_family_invite が family_members テーブルをチェックしていたため、
--   disabled のメンバーも「すでに家族に所属している」と誤判定していた。
--   また returns table の列名（family_id / role / status）がローカル変数と
--   競合し "column reference is ambiguous" エラーが発生していた。
--
-- 修正:
--   1. ローカル変数を v_ プレフィックスに統一し列名との競合を回避
--   2. 所属チェックを family_memberships + status='active' に変更
--      （テーブルエイリアス fm で status の曖昧さを解消）
--   3. INSERT を ON CONFLICT ON CONSTRAINT で記述（列名指定を避け family_id 曖昧さを回避）
--      → sync_family_members_to_family_memberships トリガーが発火し
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
  v_user_id     uuid        := auth.uid();
  v_user_email  text;
  v_invite      public.family_invites%rowtype;
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.email into v_user_email
  from public.profiles p
  where p.id = v_user_id;

  if v_user_email is null then
    raise exception 'Profile email not found';
  end if;

  select fi.* into v_invite
  from public.family_invites fi
  where fi.id = invite_id;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if v_invite.expires_at <= now() then
    update public.family_invites
    set    status = 'expired'
    where  id     = v_invite.id;
    raise exception 'Invite has expired';
  end if;

  if lower(v_invite.email) <> lower(v_user_email) then
    raise exception 'Invite email does not match current user';
  end if;

  -- アクティブなメンバーシップのみを確認（disabled は再参加を許可）
  -- テーブルエイリアス fm で status の曖昧さを解消
  if exists (
    select 1
    from   public.family_memberships fm
    where  fm.user_id = v_user_id
      and  fm.status  = 'active'
  ) then
    raise exception 'User already belongs to a family';
  end if;

  -- ON CONFLICT を制約名で指定（列名による family_id の曖昧さを回避）
  insert into public.family_members (family_id, user_id, role)
  values (v_invite.family_id, v_user_id, v_invite.role)
  on conflict on constraint family_members_pkey
  do update set role = excluded.role;

  update public.family_invites
  set    status      = 'accepted',
         accepted_at = v_accepted_at
  where  id = v_invite.id;

  return query
  select v_invite.family_id, v_invite.role::text, 'accepted'::text;
end;
$$;

revoke all on function public.accept_family_invite(uuid) from public;
grant execute on function public.accept_family_invite(uuid) to authenticated;
