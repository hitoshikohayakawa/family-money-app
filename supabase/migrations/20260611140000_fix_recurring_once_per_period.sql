-- 繰り返しタスクの「1期間1回」制約を修正
--
-- 旧実装は承認/完了で即 open に戻していたため、毎日タスクを同日に何度でも
-- 完了申請できてしまった。完了日(completed_at)を「最終完了時刻」として保持し、
-- 同一期間(毎日=同日 / 毎週=同ISO週, JST基準)の再提出を拒否する。

-- ─── 当該期間に完了済みかの判定（JST基準）──────────────────────────────────────
create or replace function public.family_task_completed_this_period(
  last_completed timestamptz,
  rec            public.family_task_recurrence
)
returns boolean
language sql
stable
as $$
  select case
    when last_completed is null then false
    when rec = 'daily' then
      (last_completed at time zone 'Asia/Tokyo')::date
        = (now() at time zone 'Asia/Tokyo')::date
    when rec = 'weekly' then
      date_trunc('week', last_completed at time zone 'Asia/Tokyo')
        = date_trunc('week', now() at time zone 'Asia/Tokyo')
    else false
  end
$$;

revoke all on function public.family_task_completed_this_period(timestamptz, public.family_task_recurrence) from public;

-- ─── 子の完了報告（1期間1回ガード付き）────────────────────────────────────────
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
  task_recurrence   public.family_task_recurrence;
  task_due          timestamptz;
  task_completed_at timestamptz;
  new_status        public.family_task_status;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ft.family_id, ft.child_user_id, ft.status, ft.requires_confirmation,
         ft.recurrence, ft.due_at, ft.completed_at
    into task_family_id, task_child_id, task_status, task_requires,
         task_recurrence, task_due, task_completed_at
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

  -- 繰り返しは1期間に1回まで（毎日=同日 / 毎週=同ISO週, JST基準）
  if task_recurrence <> 'none'
     and public.family_task_completed_this_period(task_completed_at, task_recurrence) then
    raise exception 'This recurring task is already completed for the current period';
  end if;

  if task_requires then
    new_status := 'submitted';
    update public.family_tasks
    set status = 'submitted', completed_at = now()
    where id = target_task_id;
  elsif task_recurrence <> 'none' then
    -- 確認不要・繰り返し: completed_at を残したまま次回へ再生成
    new_status := 'open';
    update public.family_tasks
    set status       = 'open',
        completed_at = now(),
        approved_at  = null,
        due_at       = public.family_task_next_due(task_due, task_recurrence)
    where id = target_task_id;
  else
    -- 確認不要・単発: 完了
    new_status := 'done';
    update public.family_tasks
    set status = 'done', completed_at = now(), approved_at = now()
    where id = target_task_id;
  end if;

  return new_status::text;
end;
$$;

-- ─── 親の承認（再生成時に completed_at を保持）────────────────────────────────
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
  task_recurrence   public.family_task_recurrence;
  task_due          timestamptz;
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

  select ft.family_id, ft.child_user_id, ft.status, ft.reward_amount_jpy, ft.recurrence, ft.due_at
    into task_family_id, task_child_id, task_status, task_reward, task_recurrence, task_due
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

  if task_reward is not null and task_reward > 0 then
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
      family_id, child_user_id, granted_by_user_id, amount_jpy, note, granted_at
    )
    values (
      task_family_id, task_child_id, current_user_id, task_reward, 'やること達成報酬', now()
    )
    returning id into new_grant_id;

    insert into public.grant_decisions (allowance_grant_id, decision_status)
    values (new_grant_id, 'pending'::public.grant_decision_status)
    on conflict (allowance_grant_id) do nothing;
  end if;

  if task_recurrence <> 'none' then
    -- 繰り返し: completed_at は最終完了日として保持し、次回へ再生成
    update public.family_tasks
    set status              = 'open',
        approved_at         = null,
        approved_by_user_id = null,
        reward_grant_id     = null,
        due_at              = public.family_task_next_due(task_due, task_recurrence)
    where id = target_task_id;
  else
    update public.family_tasks
    set status              = 'done',
        approved_at         = now(),
        approved_by_user_id = current_user_id,
        reward_grant_id     = new_grant_id
    where id = target_task_id;
  end if;

  return new_grant_id;
end;
$$;

comment on function public.family_task_completed_this_period(timestamptz, public.family_task_recurrence) is
  'True if a recurring task was already completed in the current period (daily=same JST date, weekly=same ISO week).';
