-- 親が子どもに設定する「やること（タスク）」
--
-- Phase 1（単発タスク）: タイトル・説明・期限・報酬・完了確認を持つ。
-- 繰り返し(recurrence)とリマインド(remind_at)は将来拡張用に列のみ用意し、
-- 今回は recurrence='none' のみ使用する。
--
-- スコープ: family_id。RLS の読み取りは family_memberships(active) 基準。
-- 書き込みは全て security definer RPC 経由（add_family_task_rpcs.sql）。

do $$
begin
  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'family_task_status'
  ) then
    create type public.family_task_status as enum (
      'open',       -- 未完了
      'submitted',  -- 子が完了報告（親の承認待ち）
      'done',       -- 完了（承認済み / 確認不要タスクの完了）
      'cancelled'   -- 取り消し
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'family_task_recurrence'
  ) then
    create type public.family_task_recurrence as enum (
      'none',
      'daily',
      'weekly'
    );
  end if;
end $$;

create table if not exists public.family_tasks (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid not null references public.families (id) on delete cascade,
  child_user_id         uuid not null references auth.users (id) on delete cascade,
  created_by_user_id    uuid not null references auth.users (id) on delete restrict,
  title                 text not null,
  description           text,
  reward_amount_jpy     integer,
  due_at                timestamptz,
  remind_at             timestamptz,
  recurrence            public.family_task_recurrence not null default 'none',
  requires_confirmation boolean not null default true,
  status                public.family_task_status not null default 'open',
  completed_at          timestamptz,
  approved_at           timestamptz,
  approved_by_user_id   uuid references auth.users (id) on delete set null,
  -- 報酬を自動付与した場合に作成された allowance_grant への参照（最重要領域との紐付け）
  reward_grant_id       uuid references public.allowance_grants (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint family_tasks_title_not_blank
    check (length(btrim(title)) > 0),
  constraint family_tasks_reward_nonneg
    check (reward_amount_jpy is null or reward_amount_jpy >= 0)
);

create index if not exists family_tasks_family_child_status_idx
  on public.family_tasks (family_id, child_user_id, status);

create index if not exists family_tasks_due_idx
  on public.family_tasks (due_at);

alter table public.family_tasks enable row level security;

-- 読み取り: 同じ家族のアクティブメンバーのみ。
-- 子を自分のタスクのみに絞る制御は list RPC 側で行う（既存 allowance_grants と同方針）。
drop policy if exists "family_tasks_select_family_members" on public.family_tasks;
create policy "family_tasks_select_family_members"
on public.family_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fms
    where fms.family_id = family_tasks.family_id
      and fms.user_id   = auth.uid()
      and fms.status     = 'active'
  )
);

-- insert / update / delete ポリシーは付与しない。
-- 全ての書き込みは security definer RPC 経由でのみ許可する。

-- updated_at 自動更新（set_updated_at() は push_subscriptions マイグレーションで定義済み）
drop trigger if exists family_tasks_set_updated_at on public.family_tasks;
create trigger family_tasks_set_updated_at
  before update on public.family_tasks
  for each row execute function public.set_updated_at();
