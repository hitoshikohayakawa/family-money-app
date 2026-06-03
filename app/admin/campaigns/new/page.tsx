"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/app/components/admin-guard";
import AppHeader from "@/app/components/app-header";
import FooterNav from "@/app/components/ui/footer-nav";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

const TARGET_OPTIONS = [
  { value: "all",      label: "全員" },
  { value: "guardian", label: "親（guardian_admin / guardian）" },
  { value: "child",    label: "子ども" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { data: { session } } = await getSafeSession(supabase);
    if (!session?.access_token) { setError("ログインが必要です"); setSaving(false); return; }

    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subject, body_text: bodyText, target_role: targetRole }),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? "作成に失敗しました");
      setSaving(false);
      return;
    }
    const json = (await res.json()) as { campaign: { id: string } };
    router.push(`/admin/campaigns/${json.campaign.id}`);
  };

  return (
    <>
      <AdminGuard />
      <AppHeader />
      <div className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">新規キャンペーン</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          件名・本文を入力して下書き保存します。送信は詳細画面から行います。
        </p>

        <form className="mt-6 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--text-primary)]">件名</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="例: ファミマネ アップデートのお知らせ"
                className="rounded-[16px] border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--text-primary)]">本文</span>
              <p className="text-xs text-[var(--text-muted)]">
                フッター（サービス情報・配信停止リンク）は自動で追加されます。
              </p>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                required
                rows={10}
                placeholder={"いつもファミマネをご利用いただきありがとうございます。\n\n今回のアップデートでは..."}
                className="rounded-[16px] border border-[var(--border-soft)] bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5">
            <p className="text-sm font-bold text-[var(--text-primary)]">送信対象</p>
            <div className="mt-3 grid gap-2">
              {TARGET_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="target_role"
                    value={opt.value}
                    checked={targetRole === opt.value}
                    onChange={() => setTargetRole(opt.value)}
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error ? (
            <p className="rounded-[16px] bg-[rgba(255,242,238,0.92)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={saving || !subject.trim() || !bodyText.trim()}
            className="w-full rounded-full bg-[var(--brand-primary)] py-3.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "保存中..." : "下書き保存する"}
          </button>
        </form>
      </div>
      <FooterNav />
    </>
  );
}
