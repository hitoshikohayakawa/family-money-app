"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import AllowanceGrantsPanel from "@/app/components/allowance-grants-panel";
import FamilyTasksPanel from "@/app/components/family-tasks-panel";

// 親の管理画面「タスク・お小遣い」。
// 保護者には [お小遣いをあげる] / [タスクを設定する] のタブを表示し、
// それぞれ既存の AllowanceGrantsPanel / FamilyTasksPanel をそのまま再利用する
// （ロジックの重複実装はしない）。
// 子どもは従来どおりお小遣いのみを表示する（タスク設定は親の行動のため）。

type TabKey = "allowance" | "task";

export default function AllowanceTasksTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>(
    searchParams.get("tab") === "task" ? "task" : "allowance"
  );
  const [isGuardian, setIsGuardian] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { session },
      } = await getSafeSession(supabase);
      if (!session?.user) {
        if (active) setIsGuardian(false);
        return;
      }
      const { data } = await supabase
        .from("family_memberships")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!active) return;
      const role = data?.role;
      setIsGuardian(role === "guardian" || role === "guardian_admin");
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectTab = (key: TabKey) => {
    setTab(key);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (key === "task") params.set("tab", "task");
    else params.delete("tab");
    const qs = params.toString();
    router.replace(qs ? `/allowance?${qs}` : "/allowance", { scroll: false });
  };

  // 子ども or 役割未確定: 従来どおりお小遣いのみ（タブなし）
  if (!isGuardian) {
    return <AllowanceGrantsPanel />;
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "allowance", label: "お小遣いをあげる" },
    { key: "task", label: "タスクを設定する" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* タイトル + 説明 + iOS風セグメントタブ */}
      <section className="rounded-[34px] border border-[rgba(255,255,255,0.76)] bg-[var(--surface-card)] px-6 py-7 shadow-[var(--shadow-card)] backdrop-blur sm:px-8">
        <h1 className="text-[2.1rem] font-extrabold tracking-tight text-[var(--text-primary)] sm:text-[2.6rem]">
          タスク・お小遣い
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
          子どもへのお小遣いと、お手伝い・宿題などの「やること」をここで管理できます。
        </p>

        <div
          role="tablist"
          aria-label="タスク・お小遣い"
          className="mt-5 flex gap-1 rounded-full bg-[rgba(20,40,30,0.06)] p-1"
        >
          {tabs.map(({ key, label }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(key)}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition sm:text-base ${
                  selected
                    ? "bg-[var(--brand-primary)] text-white shadow-[0_8px_18px_rgba(47,127,74,0.28)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* タブ内容: 既存パネルを再利用 */}
      {tab === "allowance" ? <AllowanceGrantsPanel /> : <FamilyTasksPanel />}
    </div>
  );
}
