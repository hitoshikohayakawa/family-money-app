"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import EmptyState from "@/app/components/ui/empty-state";
import PageContainer from "@/app/components/ui/page-container";
import PrimaryButton from "@/app/components/ui/primary-button";
import SectionCard from "@/app/components/ui/section-card";
import StatusBadge from "@/app/components/ui/status-badge";
import { formatFamilyRole, formatInviteStatus, inviteStatusTone } from "@/app/components/ui/family-labels";
import { LegalLoginNotice } from "@/app/components/ui/legal-links";

type InviteDetails = {
  invite_id: string;
  email: string;
  role: string;
  stored_status: string;
  effective_status: string;
  expires_at: string;
  membership_exists: boolean;
  is_expired: boolean;
};

type InvitePageState = {
  loading: boolean;
  accepting: boolean;
  error: string;
  successMessage: string;
  email: string | null;
  inviteDetails: InviteDetails | null;
};

export default function InviteAcceptPage() {
  const params = useParams<{ inviteId: string }>();
  const inviteId = params.inviteId;
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [state, setState] = useState<InvitePageState>({
    loading: true,
    accepting: false,
    error: "",
    successMessage: "",
    email: null,
    inviteDetails: null,
  });

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      const [{ data: sessionData, error }, { data: inviteData, error: inviteError }] =
        await Promise.all([
          getSafeSession(supabase),
          supabase.rpc("get_family_invite_details", {
            target_invite_id: inviteId,
          }),
        ]);

      if (!isActive) {
        return;
      }

      if (error) {
        setState({
          loading: false,
          accepting: false,
          error: "ログイン状態の確認に失敗しました。",
          successMessage: "",
          email: null,
          inviteDetails: null,
        });
        return;
      }

      if (inviteError) {
        setState({
          loading: false,
          accepting: false,
          error: `招待情報の取得に失敗しました: ${inviteError.message}`,
          successMessage: "",
          email: sessionData.session?.user?.email ?? null,
          inviteDetails: null,
        });
        return;
      }

      const inviteDetails = Array.isArray(inviteData) ? (inviteData[0] as InviteDetails | undefined) : undefined;

      setState({
        loading: false,
        accepting: false,
        error: "",
        successMessage: "",
        email: sessionData.session?.user?.email ?? null,
        inviteDetails: inviteDetails ?? null,
      });
    };

    void loadSession();

    return () => {
      isActive = false;
    };
  }, [inviteId]);

  const handleSetupPassword = async () => {
    if (!state.inviteDetails?.email) return;
    setSendingPasswordReset(true);
    const redirectTo =
      `${window.location.origin}/setup-password` +
      `?next=${encodeURIComponent(`/invites/${inviteId}`)}` +
      `&mode=reset`;
    await supabase.auth.resetPasswordForEmail(state.inviteDetails.email, { redirectTo });
    setSendingPasswordReset(false);
    setPasswordResetSent(true);
  };

  const handleAcceptInvite = async () => {
    setState((currentState) => ({
      ...currentState,
      accepting: true,
      error: "",
      successMessage: "",
    }));

    const { data, error } = await supabase.rpc("accept_family_invite", {
      invite_id: inviteId,
    });

    if (error) {
      setState((currentState) => ({
        ...currentState,
        accepting: false,
        error: `招待の受諾に失敗しました: ${error.message}`,
      }));
      return;
    }

    const result = Array.isArray(data) ? data[0] : null;

    if (!result || result.status !== "accepted") {
      setState((currentState) => ({
        ...currentState,
        accepting: false,
        error: "招待の受諾結果を確認できませんでした。もう一度お試しください。",
      }));
      return;
    }

    const { data: refreshedInviteData, error: refreshedInviteError } = await supabase.rpc(
      "get_family_invite_details",
      {
        target_invite_id: inviteId,
      }
    );

    if (refreshedInviteError) {
      setState((currentState) => ({
        ...currentState,
        accepting: false,
        error: `招待は受け付けましたが確認に失敗しました: ${refreshedInviteError.message}`,
      }));
      return;
    }

    const refreshedInviteDetails = Array.isArray(refreshedInviteData)
      ? (refreshedInviteData[0] as InviteDetails | undefined)
      : undefined;

    setState((currentState) => ({
      ...currentState,
      accepting: false,
      error: "",
      successMessage: result
        ? `招待を受け取りました。役わり: ${formatFamilyRole(result.role)}`
        : "招待を受諾しました。",
      inviteDetails: refreshedInviteDetails ?? currentState.inviteDetails,
    }));

    window.setTimeout(() => {
      window.location.assign("/");
    }, 1200);
  };

  return (
    <PageContainer
      badge="参加はあと一歩"
      title="家族への参加"
      description="だれ向けの招待かを確認してから、安心して参加できます。"
    >
      <SectionCard
        title="招待の確認"
        description="内容が合っていれば、そのまま参加しましょう。"
        className="mx-auto w-full max-w-2xl"
        tone="playful"
      >
        {state.loading ? (
          <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
        ) : (
          <>
            {state.inviteDetails ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-card-strong)] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">参加するメールアドレス</p>
                  <p className="mt-2 break-all text-base font-semibold text-[var(--text-primary)]">
                    {state.inviteDetails.email}
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-accent)] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">参加する役わり</p>
                  <div className="mt-2">
                    <StatusBadge tone="info">
                      {formatFamilyRole(state.inviteDetails.role)}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-card-strong)] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">いまの状態</p>
                  <div className="mt-2">
                    <StatusBadge tone={inviteStatusTone(state.inviteDetails.effective_status)}>
                      {formatInviteStatus(state.inviteDetails.effective_status)}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-soft)] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">有効期限</p>
                  <p className="mt-2 text-sm text-[var(--text-primary)]">
                    {new Date(state.inviteDetails.expires_at).toLocaleString("ja-JP")}
                  </p>
                </div>
                {state.inviteDetails.is_expired ? (
                  <div className="sm:col-span-2">
                    <StatusBadge tone="danger">この招待は期限切れです</StatusBadge>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="招待が見つかりません"
                description="リンクが正しいか、もう一度確認してください。"
              />
            )}

            {state.email && state.inviteDetails && state.email !== state.inviteDetails.email ? (
              <p className="mt-4 text-sm text-[var(--danger)]">
                ログイン中のメールアドレス（{state.email}）と招待先が異なります。招待先のメールアドレスでログインし直してください。
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              {state.email ? (
                <PrimaryButton
                  onClick={handleAcceptInvite}
                  disabled={
                    state.accepting ||
                    !state.inviteDetails ||
                    state.inviteDetails.is_expired ||
                    state.inviteDetails.effective_status !== "pending" ||
                    state.email !== state.inviteDetails.email
                  }
                >
                  {state.accepting ? "参加中..." : "この招待で参加する"}
                </PrimaryButton>
              ) : passwordResetSent ? (
                <p className="text-sm leading-7 text-[var(--text-secondary)]">
                  パスワード設定用のメールをお送りしました。メール内のリンクからパスワードを設定してください。
                </p>
              ) : (
                <>
                  <PrimaryButton
                    onClick={handleSetupPassword}
                    disabled={
                      sendingPasswordReset ||
                      !state.inviteDetails ||
                      state.inviteDetails.is_expired ||
                      state.inviteDetails.effective_status !== "pending"
                    }
                  >
                    {sendingPasswordReset ? "送信中..." : "パスワードを設定する"}
                  </PrimaryButton>
                  <LegalLoginNotice
                    className="text-sm leading-7 text-[var(--text-secondary)]"
                    linkClassName="underline underline-offset-4"
                    suffix="に同意の上登録を実施してください。"
                  />
                </>
              )}
            </div>

            {state.successMessage ? (
              <p className="mt-4 text-sm text-[var(--success)]">{state.successMessage}</p>
            ) : null}

            {state.error ? (
              <p className="mt-4 text-sm text-[var(--danger)]">{state.error}</p>
            ) : null}
          </>
        )}
      </SectionCard>
    </PageContainer>
  );
}
