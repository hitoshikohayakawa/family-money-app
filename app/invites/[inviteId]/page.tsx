"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import EmptyState from "@/app/components/ui/empty-state";
import PageContainer from "@/app/components/ui/page-container";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import SectionCard from "@/app/components/ui/section-card";
import StatusBadge from "@/app/components/ui/status-badge";
import { formatFamilyRole, formatInviteStatus, inviteStatusTone } from "@/app/components/ui/family-labels";

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
  const router = useRouter();
  const inviteId = params.inviteId;
  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(`/invites/${inviteId}`)}`,
    [inviteId]
  );
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
          supabase.auth.getSession(),
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
        error: sessionData.session?.user
          ? ""
          : "招待を受け取るには先にログインしてください。",
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

  const loginHrefWithInviteEmail = state.inviteDetails?.email
    ? `${loginHref}&email=${encodeURIComponent(state.inviteDetails.email)}`
    : loginHref;

  const handleAcceptInvite = async () => {
    if (!state.email) {
      router.push(loginHrefWithInviteEmail);
      return;
    }

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
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">招待先メール</p>
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
                <div className="sm:col-span-2">
                  <StatusBadge tone={state.inviteDetails.is_expired ? "danger" : "success"}>
                    {state.inviteDetails.is_expired ? "この招待は期限切れです" : "この招待はまだ使えます"}
                  </StatusBadge>
                </div>
              </div>
            ) : (
              <EmptyState
                title="招待が見つかりません"
                description="リンクが正しいか、もう一度確認してください。"
              />
            )}

            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              現在のログインメール: {state.email ?? "未ログイン"}
            </p>

            {state.email && state.inviteDetails && state.email !== state.inviteDetails.email ? (
              <p className="mt-3 text-sm text-[var(--danger)]">
                いまのメールアドレスでは参加できません。招待先のメールでログインしてください。
              </p>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                招待を受け取ったメールアドレスでログインしているか確認しましょう。
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <PrimaryButton
                onClick={handleAcceptInvite}
                disabled={
                  state.accepting ||
                  !state.inviteDetails ||
                  state.inviteDetails.is_expired ||
                  state.inviteDetails.effective_status !== "pending" ||
                  Boolean(state.email && state.email !== state.inviteDetails.email)
                }
              >
                {state.accepting
                  ? "参加中..."
                  : state.email
                    ? "この招待で参加する"
                    : "ログインしてこの招待で参加する"}
              </PrimaryButton>

              {!state.email ? (
                <Link
                  href={loginHrefWithInviteEmail}
                  className="inline-flex"
                >
                  <SecondaryButton>ログインページへ</SecondaryButton>
                </Link>
              ) : null}
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
