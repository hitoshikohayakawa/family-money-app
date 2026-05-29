"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import EmptyState from "@/app/components/ui/empty-state";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
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
  savingUserId: string | null;
  error: string;
  successMessage: string;
  members: FamilyMember[];
};

export default function FamilyMembersList() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftDisplayNames, setDraftDisplayNames] = useState<Record<string, string>>({});
  const [state, setState] = useState<FamilyMembersState>({
    loading: true,
    savingUserId: null,
    error: "",
    successMessage: "",
    members: [],
  });

  useEffect(() => {
    let isActive = true;

    const loadMembers = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await getSafeSession(supabase);

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setCurrentUserId(null);
        setCurrentUserRole(null);
        setState({
          loading: false,
          savingUserId: null,
          error: "ログイン状態の確認に失敗しました。",
          successMessage: "",
          members: [],
        });
        return;
      }

      if (!session?.user) {
        setCurrentUserId(null);
        setCurrentUserRole(null);
        setState({
          loading: false,
          savingUserId: null,
          error: "",
          successMessage: "",
          members: [],
        });
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: membership } = await supabase
        .from("family_memberships")
        .select("role")
        .eq("status", "active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      setCurrentUserRole(typeof membership?.role === "string" ? membership.role : null);

      const { data, error } = await supabase.rpc(
        "list_family_members_for_current_user"
      );

      if (!isActive) {
        return;
      }

      if (error) {
        setState({
          loading: false,
          savingUserId: null,
          error: `家族メンバー一覧の取得に失敗しました: ${error.message}`,
          successMessage: "",
          members: [],
        });
        return;
      }

      const members = Array.isArray(data) ? (data as FamilyMember[]) : [];

      setDraftDisplayNames((currentValue) => {
        const nextValue = { ...currentValue };

        for (const member of members) {
          nextValue[member.user_id] = member.display_name ?? "";
        }

        return nextValue;
      });

      setState({
        loading: false,
        savingUserId: null,
        error: "",
        successMessage: "",
        members,
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
  const canEditChildNames =
    currentUserRole === "guardian_admin" || currentUserRole === "guardian";

  const handleSaveDisplayName = async (
    event: FormEvent<HTMLFormElement>,
    member: FamilyMember
  ) => {
    event.preventDefault();

    const draftDisplayName = draftDisplayNames[member.user_id] ?? "";
    const {
      data: { session },
      error: sessionError,
    } = await getSafeSession(supabase);

    if (sessionError || !session?.access_token) {
      setState((currentState) => ({
        ...currentState,
        error: "ログイン状態の確認に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      savingUserId: member.user_id,
      error: "",
      successMessage: "",
    }));

    let response: Response;

    try {
      response = await fetch(`/api/family-members/${member.user_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          displayName: draftDisplayName,
        }),
      });
    } catch {
      setState((currentState) => ({
        ...currentState,
        savingUserId: null,
        error: "表示名の保存に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      setState((currentState) => ({
        ...currentState,
        savingUserId: null,
        error: result?.error ?? "表示名の保存に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    const { data, error } = await supabase.rpc("list_family_members_for_current_user");

    if (error) {
      setState((currentState) => ({
        ...currentState,
        savingUserId: null,
        error: `表示名は保存されましたが再取得に失敗しました: ${error.message}`,
        successMessage:
          member.role === "child"
            ? "子どもの呼び名を保存しました。"
            : "表示名を保存しました。",
      }));
      return;
    }

    const members = Array.isArray(data) ? (data as FamilyMember[]) : [];

    setState((currentState) => ({
      ...currentState,
      savingUserId: null,
      error: "",
      successMessage:
        member.role === "child" ? "子どもの呼び名を保存しました。" : "表示名を保存しました。",
      members,
    }));
    setEditingUserId(null);
    window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
  };

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
          {state.successMessage ? (
            <p className="text-sm text-[var(--success)]">{state.successMessage}</p>
          ) : null}

          {state.error ? (
            <p className="text-sm text-[var(--danger)]">{state.error}</p>
          ) : null}

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
              const canEditMember = isCurrentUser || (canEditChildNames && member.role === "child");
              const isEditing = editingUserId === member.user_id;

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
                        {member.display_name ? (
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {member.email ?? "メールアドレス未登録"}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {member.email ?? "メールアドレス未登録"}
                          </p>
                        )}
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

                  {canEditMember ? (
                    <div className="mt-4 rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {member.role === "child"
                              ? "この子の表示名"
                              : isCurrentUser
                                ? "あなたの表示名"
                                : "表示名"}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {member.role === "child"
                              ? "ホーム画面やお小遣い一覧では、この呼び名を優先して使います。"
                              : "家族の中で見やすい呼び名を登録できます。"}
                          </p>
                        </div>
                        {!isEditing ? (
                          <SecondaryButton
                            type="button"
                            size="sm"
                            onClick={() => {
                              setEditingUserId(member.user_id);
                              setDraftDisplayNames((currentValue) => ({
                                ...currentValue,
                                [member.user_id]: member.display_name ?? "",
                              }));
                            }}
                          >
                            {member.role === "child" ? "名前を編集" : "表示名を編集"}
                          </SecondaryButton>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <form className="mt-4 space-y-3" onSubmit={(event) => handleSaveDisplayName(event, member)}>
                          <label className="flex flex-col gap-2 text-sm font-bold text-[var(--text-primary)]">
                            <span>{member.role === "child" ? "呼び名" : "表示名"}</span>
                            <input
                              className="min-h-12 rounded-[18px] border border-[var(--border-soft)] bg-white px-4 py-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                              value={draftDisplayNames[member.user_id] ?? ""}
                              onChange={(event) =>
                                setDraftDisplayNames((currentValue) => ({
                                  ...currentValue,
                                  [member.user_id]: event.target.value,
                                }))
                              }
                              placeholder={member.role === "child" ? "例: なぎ" : "例: ママ"}
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <PrimaryButton
                              type="submit"
                              size="sm"
                              fullWidth={false}
                              disabled={state.savingUserId === member.user_id}
                            >
                              {state.savingUserId === member.user_id ? "保存中..." : "保存する"}
                            </PrimaryButton>
                            <SecondaryButton
                              type="button"
                              size="sm"
                              onClick={() => setEditingUserId(null)}
                              disabled={state.savingUserId === member.user_id}
                            >
                              キャンセル
                            </SecondaryButton>
                          </div>
                        </form>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--text-secondary)]">
                          いまの表示:{" "}
                          <span className="font-bold text-[var(--text-primary)]">
                            {member.display_name || "未設定"}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
