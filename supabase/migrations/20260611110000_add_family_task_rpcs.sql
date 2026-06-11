-- 「やること（family_tasks）」用 RPC 群
--
-- 方針:
--   - 書き込みは全て security definer + family_id / ロール検証で保護する。
--   - PL/pgSQL の変数名に予約語 current_role を使わない（member_role を使用）。
--   - 報酬(reward_amount_jpy>0)があるタスクは必ず requires_confirmation=true とし、
--     お小遣い(allowance_grants)の作成は親の承認(approve_family_task)時のみ行う。
--     これにより最重要領域への書き込みは常に保護者起点に限定される。

-- ─── 作成（保護者のみ）─────────────────────────────────────────────────────────
create or replace function public.create_family_task(
  target_child_user_id       uuid,
  task_title                 text,
  task_description           text        default null,
  task_reward_amount_jpy     integer     default null,
  task_due_at                timestamptz default null,
  task_remind_at             timestamptz default null,
  task_requires_confirmation boolean     default true,
  task_recurrence            text        default 'none'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id   uuid := auth.uid();
  current_family_id uuid;
  member_role       text;
  requires_confirm  boolean := coalesce(task_requires_confirmation, true);
  new_task_id       uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if task_title is null or length(btrim(task_title)) = 0 then
    raise exception 'Title is required';
  end if;

  if task_reward_amount_jpy is not null and task_reward_amount_jpy < 0 then
    raise exception 'Reward must be non-negative';
  end if;

  select fms.family_id, fms.role::text
    into current_family_id, member_role
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status  = 'active'
  limit 1;

  if current_family_id is null then
    raise exception 'Family membership not found';
  end if;

  if member_role not in ('guardian_admin', 'guardian') then
    raise exception 'Only guardians can create tasks';
  end if;

  if not exists (
    select 1
    from public.family_memberships child_fms
    where child_fms.family_id = current_family_id
      and child_fms.user_id   = target_child_user_id
      and child_fms.role      = 'child'
      and child_fms.status    = 'active'
  ) then
    raise exception 'Target child is not in your family';
  end if;

  -- 報酬がある場合は、付与を承認時に限定するため確認必須にする。
  if task_reward_amount_jpy is not null and task_reward_amount_jpy > 0 then
    requires_confirm := true;
  end if;

  insert into public.family_tasks (
    family_id,
    child_user_id,
    created_by_user_id,
    title,
    description,
    reward_amount_jpy,
    due_at,
    remind_at,
    requires_confirmation,
    recurrence
  )
  values (
    current_family_id,
    target_child_user_id,
    current_user_id,
    btrim(task_title),
    nullif(btrim(coalesce(task_description, '')), ''),
    task_reward_amount_jpy,
    task_due_at,
    task_remind_at,
    requires_confirm,
    coalesce(task_recurrence, 'none')::public.family_task_recurrence
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

-- ─── 編集（保護者のみ・open/submitted のみ）─────────────────────────────────────
create or replace function public.update_family_task(
  target_task_id             uuid,
  task_title                 text,
  task_description           text        default null,
  task_reward_amount_jpy     integer     default null,
  task_due_at                timestamptz default null,
  task_remind_at             timestamptz default null,
  task_requires_confirmation boolean     default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id   uuid := auth.uid();
  current_family_id uuid;
  member_role       text;
  task_family_id    uuid;
  task_status       public.family_task_status;
  requires_confirm  boolean := coalesce(task_requires_confirmation, true);
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if task_title is null or length(btrim(task_title)) = 0 then
    raise exception 'Title is required';
  end if;

  if task_reward_amount_jpy is not null and task_reward_amount_jpy < 0 then
    raise exception 'Reward must be non-negative';
  end if;

  select fms.family_id, fms.role::text
    into current_family_id, member_role
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status  = 'active'
  limit 1;

  if current_family_id is null then
    raise exception 'Family membership not found';
  end if;

  if member_role not in ('guardian_admin', 'guardian') then
    raise exception 'Only guardians can update tasks';
  end if;

  select ft.family_id, ft.status
    into task_family_id, task_status
  from public.family_tasks ft
  where ft.id = target_task_id;

  if task_family_id is null then
    raise exception 'Task not found';
  end if;

  if task_family_id <> current_family_id then
    raise exception 'Task is not in your family';
  end if;

  if task_status not in ('open', 'submitted') then
    raise exception 'Only open tasks can be edited';
  end if;

  if task_reward_amount_jpy is not null and task_reward_amount_jpy > 0 then
    requires_confirm := true;
  end if;

  update public.family_tasks
  set title                 = btrim(task_title),
      description           = nullif(btrim(coalesce(task_description, '')), ''),
      reward_amount_jpy     = task_reward_amount_jpy,
      due_at                = task_due_at,
      remind_at             = task_remind_at,
      requires_confirmation = requires_confirm
  where id = target_task_id;
end;
$$;

-- ─── 取り消し（保護者のみ・ソフト）─────────────────────────────────────────────
create or replace function public.cancel_family_task(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id   uuid := auth.uid();
  current_family_id uuid;
  member_role       text;
  task_family_id    uuid;
  task_status       public.family_task_status;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fms.family_id, fms.role::text
    into current_family_id, member_role
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status  = 'active'
  limit 1;

  if current_family_id is null then
    raise exception 'Family membership not found';
  end if;

  if member_role not in ('guardian_admin', 'guardian') then
    raise exception 'Only guardians can cancel tasks';
  end if;

  select ft.family_id, ft.status
    into task_family_id, task_status
  from public.family_tasks ft
  where ft.id = target_task_id;

  if task_family_id is null then
    raise exception 'Task not found';
  end if;

  if task_family_id <> current_family_id then
    raise exception 'Task is not in your family';
  end if;

  if task_status = 'done' then
    raise exception 'Completed tasks cannot be cancelled';
  end if;

  update public.family_tasks
  set status = 'cancelled'
  where id = target_task_id;
end;
$$;

-- ─── 子の完了報告（自分のタスクのみ）───────────────────────────────────────────
-- requires_confirmation=true → 'submitted'（承認待ち）
-- requires_confirmation=false → 'done'（報酬なしタスクのみ。報酬付きは作成時に確認必須化）
create or replace function public.submit_family_task_completion(target_task_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id   uuid := auth.uid();
  task_family_id    uuid;
  task_child_id     uuid;
  task_status       public.family_task_status;
  task_requires     boolean;
  new_status        public.family_task_status;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ft.family_id, ft.child_user_id, ft.status, ft.requires_confirmation
    into task_family_id, task_child_id, task_status, task_requires
  from public.family_tasks ft
  where ft.id = target_task_id
  for update;

  if task_family_id is null then
    raise exception 'Task not found';
  end if;

  if task_child_id <> current_user_id then
    raise exception 'This task does not belong to you';
  end if;

  if not exists (
    select 1
    from public.family_memberships fms
    where fms.user_id   = current_user_id
      and fms.family_id = task_family_id
      and fms.status    = 'active'
  ) then
    raise exception 'No access to this family';
  end if;

  if task_status <> 'open' then
    raise exception 'Task is not open';
  end if;

  if task_requires then
    new_status := 'submitted';
    update public.family_tasks
    set status = 'submitted', completed_at = now()
    where id = target_task_id;
  else
    new_status := 'done';
    update public.family_tasks
    set status = 'done', completed_at = now(), approved_at = now()
    where id = target_task_id;
  end if;

  return new_status::text;
end;
$$;

-- ─── 親の承認（保護者のみ）─────────────────────────────────────────────────────
-- 'submitted' → 'done'。報酬があれば allowance_grant + grant_decision(pending) を作成。
-- ★ 最重要領域(allowance_grants)への書き込み。create_allowance_grant と同じ構造で行う。
create or replace function public.approve_family_task(target_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id   uuid := auth.uid();
  current_family_id uuid;
  member_role       text;
  task_family_id    uuid;
  task_child_id     uuid;
  task_status       public.family_task_status;
  task_reward       integer;
  new_grant_id      uuid := null;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fms.family_id, fms.role::text
    into current_family_id, member_role
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status  = 'active'
  limit 1;

  if current_family_id is null then
    raise exception 'Family membership not found';
  end if;

  if member_role not in ('guardian_admin', 'guardian') then
    raise exception 'Only guardians can approve tasks';
  end if;

  select ft.family_id, ft.child_user_id, ft.status, ft.reward_amount_jpy
    into task_family_id, task_child_id, task_status, task_reward
  from public.family_tasks ft
  where ft.id = target_task_id
  for update;

  if task_family_id is null then
    raise exception 'Task not found';
  end if;

  if task_family_id <> current_family_id then
    raise exception 'Task is not in your family';
  end if;

  if task_status <> 'submitted' then
    raise exception 'Task is not awaiting approval';
  end if;

  -- 報酬がある場合のみお小遣いを付与する。
  if task_reward is not null and task_reward > 0 then
    -- 念のため対象が今もアクティブな子であることを確認する。
    if not exists (
      select 1
      from public.family_memberships child_fms
      where child_fms.family_id = current_family_id
        and child_fms.user_id   = task_child_id
        and child_fms.role      = 'child'
        and child_fms.status    = 'active'
    ) then
      raise exception 'Target child is not active in your family';
    end if;

    insert into public.allowance_grants (
      family_id,
      child_user_id,
      granted_by_user_id,
      amount_jpy,
      note,
      granted_at
    )
    values (
      task_family_id,
      task_child_id,
      current_user_id,
      task_reward,
      'やること達成報酬',
      now()
    )
    returning id into new_grant_id;

    insert into public.grant_decisions (
      allowance_grant_id,
      decision_status
    )
    values (
      new_grant_id,
      'pending'::public.grant_decision_status
    )
    on conflict (allowance_grant_id) do nothing;
  end if;

  update public.family_tasks
  set status              = 'done',
      approved_at         = now(),
      approved_by_user_id = current_user_id,
      reward_grant_id     = new_grant_id
  where id = target_task_id;

  return new_grant_id;
end;
$$;

-- ─── 一覧（保護者: 家族全件 / 子: 自分のみ）────────────────────────────────────
create or replace function public.list_family_tasks_for_current_user()
returns table (
  id                    uuid,
  family_id             uuid,
  child_user_id         uuid,
  child_display_label   text,
  created_by_user_id    uuid,
  title                 text,
  description           text,
  reward_amount_jpy     integer,
  due_at                timestamptz,
  remind_at             timestamptz,
  recurrence            text,
  requires_confirmation boolean,
  status                text,
  completed_at          timestamptz,
  approved_at           timestamptz,
  reward_grant_id       uuid,
  created_at            timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id   uuid := auth.uid();
  current_family_id uuid;
  member_role       text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fms.family_id, fms.role::text
    into current_family_id, member_role
  from public.family_memberships fms
  where fms.user_id = current_user_id
    and fms.status  = 'active'
  limit 1;

  if current_family_id is null then
    return;
  end if;

  return query
  select
    ft.id,
    ft.family_id,
    ft.child_user_id,
    coalesce(
      nullif(child_profile.display_name, ''),
      child_profile.email,
      ft.child_user_id::text
    ) as child_display_label,
    ft.created_by_user_id,
    ft.title,
    ft.description,
    ft.reward_amount_jpy,
    ft.due_at,
    ft.remind_at,
    ft.recurrence::text,
    ft.requires_confirmation,
    ft.status::text,
    ft.completed_at,
    ft.approved_at,
    ft.reward_grant_id,
    ft.created_at
  from public.family_tasks ft
  left join public.profiles child_profile
    on child_profile.id = ft.child_user_id
  where ft.family_id = current_family_id
    and ft.status <> 'cancelled'
    and (
      member_role in ('guardian_admin', 'guardian')
      or ft.child_user_id = current_user_id
    )
  order by
    case ft.status when 'submitted' then 0 when 'open' then 1 else 2 end,
    ft.due_at asc nulls last,
    ft.created_at desc;
end;
$$;

-- ─── 権限 ──────────────────────────────────────────────────────────────────────
revoke all on function public.create_family_task(uuid, text, text, integer, timestamptz, timestamptz, boolean, text) from public;
grant execute on function public.create_family_task(uuid, text, text, integer, timestamptz, timestamptz, boolean, text) to authenticated;

revoke all on function public.update_family_task(uuid, text, text, integer, timestamptz, timestamptz, boolean) from public;
grant execute on function public.update_family_task(uuid, text, text, integer, timestamptz, timestamptz, boolean) to authenticated;

revoke all on function public.cancel_family_task(uuid) from public;
grant execute on function public.cancel_family_task(uuid) to authenticated;

revoke all on function public.submit_family_task_completion(uuid) from public;
grant execute on function public.submit_family_task_completion(uuid) to authenticated;

revoke all on function public.approve_family_task(uuid) from public;
grant execute on function public.approve_family_task(uuid) to authenticated;

revoke all on function public.list_family_tasks_for_current_user() from public;
grant execute on function public.list_family_tasks_for_current_user() to authenticated;

comment on function public.create_family_task(uuid, text, text, integer, timestamptz, timestamptz, boolean, text) is
  'Guardian creates a task for a child in their family. Rewarded tasks are forced to require confirmation.';
comment on function public.approve_family_task(uuid) is
  'Guardian approves a submitted task. If the task has a reward, creates an allowance_grant (pending decision) for the child.';
comment on function public.submit_family_task_completion(uuid) is
  'Child reports completion of their own task. Requires-confirmation tasks become submitted; others become done.';
comment on function public.list_family_tasks_for_current_user() is
  'Lists family tasks. Guardians see all family tasks; children see only their own. Excludes cancelled.';
