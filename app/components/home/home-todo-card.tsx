"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// ホーム「やること」カード
//
// 子どものホーム上部に表示する、対応が必要なことをまとめたカード。
// 現状は「お小遣いの受け取り判断（すぐもらう / 投資する）」のみを扱うが、
// 将来的に親が設定する「やること（宿題・お手伝いなど）」を追加できるよう、
// 1つ1つを独立した todo 部品として並べる構造にしている。
//
// 受け取り・投資判断は最重要領域のため、ここでは判断ロジックを新たに作らず、
// 既存の API ルート / RPC をそのまま呼び出している。
//   - すぐもらう : POST /api/allowance-decisions/immediate-cash
//   - 投資する   : rpc("request_investment_for_allowance")
// ─────────────────────────────────────────────────────────────────────────────

type InvestmentCategoryCode = "index_stock" | "single_stock" | "resource" | "crypto";

type InvestmentCategory = {
  code: InvestmentCategoryCode;
  name: string;
  description: string;
};

// 既存の allowance-grants-panel.tsx と同じ定義。将来的に共通モジュールへ集約予定。
const investmentCategories: InvestmentCategory[] = [
  {
    code: "index_stock",
    name: "インデックス株式",
    description:
      "世界のいろいろな会社に広く分けて投資するジャンルです。1つにしぼらず、まとめて応援するイメージです。",
  },
  {
    code: "single_stock",
    name: "個別株式",
    description:
      "会社の価値を応援するように、その会社そのものへ投資するジャンルです。会社ごとの良し悪しが出やすいです。",
  },
  {
    code: "resource",
    name: "現物・資源",
    description:
      "金や銀などの現物資産や、資源に関係するジャンルです。世界の出来事や景気で動きやすい特徴があります。",
  },
  {
    code: "crypto",
    name: "仮想通貨",
    description:
      "インターネット上でやりとりされるデジタル資産のジャンルです。値動きが大きい特徴があります。",
  },
];

export type InvestmentAssetOption = {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  asset_category_code: InvestmentCategoryCode;
  description: string | null;
  latest_price_date: string | null;
  latest_unit_price_jpy: number | null;
  previous_price_date: string | null;
  previous_unit_price_jpy: number | null;
  daily_change_jpy: number | null;
  daily_change_rate: number | string | null;
};

export type PendingDecisionGrant = {
  id: string;
  amount_jpy: number;
  granted_at: string;
};

// 親が設定した「やること」。今回は open / submitted のみ子のホームに表示する。
export type FamilyTaskTodo = {
  id: string;
  title: string;
  description: string | null;
  reward_amount_jpy: number | null;
  due_at: string | null;
  recurrence: string;
  status: string;
  requires_confirmation: boolean;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP");
}

function formatDueLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const isSameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return isSameDay ? `今日 ${time}` : `${date.toLocaleDateString("ja-JP")} ${time}`;
}

function formatRate(rate: number | string) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(Number(rate));
}

function formatDailyChange(asset: InvestmentAssetOption) {
  if (asset.daily_change_jpy === null || asset.daily_change_rate === null) {
    return "前日比なし";
  }
  const sign = asset.daily_change_jpy >= 0 ? "+" : "";
  return `${sign}${formatCurrency(asset.daily_change_jpy)}（${sign}${formatRate(asset.daily_change_rate)}%）`;
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

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,28,54,0.36)] px-4 py-4 sm:py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_24px_70px_rgba(26,44,82,0.28)] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold leading-8 text-[var(--text-primary)]">{title}</h3>
          <button
            type="button"
            className="shrink-0 rounded-full border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--text-secondary)]"
            onClick={onClose}
          >
            とじる
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        {footer ? (
          <div className="mt-4 border-t border-[var(--border-soft)] pt-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Decision flow state ─────────────────────────────────────────────────────

type DecisionFlow =
  | { type: "cash_confirm"; grantId: string }
  | { type: "invest_category"; grantId: string }
  | { type: "invest_asset"; grantId: string; categoryCode: InvestmentCategoryCode }
  | { type: "invest_confirm"; grantId: string; categoryCode: InvestmentCategoryCode; assetId: string }
  | null;

// ─── Single allowance-decision todo row ──────────────────────────────────────

function AllowanceDecisionTodo({
  grant,
  elementaryMode,
  onCash,
  onInvest,
  disabled,
}: {
  grant: PendingDecisionGrant;
  elementaryMode: boolean;
  onCash: () => void;
  onInvest: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--border-soft)] bg-white p-4 shadow-[0_6px_16px_rgba(47,127,74,0.06)]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(228,163,94,0.16)] px-3 py-1 text-xs font-bold text-[var(--warning)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
        <AutoHiragana enabled={elementaryMode}>まだやっていないこと</AutoHiragana>
      </span>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        <AutoHiragana enabled={elementaryMode}>
          まだお小遣いの受け取り方法を決めていないものがあります。
        </AutoHiragana>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-[16px] bg-[var(--surface-accent)] px-3 py-2">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
            <AutoHiragana enabled={elementaryMode}>お小遣い</AutoHiragana>
          </p>
          <p className="mt-0.5 text-xl font-black text-[var(--text-primary)]">
            {formatCurrency(grant.amount_jpy)}
          </p>
        </div>
        <div className="rounded-[16px] bg-[var(--surface-accent)] px-3 py-2">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
            <AutoHiragana enabled={elementaryMode}>付与日</AutoHiragana>
          </p>
          <p className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {formatDate(grant.granted_at)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PrimaryButton type="button" size="sm" onClick={onCash} disabled={disabled}>
          <AutoHiragana enabled={elementaryMode}>すぐもらう</AutoHiragana>
        </PrimaryButton>
        <SecondaryButton type="button" size="sm" onClick={onInvest} disabled={disabled}>
          <AutoHiragana enabled={elementaryMode}>投資する</AutoHiragana>
        </SecondaryButton>
      </div>
    </div>
  );
}

// ─── Single parent-set task row ──────────────────────────────────────────────

function FamilyTaskTodoItem({
  task,
  elementaryMode,
  onComplete,
  submitting,
}: {
  task: FamilyTaskTodo;
  elementaryMode: boolean;
  onComplete: () => void;
  submitting: boolean;
}) {
  const isSubmitted = task.status === "submitted";

  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[var(--border-soft)] bg-white p-4 shadow-[0_6px_16px_rgba(47,127,74,0.06)]">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
          isSubmitted ? "border-[var(--success)] bg-[var(--success)]" : "border-[var(--border-strong)]"
        }`}
      >
        {isSubmitted ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-[var(--text-primary)]">
          <AutoHiragana enabled={elementaryMode}>{task.title}</AutoHiragana>
        </p>
        {task.description ? (
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
            <AutoHiragana enabled={elementaryMode}>{task.description}</AutoHiragana>
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--text-secondary)]">
          {task.recurrence === "daily" || task.recurrence === "weekly" ? (
            <span className="rounded-full bg-[var(--surface-accent)] px-2 py-0.5 font-bold text-[var(--brand-primary-strong)]">
              <AutoHiragana enabled={elementaryMode}>
                {task.recurrence === "daily" ? "毎日" : "毎週"}
              </AutoHiragana>
            </span>
          ) : null}
          {task.due_at ? (
            <span>
              <AutoHiragana enabled={elementaryMode}>期限</AutoHiragana>：{formatDueLabel(task.due_at)}
            </span>
          ) : null}
          {task.reward_amount_jpy && task.reward_amount_jpy > 0 ? (
            <span className="font-bold text-[var(--brand-primary)]">
              <AutoHiragana enabled={elementaryMode}>達成すると</AutoHiragana>{" "}
              {formatCurrency(task.reward_amount_jpy)}
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          {isSubmitted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(76,163,104,0.12)] px-3 py-1.5 text-xs font-bold text-[var(--success)]">
              <AutoHiragana enabled={elementaryMode}>おうちの人の確認まち</AutoHiragana>
            </span>
          ) : (
            <PrimaryButton type="button" size="sm" fullWidth={false} onClick={onComplete} disabled={submitting}>
              <AutoHiragana enabled={elementaryMode}>できた！</AutoHiragana>
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main card ───────────────────────────────────────────────────────────────

export default function HomeTodoCard({
  pendingGrants,
  tasks = [],
  investmentAssets,
  elementaryMode = false,
  onDecided,
  onTaskChanged,
}: {
  pendingGrants: PendingDecisionGrant[];
  tasks?: FamilyTaskTodo[];
  investmentAssets: InvestmentAssetOption[];
  elementaryMode?: boolean;
  onDecided: () => void;
  onTaskChanged?: () => void;
}) {
  const [flow, setFlow] = useState<DecisionFlow>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState("");

  // 親が設定したやること（未完了・承認待ち）とお小遣い判断を合算する
  const visibleTasks = tasks.filter((task) => task.status === "open" || task.status === "submitted");
  const todoCount = pendingGrants.length + visibleTasks.length;

  if (todoCount === 0) return null;

  const handleCompleteTask = async (taskId: string) => {
    setSubmittingTaskId(taskId);
    setTaskError("");
    try {
      // RPC を直接呼ばず API ルート経由にして、成功後に保護者へプッシュ通知する
      const accessToken = await getAccessToken();
      const response = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "完了の報告に失敗しました。");
      }
      onTaskChanged?.();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "完了の報告に失敗しました。");
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const closeFlow = () => {
    if (submitting) return;
    setFlow(null);
    setError("");
  };

  const availableCategories = investmentCategories.filter((category) =>
    investmentAssets.some((asset) => asset.asset_category_code === category.code)
  );
  const assetsForCategory = (code: InvestmentCategoryCode) =>
    investmentAssets.filter((asset) => asset.asset_category_code === code);

  const handleImmediateCash = async (grantId: string) => {
    setSubmitting(true);
    setError("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/allowance-decisions/immediate-cash", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grantId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "すぐにもらう選択に失敗しました。");
      }
      setFlow(null);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : "すぐにもらう選択に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvestment = async (grantId: string, assetId: string) => {
    setSubmitting(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("request_investment_for_allowance", {
      target_allowance_grant_id: grantId,
      target_asset_id: assetId,
    });
    if (rpcError) {
      setError(`投資する選択に失敗しました: ${rpcError.message}`);
      setSubmitting(false);
      return;
    }
    setFlow(null);
    setSubmitting(false);
    onDecided();
  };

  const confirmAsset =
    flow?.type === "invest_confirm"
      ? investmentAssets.find((asset) => asset.asset_id === flow.assetId) ?? null
      : null;

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] border-2 border-[rgba(228,163,94,0.35)] bg-[linear-gradient(135deg,rgba(255,247,232,0.95)_0%,rgba(255,251,242,0.95)_100%)] p-5 shadow-[0_14px_36px_rgba(228,163,94,0.18)]">
        {/* 補助イラスト: ミラくん（ユーザーアイコンとは別物） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/character/mirakun-pointing.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 right-2 h-24 w-24 object-contain opacity-90 sm:h-28 sm:w-28"
        />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--warning)] text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </span>
            <p className="text-lg font-extrabold text-[var(--text-primary)]">
              <AutoHiragana enabled={elementaryMode}>やること</AutoHiragana>
            </p>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[var(--warning)]">
              <AutoHiragana enabled={elementaryMode}>{`のこり ${todoCount}こ`}</AutoHiragana>
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:pr-28">
            {pendingGrants.map((grant) => (
              <AllowanceDecisionTodo
                key={grant.id}
                grant={grant}
                elementaryMode={elementaryMode}
                disabled={submitting}
                onCash={() => {
                  setError("");
                  setFlow({ type: "cash_confirm", grantId: grant.id });
                }}
                onInvest={() => {
                  setError("");
                  setFlow({ type: "invest_category", grantId: grant.id });
                }}
              />
            ))}

            {visibleTasks.map((task) => (
              <FamilyTaskTodoItem
                key={task.id}
                task={task}
                elementaryMode={elementaryMode}
                submitting={submittingTaskId === task.id}
                onComplete={() => handleCompleteTask(task.id)}
              />
            ))}

            {taskError ? (
              <p className="text-sm font-semibold text-[var(--danger)]">{taskError}</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* すぐもらう 確認 */}
      {flow?.type === "cash_confirm" ? (
        <Modal
          title={<AutoHiragana enabled={elementaryMode}>今すぐもらうでよろしいですか？</AutoHiragana>}
          onClose={closeFlow}
        >
          <div className="space-y-4">
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              <AutoHiragana enabled={elementaryMode}>
                このお小遣いを今すぐもらう方法で決めます。
              </AutoHiragana>
            </p>
            {error ? <p className="text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                onClick={() => handleImmediateCash(flow.grantId)}
                disabled={submitting}
              >
                {submitting ? "保存中..." : <AutoHiragana enabled={elementaryMode}>はい</AutoHiragana>}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={closeFlow} disabled={submitting}>
                <AutoHiragana enabled={elementaryMode}>やめる</AutoHiragana>
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* 投資する: ジャンル選択 */}
      {flow?.type === "invest_category" ? (
        <Modal
          title={<AutoHiragana enabled={elementaryMode}>投資ジャンルを選択してください。</AutoHiragana>}
          onClose={closeFlow}
        >
          <div className="space-y-3">
            {availableCategories.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                <AutoHiragana enabled={elementaryMode}>
                  いま選べる投資先がありません。お小遣い画面から確認してください。
                </AutoHiragana>
              </p>
            ) : (
              availableCategories.map((category) => (
                <button
                  key={category.code}
                  type="button"
                  className="w-full rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-left transition hover:border-[var(--brand-primary)] hover:bg-[rgba(76,163,104,0.1)]"
                  onClick={() =>
                    setFlow({ type: "invest_asset", grantId: flow.grantId, categoryCode: category.code })
                  }
                >
                  <p className="font-bold text-[var(--text-primary)]">
                    <AutoHiragana enabled={elementaryMode}>{category.name}</AutoHiragana>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    <AutoHiragana enabled={elementaryMode}>{category.description}</AutoHiragana>
                  </p>
                </button>
              ))
            )}
          </div>
        </Modal>
      ) : null}

      {/* 投資する: 投資先選択 */}
      {flow?.type === "invest_asset" ? (
        <Modal
          title={<AutoHiragana enabled={elementaryMode}>投資先を選択してください。</AutoHiragana>}
          onClose={closeFlow}
          footer={
            <SecondaryButton
              type="button"
              onClick={() => setFlow({ type: "invest_category", grantId: flow.grantId })}
            >
              <AutoHiragana enabled={elementaryMode}>もどる</AutoHiragana>
            </SecondaryButton>
          }
        >
          <div className="space-y-3">
            {assetsForCategory(flow.categoryCode).map((asset) => (
              <button
                key={asset.asset_id}
                type="button"
                className="w-full rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-left transition hover:border-[var(--brand-primary)] hover:bg-[rgba(76,163,104,0.1)]"
                onClick={() =>
                  setFlow({
                    type: "invest_confirm",
                    grantId: flow.grantId,
                    categoryCode: flow.categoryCode,
                    assetId: asset.asset_id,
                  })
                }
              >
                <p className="font-bold text-[var(--text-primary)]">{asset.asset_name}</p>
                {asset.description ? (
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{asset.description}</p>
                ) : null}
                <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                  <p>
                    <AutoHiragana enabled={elementaryMode}>今の価格</AutoHiragana>:{" "}
                    {asset.latest_unit_price_jpy !== null
                      ? formatCurrency(asset.latest_unit_price_jpy)
                      : "未取得"}
                  </p>
                  <p>
                    <AutoHiragana enabled={elementaryMode}>前日比</AutoHiragana>: {formatDailyChange(asset)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {/* 投資する: 確認 */}
      {flow?.type === "invest_confirm" && confirmAsset ? (
        <Modal
          title={
            <AutoHiragana enabled={elementaryMode}>
              {`${confirmAsset.asset_name}に投資します。よろしいですか？`}
            </AutoHiragana>
          }
          onClose={closeFlow}
        >
          <div className="space-y-4">
            <div className="rounded-[20px] bg-[rgba(76,163,104,0.12)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p className="font-bold text-[var(--text-primary)]">{confirmAsset.asset_name}</p>
              {confirmAsset.description ? (
                <p className="mt-1 leading-6">{confirmAsset.description}</p>
              ) : null}
              <p className="mt-2">
                <AutoHiragana enabled={elementaryMode}>今の価格</AutoHiragana>:{" "}
                {confirmAsset.latest_unit_price_jpy !== null
                  ? formatCurrency(confirmAsset.latest_unit_price_jpy)
                  : "未取得"}
              </p>
            </div>
            {error ? <p className="text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                onClick={() => handleInvestment(flow.grantId, flow.assetId)}
                disabled={submitting}
              >
                {submitting ? "保存中..." : <AutoHiragana enabled={elementaryMode}>はい</AutoHiragana>}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() =>
                  setFlow({
                    type: "invest_asset",
                    grantId: flow.grantId,
                    categoryCode: flow.categoryCode,
                  })
                }
                disabled={submitting}
              >
                <AutoHiragana enabled={elementaryMode}>もどる</AutoHiragana>
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
