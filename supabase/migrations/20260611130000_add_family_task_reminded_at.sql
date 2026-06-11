-- リマインド定期プッシュ用: 最後にリマインドを送った時刻。
-- 「1日1回まで」の重複送信防止に使う（reminded_at が当日0時(JST)より前 or null なら対象）。

alter table public.family_tasks
  add column if not exists reminded_at timestamptz;

-- 未完了タスクを期限で絞り込むリマインド抽出用の部分インデックス
create index if not exists family_tasks_open_due_idx
  on public.family_tasks (due_at)
  where status = 'open';
