"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import EmptyState from "@/app/components/ui/empty-state";
import SectionCard from "@/app/components/ui/section-card";
import StatusBadge from "@/app/components/ui/status-badge";
import { familyRoleTone, formatFamilyRole } from "@/app/components/ui/family-labels";

type FamilyMember = {
  family_id: string;
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  display_label: string;
};

type FamilyMembersState = {
  loading: boolean;
  error: string;
  members: FamilyMember[];
};

export default function FamilyMembersList() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [state, setState] = useState<FamilyMembersState>({
    loading: true,
    error: "",
    members: [],
  });

  useEffect(() => {
    let isActive = true;

    const loadMembers = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setCurrentUserId(null);
        setState({
          loading: false,
          error: "ログイン状態の確認に失敗しました。",
          members: [],
        });
        return;
      }

      if (!session?.user) {
        setCurrentUserId(null);
        setState({
          loading: false,
          error: "",
          members: [],
        });
        return;
      }

      setCurrentUserId(session.user.id);

      const { data, error } = await supabase.rpc(
        "list_family_members_for_current_user"
      );

      if (!isActive) {
        return;
      }

      if (error) {
        setState({
          loading: false,
          error: `家族メンバー一覧の取得に失敗しました: ${error.message}`,
          members: [],
        });
        return;
      }

      setState({
        loading: false,
        error: "",
        members: Array.isArray(data) ? (data as FamilyMember[]) : [],
      });
    };

    void loadMembers();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event) => {
      void loadMembers();
    });

    const handleFamilyUpdated = () => {
      void loadMembers();
    };

    window.addEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);
    };
  }, []);

  const guardianCount = state.members.filter((member) => member.role !== "child").length;
  const childCount = state.members.filter((member) => member.role === "child").length;

  return (
    <SectionCard
      title="家族のみんな"
      description="だれが一緒に使っているかを、ひと目で見られます。"
    >
      {state.loading ? (
        <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
      ) : state.error ? (
        <p className="text-sm text-[var(--danger)]">{state.error}</p>
      ) : state.members.length === 0 ? (
        <EmptyState
          title="まだ家族メンバーがいません"
          description="招待をつくると、ここに家族が並びます。"
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] bg-[var(--surface-accent)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">家族メンバー</p>
              <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{state.members.length}</p>
            </div>
            <div className="rounded-[24px] bg-[var(--surface-accent)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">親・祖父母</p>
              <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{guardianCount}</p>
            </div>
            <div className="rounded-[24px] bg-[var(--surface-pink)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">子供</p>
              <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{childCount}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {state.members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const memberInitial = member.display_label.slice(0, 1);

              return (
                <div
                  key={member.user_id}
                  className={`overflow-hidden rounded-[28px] border bg-[var(--surface-card-strong)] p-4 shadow-[0_14px_30px_rgba(49,76,120,0.08)] ${
                    isCurrentUser
                      ? "border-[rgba(111,149,229,0.28)]"
                      : "border-[var(--border-soft)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--surface-accent)] text-xl font-bold text-[var(--brand-primary-strong)]">
                        {memberInitial}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--text-primary)]">
                          {member.display_label}
                          {isCurrentUser ? "（あなた）" : ""}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {member.email ?? "メールアドレス未登録"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={familyRoleTone(member.role)}>
                      {formatFamilyRole(member.role)}
                    </StatusBadge>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-[rgba(111,149,229,0.14)] bg-[linear-gradient(180deg,rgba(234,242,255,0.96),rgba(253,244,223,0.92))] px-4 py-4">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">この家族での役わり</p>
                    <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">{formatFamilyRole(member.role)}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {member.role === "child"
                        ? "お金の学びをいっしょに進めるメンバーです。"
                        : "家族の準備や招待を支えるメンバーです。"}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isCurrentUser ? (
                      <span className="inline-flex rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                        利用中のアカウント
                      </span>
                    ) : null}
                    <span className="inline-flex rounded-full bg-[rgba(242,246,255,0.92)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      メンバー番号: {member.user_id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}