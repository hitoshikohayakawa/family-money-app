"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import TextInput from "@/app/components/ui/text-input";
import SelectInput from "@/app/components/ui/select-input";
import StatusBadge from "@/app/components/ui/status-badge";

// ─── Types ───────────────────────────────────────────────────────────────────

type FamilyMember = {
  user_id: string;
  role: string;
  display_label: string;
};

type TaskRow = {
  id: string;
  child_user_id: string;
  child_display_label: string;
  title: string;
  description: string | null;
  reward_amount_jpy: number | null;
  due_at: string | null;
  recurrence: string;
  status: "open" | "submitted" | "done" | "cancelled";
  requires_confirmation: boolean;
  completed_at: string | null;
  approved_at: string | null;
};

function recurrenceLabel(recurrence: string): string | null {
  if (recurrence === "daily") return "毎日";
  if (recurrence === "weekly") return "毎週";
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await getSafeSession(supabase);
  if (error || !session?.access_token) {
    throw new Error("ログイン状態を確認できませんでした。");
  }
  return session.access_token;
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// datetime-local の文字列(例 "2026-06-12T18:00") を ISO に変換
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const STATUS_TONE: Record<TaskRow["status"], "warning" | "info" | "success" | "neutral"> = {
  submitted: "warning",
  open: "info",
  done: "success",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<TaskRow["status"], string> = {
  submitted: "承認まち",
  open: "進行中",
  done: "完了",
  cancelled: "取り消し",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function FamilyTasksPanel() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  // Form state
  const [childId, setChildId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reward, setReward] = useState("");
  const [requiresConfirmation, setRequiresConfirmation] = useState(true);
  const [recurrence, setRecurrence] = useState("none");
  const [submitting, setSubmitting] = useState(false);

  const children = useMemo(() => members.filter((m) => m.role === "child"), [members]);
  const rewardValue = reward.trim() === "" ? null : Number(reward);
  const rewardForcesConfirmation = rewardValue !== null && rewardValue > 0;

  const load = useCallback(async () => {
    const [{ data: membersRaw }, { data: tasksRaw }] = await Promise.all([
      supabase.rpc("list_family_members_for_current_user"),
      supabase.rpc("list_family_tasks_for_current_user"),
    ]);
    setMembers(Array.isArray(membersRaw) ? (membersRaw as FamilyMember[]) : []);
    setTasks(Array.isArray(tasksRaw) ? (tasksRaw as TaskRow[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await getSafeSession(supabase);
      if (!session?.user) {
        setLoading(false);
        return;
      }
      await load();
    })();
  }, [load]);

  // 子が1人なら未選択でもその子を既定にする（明示選択があればそちらを優先）
  const effectiveChildId = childId || (children.length === 1 ? children[0].user_id : "");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueAt("");
    setReward("");
    setRequiresConfirmation(true);
    setRecurrence("none");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!effectiveChildId) {
      setError("やることを設定する子どもを選んでください。");
      return;
    }
    if (title.trim().length === 0) {
      setError("タイトルを入力してください。");
      return;
    }
    if (rewardValue !== null && (Number.isNaN(rewardValue) || rewardValue < 0)) {
      setError("ごほうびは0以上の数字で入力してください。");
      return;
    }

    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("create_family_task", {
      target_child_user_id: effectiveChildId,
      task_title: title.trim(),
      task_description: description.trim() === "" ? null : description.trim(),
      task_reward_amount_jpy: rewardValue,
      task_due_at: localInputToIso(dueAt),
      task_remind_at: null,
      task_requires_confirmation: requiresConfirmation,
      task_recurrence: recurrence,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(`やることの作成に失敗しました: ${rpcError.message}`);
      return;
    }
    resetForm();
    setSuccess("やることを追加しました。");
    await load();
  };

  const handleApprove = async (taskId: string) => {
    setError("");
    setSuccess("");
    setBusyTaskId(taskId);
    try {
      // RPC を直接呼ばず API ルート経由にして、成功後に子へプッシュ通知する
      const accessToken = await getAccessToken();
      const response = await fetch("/api/tasks/approve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "承認に失敗しました。");
      }
      setSuccess("やることを承認しました。ごほうびがある場合はお小遣いに追加されています。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました。");
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleCancel = async (taskId: string) => {
    setError("");
    setSuccess("");
    setBusyTaskId(taskId);
    const { error: rpcError } = await supabase.rpc("cancel_family_task", {
      target_task_id: taskId,
    });
    setBusyTaskId(null);
    if (rpcError) {
      setError(`取り消しに失敗しました: ${rpcError.message}`);
      return;
    }
    setSuccess("やることを取り消しました。");
    await load();
  };

  // 完了済みは履歴的なので一覧の最後にまとめる
  const submittedTasks = tasks.filter((t) => t.status === "submitted");
  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status === "done");

  if (loading) {
    return <p className="text-sm text-[var(--text-secondary)]">読み込み中...</p>;
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-2xl bg-[rgba(191,110,82,0.1)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-2xl bg-[rgba(76,163,104,0.12)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {success}
        </p>
      ) : null}

      {/* 作成フォーム */}
      <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <h2 className="text-lg font-extrabold text-[var(--text-primary)]">やることを追加</h2>
        {children.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            やることを設定できる子どもがいません。先に家族に子どもを招待してください。
          </p>
        ) : (
          <form className="mt-4 grid gap-4" onSubmit={handleCreate}>
            <SelectInput
              label="だれの「やること」？"
              value={effectiveChildId}
              onChange={(e) => setChildId(e.target.value)}
            >
              <option value="" disabled>
                子どもを選んでください
              </option>
              {children.map((child) => (
                <option key={child.user_id} value={child.user_id}>
                  {child.display_label}
                </option>
              ))}
            </SelectInput>

            <TextInput
              label="タイトル"
              placeholder="例：宿題をする"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
            />

            <label className="flex flex-col gap-2 text-base font-bold text-[var(--text-primary)]">
              <span>説明（任意）</span>
              <textarea
                className="min-h-20 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,251,244,0.96))] px-4 py-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                placeholder="例：算数のプリントを1枚やる"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="期限（任意）"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
              <TextInput
                label="ごほうび（任意・円）"
                hint="好きな金額を設定できます（1円単位・0以上）"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="例：100"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-3 rounded-[18px] border border-[var(--border-soft)] bg-white px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
                checked={requiresConfirmation || rewardForcesConfirmation}
                disabled={rewardForcesConfirmation}
                onChange={(e) => setRequiresConfirmation(e.target.checked)}
              />
              <span className="text-sm leading-6 text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-primary)]">完了におうちの人の確認を必要にする</span>
                <br />
                子どもが「できた！」を押したあと、保護者の承認で完了になります。
                {rewardForcesConfirmation ? (
                  <span className="mt-1 block font-semibold text-[var(--warning)]">
                    ※ごほうびがあるやることは、承認時にお小遣いを付与するため確認が必須です。
                  </span>
                ) : null}
              </span>
            </label>

            <SelectInput
              label="繰り返し"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              <option value="none">繰り返さない（単発）</option>
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
            </SelectInput>
            {recurrence !== "none" ? (
              <p className="-mt-2 text-sm text-[var(--text-muted)]">
                完了（承認）すると、自動で次回の期限に切り替わって続きます。
              </p>
            ) : null}

            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "追加中..." : "この内容で追加する"}
            </PrimaryButton>
          </form>
        )}
      </section>

      {/* 承認まち */}
      {submittedTasks.length > 0 ? (
        <TaskGroup title="承認まち">
          {submittedTasks.map((task) => (
            <TaskCard key={task.id} task={task}>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <PrimaryButton
                  type="button"
                  size="sm"
                  onClick={() => handleApprove(task.id)}
                  disabled={busyTaskId === task.id}
                >
                  {busyTaskId === task.id ? "処理中..." : "承認する"}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  size="sm"
                  onClick={() => handleCancel(task.id)}
                  disabled={busyTaskId === task.id}
                >
                  取り消す
                </SecondaryButton>
              </div>
            </TaskCard>
          ))}
        </TaskGroup>
      ) : null}

      {/* 進行中 */}
      {openTasks.length > 0 ? (
        <TaskGroup title="進行中">
          {openTasks.map((task) => (
            <TaskCard key={task.id} task={task}>
              <div className="mt-3">
                <SecondaryButton
                  type="button"
                  size="sm"
                  onClick={() => handleCancel(task.id)}
                  disabled={busyTaskId === task.id}
                >
                  取り消す
                </SecondaryButton>
              </div>
            </TaskCard>
          ))}
        </TaskGroup>
      ) : null}

      {/* 完了 */}
      {doneTasks.length > 0 ? (
        <TaskGroup title="完了したやること">
          {doneTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </TaskGroup>
      ) : null}

      {submittedTasks.length === 0 && openTasks.length === 0 && doneTasks.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">まだやることはありません。</p>
      ) : null}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TaskGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-extrabold text-[var(--text-primary)]">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function TaskCard({ task, children }: { task: TaskRow; children?: React.ReactNode }) {
  const due = formatDateTime(task.due_at);
  return (
    <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-[var(--text-primary)]">{task.title}</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-secondary)]">
            {task.child_display_label}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</StatusBadge>
      </div>

      {task.description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{task.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        {recurrenceLabel(task.recurrence) ? (
          <span className="rounded-full bg-[var(--surface-accent)] px-2 py-0.5 font-bold text-[var(--brand-primary-strong)]">
            {recurrenceLabel(task.recurrence)}
          </span>
        ) : null}
        {due ? <span>期限：{due}</span> : null}
        {task.reward_amount_jpy && task.reward_amount_jpy > 0 ? (
          <span className="font-bold text-[var(--brand-primary)]">
            ごほうび：{formatCurrency(task.reward_amount_jpy)}
          </span>
        ) : null}
      </div>

      {children}
    </div>
  );
}
