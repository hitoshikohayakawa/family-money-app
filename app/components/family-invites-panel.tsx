"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import EmptyState from "@/app/components/ui/empty-state";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import SectionCard from "@/app/components/ui/section-card";
import SelectInput from "@/app/components/ui/select-input";
import StatusBadge from "@/app/components/ui/status-badge";
import TextInput from "@/app/components/ui/text-input";
import {
  formatFamilyRole,
  formatInviteFilter,
  formatInviteStatus,
  inviteStatusTone,
} from "@/app/components/ui/family-labels";

type FamilyMembership = {
  family_id: string;
  role: string;
};

type FamilyInvite = {
  id: string;
  email: string;
  role: "guardian" | "child";
  stored_status: string;
  effective_status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
};

type CreatedInviteResponse = {
  invite?: {
    id: string;
    email: string;
    role: "guardian" | "child";
    expires_at: string;
  };
  initialPassword?: string;
  error?: string;
};

async function fetchFamilyInvites() {
  const { data, error } = await supabase.rpc("list_family_invites_for_current_user");

  return {
    data: Array.isArray(data) ? (data as FamilyInvite[]) : [],
    error,
  };
}

type InviteFilter = "all" | "pending" | "accepted" | "revoked" | "expired";

type FamilyInvitesState = {
  loading: boolean;
  submitting: boolean;
  revokingInviteId: string | null;
  error: string;
  successMessage: string;
  copiedInviteId: string | null;
  copiedShareTextInviteId: string | null;
  initialPasswordsByInviteId: Record<string, string>;
  membership: FamilyMembership | null;
  invites: FamilyInvite[];
};

export default function FamilyInvitesPanel() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<"guardian" | "child">("guardian");
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>("all");
  const [state, setState] = useState<FamilyInvitesState>({
    loading: true,
    submitting: false,
    revokingInviteId: null,
    error: "",
    successMessage: "",
    copiedInviteId: null,
    copiedShareTextInviteId: null,
    initialPasswordsByInviteId: {},
    membership: null,
    invites: [],
  });

  useEffect(() => {
    let isActive = true;

    const loadInvites = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setState({
          loading: false,
          submitting: false,
          revokingInviteId: null,
          error: "ログイン状態の確認に失敗しました。",
          successMessage: "",
          copiedInviteId: null,
          copiedShareTextInviteId: null,
          initialPasswordsByInviteId: {},
          membership: null,
          invites: [],
        });
        return;
      }

      if (!session?.user) {
        setState({
          loading: false,
          submitting: false,
          revokingInviteId: null,
          error: "",
          successMessage: "",
          copiedInviteId: null,
          copiedShareTextInviteId: null,
          initialPasswordsByInviteId: {},
          membership: null,
          invites: [],
        });
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("family_memberships")
        .select("family_id, role")
        .eq("status", "active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (membershipError) {
        setState({
          loading: false,
          submitting: false,
          revokingInviteId: null,
          error: `招待情報の準備に失敗しました: ${membershipError.message}`,
          successMessage: "",
          copiedInviteId: null,
          copiedShareTextInviteId: null,
          initialPasswordsByInviteId: {},
          membership: null,
          invites: [],
        });
        return;
      }

      if (!membership) {
        setState({
          loading: false,
          submitting: false,
          revokingInviteId: null,
          error: "",
          successMessage: "",
          copiedInviteId: null,
          copiedShareTextInviteId: null,
          initialPasswordsByInviteId: {},
          membership: null,
          invites: [],
        });
        return;
      }

      const { data: invites, error: invitesError } = await fetchFamilyInvites();

      if (!isActive) {
        return;
      }

      if (invitesError) {
        setState({
          loading: false,
          submitting: false,
          revokingInviteId: null,
          error: `招待一覧の取得に失敗しました: ${invitesError.message}`,
          successMessage: "",
          copiedInviteId: null,
          copiedShareTextInviteId: null,
          initialPasswordsByInviteId: {},
          membership,
          invites: [],
        });
        return;
      }

      setState((currentState) => ({
        ...currentState,
        loading: false,
        membership,
        invites: Array.isArray(invites) ? (invites as FamilyInvite[]) : [],
        error: "",
        revokingInviteId: currentState.revokingInviteId,
        copiedInviteId: currentState.copiedInviteId,
        copiedShareTextInviteId: currentState.copiedShareTextInviteId,
      }));
    };

    void loadInvites();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadInvites();
    });

    const handleFamilyUpdated = () => {
      void loadInvites();
    };

    window.addEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!state.membership) {
      setState((currentState) => ({
        ...currentState,
        error: "招待を作成するには先に家族へ所属してください。",
        successMessage: "",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      submitting: true,
      revokingInviteId: null,
      error: "",
      successMessage: "",
    }));

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        revokingInviteId: null,
        error: "ログイン状態の確認に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    let response: Response;

    try {
      response = await fetch("/api/family-invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          familyId: state.membership.family_id,
          email: normalizedEmail,
          displayName: inviteDisplayName.trim(),
          role: inviteRole,
        }),
      });
    } catch {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        revokingInviteId: null,
        error: "招待作成APIへの接続に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    const result = (await response.json().catch(() => null)) as CreatedInviteResponse | null;

    if (!response.ok || !result?.invite || !result.initialPassword) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        revokingInviteId: null,
        error: `招待の作成に失敗しました: ${
          result?.error ?? "サーバーから正しい応答を受け取れませんでした。"
        }`,
        successMessage: "",
      }));
      return;
    }

    const createdInvite = result.invite;
    const initialPassword = result.initialPassword;
    const { data: invites, error: invitesError } = await fetchFamilyInvites();

    setInviteEmail("");
    setInviteDisplayName("");

    if (invitesError) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        revokingInviteId: null,
        error: `招待は作成されましたが一覧の再取得に失敗しました: ${invitesError.message}`,
        successMessage: "招待を作成しました。共有文に初期パスワードを含めて送れます。",
        initialPasswordsByInviteId: {
          ...currentState.initialPasswordsByInviteId,
          [createdInvite.id]: initialPassword,
        },
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      submitting: false,
      revokingInviteId: null,
      error: "",
      successMessage: "招待を作成しました。共有文に初期パスワードを含めて送れます。",
      initialPasswordsByInviteId: {
        ...currentState.initialPasswordsByInviteId,
        [createdInvite.id]: initialPassword,
      },
      invites: Array.isArray(invites) ? (invites as FamilyInvite[]) : [],
    }));
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setState((currentState) => ({
      ...currentState,
      revokingInviteId: inviteId,
      error: "",
      successMessage: "",
    }));

    const { error } = await supabase.rpc("revoke_family_invite", {
      target_invite_id: inviteId,
    });

    if (error) {
      setState((currentState) => ({
        ...currentState,
        revokingInviteId: null,
        error: `招待の revoke に失敗しました: ${error.message}`,
      }));
      return;
    }

    if (!state.membership) {
      setState((currentState) => ({
        ...currentState,
        revokingInviteId: null,
        successMessage: "招待を revoke しました。",
      }));
      return;
    }

    const { data: invites, error: invitesError } = await fetchFamilyInvites();

    if (invitesError) {
      setState((currentState) => ({
        ...currentState,
        revokingInviteId: null,
        error: `招待は revoke されましたが一覧の再取得に失敗しました: ${invitesError.message}`,
        successMessage: "招待を revoke しました。",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      revokingInviteId: null,
      error: "",
      successMessage: "招待を revoke しました。",
      invites: Array.isArray(invites) ? (invites as FamilyInvite[]) : [],
    }));
  };

  const handleCopyInviteLink = async (inviteId: string) => {
    const inviteUrl = `${window.location.origin}/invites/${inviteId}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setState((currentState) => ({
        ...currentState,
        copiedInviteId: inviteId,
        copiedShareTextInviteId: null,
        error: "",
      }));

      window.setTimeout(() => {
        setState((currentState) =>
          currentState.copiedInviteId === inviteId
            ? { ...currentState, copiedInviteId: null }
            : currentState
        );
      }, 2000);
    } catch {
      setState((currentState) => ({
        ...currentState,
        error: "招待リンクのコピーに失敗しました。",
      }));
    }
  };

  const handleCopyShareText = async (inviteId: string) => {
    const inviteUrl = `${window.location.origin}/invites/${inviteId}`;
    const invite = state.invites.find((candidate) => candidate.id === inviteId);
    const initialPassword = state.initialPasswordsByInviteId[inviteId];
    const shareText = initialPassword
      ? [
          "家族マネーアプリ「ファミマネ」への招待です。",
          "",
          `ログインメール: ${invite?.email ?? ""}`,
          `初期パスワード: ${initialPassword}`,
          `招待リンク: ${inviteUrl}`,
          "",
          "初回ログイン後に新しいパスワードを設定してください。",
        ].join("\n")
      : [
          "家族マネーアプリ「ファミマネ」への招待です。",
          "以下のリンクを開いて参加してください。",
          inviteUrl,
          "",
          "初期パスワードが必要な場合は、招待を作成した人に確認してください。",
        ].join("\n");

    try {
      await navigator.clipboard.writeText(shareText);
      setState((currentState) => ({
        ...currentState,
        copiedInviteId: null,
        copiedShareTextInviteId: inviteId,
        error: "",
      }));

      window.setTimeout(() => {
        setState((currentState) =>
          currentState.copiedShareTextInviteId === inviteId
            ? { ...currentState, copiedShareTextInviteId: null }
            : currentState
        );
      }, 2000);
    } catch {
      setState((currentState) => ({
        ...currentState,
        error: "共有用テキストのコピーに失敗しました。",
      }));
    }
  };

  const filteredInvites = state.invites.filter((invite) => {
    if (inviteFilter === "all") {
      return true;
    }

    return invite.effective_status === inviteFilter;
  });

  const pendingCount = state.invites.filter((invite) => invite.effective_status === "pending").length;
  const acceptedCount = state.invites.filter((invite) => invite.effective_status === "accepted").length;

  if (!state.loading && state.membership?.role !== "guardian_admin") {
    return null;
  }

  return (
    <SectionCard
      title="家族への招待"
      description="招待をつくると、家族が自分のペースで参加できます。"
    >
      {state.loading ? (
        <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
      ) : !state.membership ? (
        <EmptyState
          title="まだ招待できません"
          description="先に家族へ入ると、ここから招待できます。"
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr] xl:items-start">
          <div className="space-y-4">
            {state.membership.role === "guardian_admin" ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
                <div className="rounded-[24px] border border-[rgba(76,163,104,0.14)] bg-[linear-gradient(180deg,rgba(230,245,233,0.98),rgba(255,255,255,0.95))] px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">招待を出せる人</p>
                      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatFamilyRole(state.membership.role)}</p>
                    </div>
                    <StatusBadge tone="info">家族管理者</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    招待はリンクで送れます。家族が自分のタイミングで参加できます。
                  </p>
                </div>

                <TextInput
                  label="招待するメールアドレス"
                  hint="あとで受け取りやすいメールアドレスを入れましょう。"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="例: family@example.com"
                  required
                />

                <TextInput
                  label={inviteRole === "child" ? "子どもの呼び名" : "表示名"}
                  hint={
                    inviteRole === "child"
                      ? "例: なぎ、そうた。画面ではこの名前を優先して表示します。"
                      : "例: パパ、ママ、おばあちゃん。"
                  }
                  type="text"
                  value={inviteDisplayName}
                  onChange={(event) => setInviteDisplayName(event.target.value)}
                  placeholder={inviteRole === "child" ? "例: なぎ" : "例: パパ"}
                />

                <SelectInput
                  label="招待する相手"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as "guardian" | "child")
                  }
                >
                  <option value="guardian">親・祖父母</option>
                  <option value="child">子供</option>
                </SelectInput>

                <PrimaryButton
                  type="submit"
                  disabled={state.submitting || inviteEmail.trim().length === 0}
                >
                  {state.submitting ? "招待を作成しています..." : "招待を作成する"}
                </PrimaryButton>
              </form>
            ) : (
              <EmptyState
                title="いまは招待を作れません"
                description="招待を作れるのは家族管理者だけです。"
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">承認待ちの招待</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{pendingCount}</p>
              </div>
              <div className="rounded-[20px] bg-[var(--surface-accent)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">参加済みの招待</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{acceptedCount}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">招待一覧</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  承認待ちの招待を上にまとめて、いま動かしたい招待を見つけやすくしています。
                </p>
              </div>
              <div className="rounded-[20px] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">いまの招待</p>
                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{filteredInvites.length}件</p>
              </div>
            </div>

            {state.successMessage ? (
              <p className="text-sm text-[var(--success)]">{state.successMessage}</p>
            ) : null}

            {state.error ? (
              <p className="text-sm text-[var(--danger)]">{state.error}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "accepted", "revoked", "expired"] as InviteFilter[]).map(
                (filterValue) => (
                  <SecondaryButton
                    key={filterValue}
                    type="button"
                    onClick={() => setInviteFilter(filterValue)}
                    size="sm"
                    className={
                      inviteFilter === filterValue
                        ? "border-[var(--brand-primary)] bg-[var(--surface-accent)] text-[var(--brand-primary-strong)]"
                        : ""
                    }
                  >
                    {formatInviteFilter(filterValue)}
                  </SecondaryButton>
                )
              )}
            </div>

            {filteredInvites.length === 0 ? (
              <EmptyState
                title="まだ招待がありません"
                description="招待をつくると、ここに並びます。"
              />
            ) : (
              <div className="grid gap-4">
                {filteredInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,255,0.96))]"
                  >
                    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
                            {invite.email}
                          </p>
                          <StatusBadge tone={inviteStatusTone(invite.effective_status)}>
                            {formatInviteStatus(invite.effective_status)}
                          </StatusBadge>
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          招待する相手: {formatFamilyRole(invite.role)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--surface-accent)] px-3 py-2.5 lg:min-w-[180px]">
                        <p className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">有効期限</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                          {new Date(invite.expires_at).toLocaleString("ja-JP")}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-[rgba(84,130,95,0.12)] bg-[rgba(243,251,244,0.54)] px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-xs text-[var(--text-muted)]">
                          作成日: {new Date(invite.created_at).toLocaleString("ja-JP")}
                        </p>
                        {invite.effective_status === "pending" ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-[var(--brand-primary-strong)]">
                              招待リンクを表示
                            </summary>
                            <div className="mt-2 text-sm text-[var(--text-secondary)] break-all">
                              <Link
                                href={`/invites/${invite.id}`}
                                className="font-semibold text-[var(--brand-primary-strong)] underline underline-offset-2"
                              >
                                /invites/{invite.id}
                              </Link>
                            </div>
                          </details>
                        ) : null}
                      </div>

                      {invite.effective_status === "pending" ? (
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <SecondaryButton
                            type="button"
                            size="sm"
                            onClick={() => handleCopyInviteLink(invite.id)}
                          >
                            リンクをコピー
                          </SecondaryButton>
                          <SecondaryButton
                            type="button"
                            size="sm"
                            onClick={() => handleCopyShareText(invite.id)}
                          >
                            共有文をコピー
                          </SecondaryButton>
                          {state.membership?.role === "guardian_admin" ? (
                            <SecondaryButton
                              type="button"
                              size="sm"
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={state.revokingInviteId === invite.id}
                              className="border-[rgba(239,172,192,0.32)] text-[var(--danger)] hover:bg-[var(--surface-pink)]"
                            >
                              {state.revokingInviteId === invite.id
                                ? "取り消し中..."
                                : "招待を取り消す"}
                            </SecondaryButton>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {(state.copiedInviteId === invite.id ||
                      state.copiedShareTextInviteId === invite.id) ? (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-[var(--success)]">
                          {state.copiedInviteId === invite.id
                            ? "リンクをコピーしました。"
                            : "共有文をコピーしました。"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
