-- 繰り返しタスク（単一行再生成方式）
--
-- recurrence が 'daily' / 'weekly' のタスクは、完了（確認不要タスク）または
-- 承認（確認必須タスク）で done にせず、due_at を次回へ進めて status を open に戻す。
-- これにより 1 行を使い回して繰り返しを表現する。報酬の付与履歴は allowance_grants 側に残る。

-- ─── 次回期限の計算ヘルパー ────────────────────────────────────────────────────
-- base を起点に recurrence 間隔を加算し、now() を超えるまで進めた timestamptz を返す。
-- recurrence='none' の場合は null。
create or replace function public.family_task_next_due(
  base timestamptz,
  rec  public.family_task_recurrence
)
returns timestamptz
language plpgsql
stable
as $$
declare
  step     interval;
  next_due timestamptz;
  guard    integer := 0;
begin
  if rec = 'daily' then
    step := interval '1 day';
  elsif rec = 'weekly' then
    step := interval '7 days';
  else
    return null;
  end if;

  next_due := coalesce(base, now());
  loop
    next_due := next_due + step;
    guard := guard + 1;
    exit when next_due > now() or guard > 400;
  end loop;

  return next_due;
end;
$$;

revoke all on function public.family_task_next_due(timestamptz, public.family_task_recurrence) from public;

-- ─── 子の完了報告（繰り返し対応版）────────────────────────────────────────────
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
  new_status        public.family_task_status;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ft.family_id, ft.child_user_id, ft.status, ft.requires_confirmation, ft.recurrence, ft.due_at
    into task_family_id, task_child_id, task_status, task_requires, task_recurrence, task_due
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
    -- 確認必須: 承認待ちにする（繰り返しの再生成は承認時に行う）
    new_status := 'submitted';
    update public.family_tasks
    set status = 'submitted', completed_at = now()
    where id = target_task_id;
  elsif task_recurrence <> 'none' then
    -- 確認不要 かつ 繰り返し: done にせず次回へ再生成して open に戻す
    new_status := 'open';
    update public.family_tasks
    set status       = 'open',
        completed_at = null,
        approved_at  = null,
        due_at       = public.family_task_next_due(task_due, task_recurrence)
    where id = target_task_id;
  else
    -- 確認不要 かつ 単発: 完了
    new_status := 'done';
    update public.family_tasks
    set status = 'done', completed_at = now(), approved_at = now()
    where id = target_task_id;
  end if;

  return new_status::text;
end;
$$;

-- ─── 親の承認（繰り返し対応版）────────────────────────────────────────────────
-- 'submitted' → 報酬があれば allowance_grant を作成。
-- 繰り返しなら done にせず次回へ再生成して open に戻す。単発なら done。
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
    -- 繰り返し: 次回へ再生成して open に戻す（reward_grant_id は次の周回では持たない）
    update public.family_tasks
    set status              = 'open',
        completed_at        = null,
        approved_at         = null,
        approved_by_user_id = null,
        reward_grant_id     = null,
        due_at              = public.family_task_next_due(task_due, task_recurrence)
    where id = target_task_id;
  else
    -- 単発: 完了
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

comment on function public.family_task_next_due(timestamptz, public.family_task_recurrence) is
  'Returns the next due timestamp for a recurring task, advancing past now(). Null for recurrence=none.';
