"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin-guard";
import AppHeader from "@/app/components/app-header";
import FooterNav from "@/app/components/ui/footer-nav";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

type Campaign = {
  id: string;
  subject: string;
  target_role: string;
  status: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  sent_at: string | null;
  created_at: string;
};

const TARGET_LABEL: Record<string, string> = {
  all: "全員",
  guardian: "親",
  child: "子ども",
};
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:   { label: "下書き", color: "bg-gray-100 text-gray-600" },
  sending: { label: "送信中", color: "bg-yellow-100 text-yellow-700" },
  done:    { label: "送信済み", color: "bg-green-100 text-green-700" },
  failed:  { label: "失敗", color: "bg-red-100 text-red-600" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await getSafeSession(supabase);
      if (!session?.access_token) { setLoading(false); return; }
      const res = await fetch("/api/admin/campaigns", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setError("取得に失敗しました"); setLoading(false); return; }
      const json = (await res.json()) as { campaigns: Campaign[] };
      setCampaigns(json.campaigns ?? []);
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <>
      <AdminGuard />
      <AppHeader />
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">メール配信管理</h1>
          <Link
            href="/admin/campaigns/new"
            className="rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90"
          >
            ＋ 新規作成
          </Link>
        </div>

        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">読み込み中...</p>
          ) : error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : campaigns.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-soft)] py-12 text-center">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">キャンペーンがありません</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">「＋ 新規作成」からアップデートメールを作成してください</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {campaigns.map((c) => {
                const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;
                return (
                  <Link
                    key={c.id}
                    href={`/admin/campaigns/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] px-5 py-4 shadow-sm transition hover:bg-[var(--surface-accent)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">{c.subject}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {TARGET_LABEL[c.target_role] ?? c.target_role} ·{" "}
                        {c.sent_at
                          ? new Date(c.sent_at).toLocaleString("ja-JP")
                          : new Date(c.created_at).toLocaleString("ja-JP")}
                        {c.status === "done" ? ` · 成功${c.success_count}件` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${s.color}`}>
                      {s.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <FooterNav />
    </>
  );
}
