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
    } = supabase.auth.onAuthStateChange(() => {
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

  const guardianAdminCount = state.members.filter(
    (member) => member.role === "guardian_admin"
  ).length;
  const guardianCount = state.members.filter(
    (member) => member.role === "guardian"
  ).length;
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] bg-[var(--surface-accent)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">家族メンバー</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{state.members.length}</p>
            </div>
            <div className="rounded-[22px] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">家族管理者</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{guardianAdminCount}</p>
            </div>
            <div className="rounded-[22px] bg-[rgba(243,251,244,0.92)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">親・祖父母</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{guardianCount}</p>
            </div>
            <div className="rounded-[22px] bg-[var(--surface-pink)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">子供</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{childCount}</p>
            </div>
          </div>

          <div className="grid gap-3">
            {state.members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const memberInitial = member.display_label.slice(0, 1);

              return (
                <div
                  key={member.user_id}
                  className={`overflow-hidden rounded-[26px] border bg-[var(--surface-card-strong)] p-4 shadow-[0_10px_22px_rgba(51,101,63,0.08)] ${
                    isCurrentUser
                      ? "border-[rgba(76,163,104,0.28)]"
                      : "border-[var(--border-soft)]"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--surface-accent)] text-lg font-bold text-[var(--brand-primary-strong)]">
                        {memberInitial}
                      </div>
                      <div>
                        <p className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
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

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                    <div className="rounded-[20px] border border-[rgba(76,163,104,0.14)] bg-[linear-gradient(180deg,rgba(230,245,233,0.96),rgba(253,244,223,0.92))] px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">この家族での役わり</p>
                      <p className="mt-1 text-base font-bold text-[var(--text-primary)]">{formatFamilyRole(member.role)}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {member.role === "child"
                        ? "お金の学びをいっしょに進めるメンバーです。"
                        : "家族の準備や招待を支えるメンバーです。"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:max-w-[220px] md:justify-end">
                      {isCurrentUser ? (
                        <span className="inline-flex rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                          利用中のアカウント
                        </span>
                      ) : null}
                      <span className="inline-flex rounded-full bg-[rgba(243,251,244,0.92)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                        メンバー番号: {member.user_id.slice(0, 8)}
                      </span>
                    </div>
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
