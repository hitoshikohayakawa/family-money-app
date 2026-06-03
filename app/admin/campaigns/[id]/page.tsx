"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/admin-guard";
import AppHeader from "@/app/components/app-header";
import FooterNav from "@/app/components/ui/footer-nav";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

type Campaign = {
  id: string;
  subject: string;
  body_text: string;
  target_role: string;
  status: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  sent_at: string | null;
  created_at: string;
};

type Recipient = {
  id: string;
  email: string;
  status: string;
  error_msg: string | null;
  sent_at: string | null;
};

const TARGET_LABEL: Record<string, string> = { all: "全員", guardian: "親", child: "子ども" };
const STATUS_COLOR: Record<string, string> = {
  draft:   "bg-gray-100 text-gray-600",
  sending: "bg-yellow-100 text-yellow-700",
  done:    "bg-green-100 text-green-700",
  failed:  "bg-red-100 text-red-600",
  sent:    "bg-green-100 text-green-700",
  pending: "bg-gray-100 text-gray-500",
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const { data: { session } } = await getSafeSession(supabase);
      if (!isActive) return;
      if (!session?.access_token) { setLoading(false); return; }

      const [campaignRes, recipientsRes] = await Promise.all([
        fetch(`/api/admin/campaigns?id=${campaignId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase
          .from("email_campaign_recipients")
          .select("id, email, status, error_msg, sent_at")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: true }),
      ]);

      if (!isActive) return;

      if (campaignRes.ok) {
        const json = (await campaignRes.json()) as { campaigns: Campaign[] };
        const found = json.campaigns?.find((c) => c.id === campaignId);
        if (found) setCampaign(found);
        else setError("キャンペーンが見つかりません");
      } else {
        setError("取得に失敗しました");
      }

      if (!recipientsRes.error) {
        setRecipients((recipientsRes.data ?? []) as Recipient[]);
      }
      setLoading(false);
    };
    void load();
    return () => { isActive = false; };
  }, [campaignId, refreshKey]);

  const handleSend = async () => {
    if (!campaign) return;
    const confirmed = window.confirm(
      `「${campaign.subject}」を ${TARGET_LABEL[campaign.target_role] ?? campaign.target_role} に送信します。よろしいですか？`
    );
    if (!confirmed) return;

    setSending(true);
    setSendResult("");
    setError("");

    const { data: { session } } = await getSafeSession(supabase);
    if (!session?.access_token) { setError("ログインが必要です"); setSending(false); return; }

    const res = await fetch("/api/admin/campaigns/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ campaignId }),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean; total?: number; success?: number; fail?: number; error?: string;
    } | null;

    if (!res.ok || !json?.ok) {
      setError(json?.error ?? "送信に失敗しました");
    } else {
      setSendResult(`送信完了 ✓  成功: ${json.success}件 / 失敗: ${json.fail}件 / 合計: ${json.total}件`);
    }
    setSending(false);
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <AdminGuard />
      <AppHeader />
      <div className="mx-auto w-full max-w-[840px] px-4 py-8 sm:px-6">
        <div className="mb-4">
          <Link href="/admin/campaigns" className="text-sm font-semibold text-[var(--brand-primary)]">
            ← キャンペーン一覧
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">読み込み中...</p>
        ) : error && !campaign ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : campaign ? (
          <div className="space-y-5">
            {/* Campaign info */}
            <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-extrabold text-[var(--text-primary)]">{campaign.subject}</h1>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[campaign.status] ?? STATUS_COLOR.draft}`}>
                  {campaign.status}
                </span>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-[var(--text-muted)]">
                <p>対象: {TARGET_LABEL[campaign.target_role] ?? campaign.target_role}</p>
                <p>作成: {new Date(campaign.created_at).toLocaleString("ja-JP")}</p>
                {campaign.sent_at && <p>送信: {new Date(campaign.sent_at).toLocaleString("ja-JP")}</p>}
                {campaign.status === "done" && (
                  <p>結果: 成功 {campaign.success_count}件 / 失敗 {campaign.fail_count}件 / 合計 {campaign.total_count}件</p>
                )}
              </div>

              <div className="mt-4 rounded-[16px] bg-[var(--surface-accent)] px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-primary)]">{campaign.body_text}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">※ 実際のメールにはフッター（サービス情報・配信停止リンク）が自動追加されます。</p>
            </div>

            {/* Send / result */}
            {(campaign.status === "draft" || campaign.status === "failed") && (
              <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5">
                <p className="text-sm font-bold text-[var(--text-primary)]">送信</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  「送信する」を押すと、対象ユーザー全員に即時送信されます。
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
                ) : null}
                {sendResult ? (
                  <p className="mt-3 text-sm font-semibold text-[var(--success)]">{sendResult}</p>
                ) : null}
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSend()}
                  className="mt-4 rounded-full bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? "送信中..." : "送信する"}
                </button>
              </div>
            )}

            {/* Recipients log */}
            {recipients.length > 0 && (
              <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5">
                <p className="text-sm font-bold text-[var(--text-primary)]">送信ログ ({recipients.length}件)</p>
                <div className="mt-3 divide-y divide-[var(--border-soft)]">
                  {recipients.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                      <span className="truncate text-[var(--text-secondary)]">{r.email}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        {r.error_msg && (
                          <span className="max-w-[160px] truncate text-[var(--danger)]" title={r.error_msg}>
                            {r.error_msg}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS_COLOR[r.status] ?? STATUS_COLOR.pending}`}>
                          {r.status}
                        </span>
                        {r.sent_at && (
                          <span className="text-[var(--text-muted)]">
                            {new Date(r.sent_at).toLocaleTimeString("ja-JP")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      <FooterNav />
    </>
  );
}
