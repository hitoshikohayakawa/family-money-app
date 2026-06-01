"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import MemberAvatar from "@/app/components/ui/member-avatar";
import StatusBadge from "@/app/components/ui/status-badge";
import {
  formatFamilyRoleShort,
  familyRoleShortTone,
} from "@/app/components/ui/family-labels";

// ─── Types ───────────────────────────────────────────────────────────────────

type FamilyMember = {
  family_id: string;
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  display_label: string;
  avatar_path: string | null;
  avatar_emoji: string | null;
};

type GrantRow = {
  id: string;
  child_user_id: string;
  granted_by_user_id: string;
  amount_jpy: number;
  decision_status: string;
  current_value_jpy: number | null;
  unrealized_gain_jpy: number | null;
  cashout_status: string | null;
  cashout_requested_amount_jpy: number | null;
};

type HomeState = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string | null;
  familyId: string | null;
  familyName: string | null;
  ownAvatarPath: string | null;
  ownAvatarEmoji: string | null;
  members: FamilyMember[];
  grants: GrantRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-lg font-extrabold text-[var(--text-primary)]">{children}</p>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const [state, setState] = useState<HomeState>({
    loading: true,
    isAuthenticated: false,
    userId: null,
    email: null,
    displayName: null,
    role: null,
    familyId: null,
    familyName: null,
    ownAvatarPath: null,
    ownAvatarEmoji: null,
    members: [],
    grants: [],
  });

  useEffect(() => {
    let isActive = true;

    const loadHome = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await getSafeSession(supabase);

      if (!isActive) return;

      if (sessionError || !session?.user) {
        setState((s) => ({ ...s, loading: false, isAuthenticated: false }));
        return;
      }

      const userId = session.user.id;
      const email = session.user.email ?? null;

      const [
        { data: membership },
        { data: profile },
        { data: membersRaw },
        { data: grantsRaw },
      ] = await Promise.all([
        supabase
          .from("family_memberships")
          .select("family_id, role, avatar_path, avatar_emoji")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase.rpc("list_family_members_for_current_user"),
        supabase.rpc("list_allowance_grants_for_current_user"),
      ]);

      if (!isActive) return;

      const familyId = membership?.family_id ?? null;
      let familyName: string | null = null;

      if (familyId) {
        const { data: familyData } = await supabase
          .from("families")
          .select("family_name")
          .eq("id", familyId)
          .maybeSingle();
        familyName = familyData?.family_name ?? null;
      }

      if (!isActive) return;

      const displayName =
        typeof profile?.display_name === "string" && profile.display_name.trim().length > 0
          ? profile.display_name
          : null;

      setState({
        loading: false,
        isAuthenticated: true,
        userId,
        email,
        displayName,
        role: typeof membership?.role === "string" ? membership.role : null,
        familyId,
        familyName,
        ownAvatarPath: membership?.avatar_path ?? null,
        ownAvatarEmoji: membership?.avatar_emoji ?? null,
        members: Array.isArray(membersRaw) ? (membersRaw as FamilyMember[]) : [],
        grants: Array.isArray(grantsRaw) ? (grantsRaw as GrantRow[]) : [],
      });
    };

    void loadHome();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadHome();
    });

    const onFamilyUpdated = () => void loadHome();
    window.addEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);
    };
  }, []);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const isGuardian = state.role === "guardian_admin" || state.role === "guardian";
  const isChild = state.role === "child";
  const greetingName = state.displayName ?? state.email ?? "さん";

  // Summary — activeGrants excludes both "requested" and "paid" (matches panel logic)
  const activeGrants = state.grants.filter((g) => !g.cashout_status);
  const paidGrants = state.grants.filter((g) => g.cashout_status === "paid");

  const totalAssets = activeGrants.reduce((sum, g) => {
    const val =
      g.decision_status === "invested" ? (g.current_value_jpy ?? g.amount_jpy) : g.amount_jpy;
    return sum + val;
  }, 0);

  const totalGain = activeGrants
    .filter((g) => g.decision_status === "invested")
    .reduce((sum, g) => sum + (g.unrealized_gain_jpy ?? 0), 0);

  const totalAllowance = activeGrants.reduce((sum, g) => sum + g.amount_jpy, 0);

  const totalInvested = activeGrants
    .filter((g) => g.decision_status === "invested")
    .reduce((sum, g) => sum + (g.current_value_jpy ?? g.amount_jpy), 0);

  const totalPaid = paidGrants.reduce(
    (sum, g) => sum + (g.cashout_requested_amount_jpy ?? 0),
    0
  );

  // Notifications
  const pendingCashoutsForGuardian = isGuardian
    ? state.grants.filter(
        (g) => g.cashout_status === "requested" && g.granted_by_user_id === state.userId
      )
    : [];

  const pendingDecisionsForGuardian = isGuardian
    ? activeGrants.filter((g) => g.decision_status === "pending")
    : [];

  const pendingDecisionsForChild = isChild
    ? activeGrants.filter(
        (g) => g.decision_status === "pending" && g.child_user_id === state.userId
      )
    : [];

  const ownMember = state.members.find((m) => m.user_id === state.userId);
  const profileNotSet = !ownMember?.avatar_path && !ownMember?.avatar_emoji;

  type NotifItem = {
    key: string;
    icon: string;
    title: string;
    description: string;
    href: string;
  };

  const notifications: NotifItem[] = [];

  if (pendingCashoutsForGuardian.length > 0) {
    notifications.push({
      key: "cashout",
      icon: "💰",
      title: "支払い申請が届いています",
      description: `${pendingCashoutsForGuardian.length}件の申請があります`,
      href: "/allowance",
    });
  }
  if (pendingDecisionsForGuardian.length > 0) {
    notifications.push({
      key: "pending-guardian",
      icon: "📝",
      title: "まだ決めていないお小遣いがあります",
      description: `${pendingDecisionsForGuardian.length}件が未決定です`,
      href: "/allowance",
    });
  }
  if (pendingDecisionsForChild.length > 0) {
    notifications.push({
      key: "pending-child",
      icon: "📝",
      title: "まだ決めていないお小遣いがあります",
      description: `${pendingDecisionsForChild.length}件が未決定です`,
      href: "/allowance",
    });
  }
  if (profileNotSet) {
    notifications.push({
      key: "profile",
      icon: "📷",
      title: "写真やアイコンを設定しましょう",
      description: "アイコンや名前を設定すると、もっと使いやすくなります",
      href: "/family",
    });
  }
  if (isGuardian && state.members.length < 3) {
    notifications.push({
      key: "invite",
      icon: "👨‍👩‍👧",
      title: "家族を招待できます",
      description: "家族メンバーを増やして、より便利に使えます",
      href: "/family/invites",
    });
  }

  // Quick menu
  const quickMenuItems = [
    { href: "/allowance", label: "お小遣いを見る", icon: "💰" },
    ...(isGuardian
      ? [
          { href: "/family", label: "家族設定", icon: "⚙️" },
          { href: "/family/invites", label: "家族を招待", icon: "✉️" },
        ]
      : []),
  ];

  // ─── Render states ────────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--text-secondary)]">読み込み中...</p>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
        <p className="text-5xl">🏡</p>
        <div>
          <p className="text-2xl font-black text-[var(--text-primary)]">ファミマネへようこそ</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            家族みんなでお金のことを楽しく学びましょう
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-full bg-[var(--brand-primary)] px-8 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(51,101,63,0.22)]"
        >
          ログインする
        </Link>
      </div>
    );
  }

  if (!state.familyId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
        <p className="text-5xl">👨‍👩‍👧</p>
        <div>
          <p className="text-xl font-black text-[var(--text-primary)]">家族をまだ設定していません</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">家族を作成または参加してください</p>
        </div>
        <Link
          href="/family"
          className="rounded-full bg-[var(--brand-primary)] px-8 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(51,101,63,0.22)]"
        >
          家族設定へ
        </Link>
      </div>
    );
  }

  // ─── Full dashboard ───────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-1 justify-center overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(76,163,104,0.18),transparent_54%)]" />
      <div className="pointer-events-none absolute right-[-4rem] top-18 h-40 w-40 rounded-full bg-[rgba(233,178,134,0.18)] blur-3xl" />
      <div className="pointer-events-none absolute left-[-3rem] top-56 h-32 w-32 rounded-full bg-[rgba(241,226,174,0.22)] blur-3xl" />

      <main className="relative w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5">

          {/* 1. Hero */}
          <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,rgba(230,245,233,0.98),rgba(255,250,230,0.95))] p-6">
            <span className="pointer-events-none absolute right-5 top-5 text-5xl opacity-30 select-none">🏡</span>
            <p className="text-2xl font-black leading-tight text-[var(--text-primary)] sm:text-3xl">
              おかえりなさい、<br />
              {greetingName}さん！
            </p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
              家族みんなでお金のことを楽しく学びましょう
            </p>
          </section>

          {/* 2. Family card */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>自分のファミリー</SectionTitle>
              <div className="flex flex-wrap items-center gap-2">
                {state.familyName ? (
                  <span className="rounded-full bg-[var(--surface-accent)] px-3 py-1 text-xs font-bold text-[var(--brand-primary-strong)]">
                    {state.familyName}
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                  {state.members.length}人のメンバー
                </span>
              </div>
            </div>

            {state.members.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">メンバーが見つかりません</p>
            ) : (
              <div className="-mx-1 mt-5 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-4 px-1">
                  {state.members.map((member) => {
                    const isSelf = member.user_id === state.userId;
                    return (
                      <div
                        key={member.user_id}
                        className="flex w-20 flex-col items-center gap-1.5 text-center"
                      >
                        <MemberAvatar
                          avatarPath={member.avatar_path}
                          avatarEmoji={member.avatar_emoji}
                          displayLabel={member.display_label}
                          size="lg"
                        />
                        <p className="w-full truncate text-xs font-bold text-[var(--text-primary)]">
                          {member.display_label}
                        </p>
                        <StatusBadge tone={familyRoleShortTone(member.role)}>
                          {formatFamilyRoleShort(member.role)}
                        </StatusBadge>
                        {isSelf ? (
                          <StatusBadge tone="success">あなた</StatusBadge>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* 3. Allowance summary */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>
                {isGuardian ? "家族の資産サマリー" : "あなたのお小遣い"}
              </SectionTitle>
              <Link
                href="/allowance"
                className="shrink-0 text-sm font-bold text-[var(--brand-primary)]"
              >
                詳細を見る →
              </Link>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">総資産</p>
              <p className="mt-1 text-4xl font-black text-[var(--text-primary)]">
                {formatCurrency(totalAssets)}
              </p>
              {totalGain !== 0 ? (
                <p
                  className={`mt-1 text-sm font-bold ${
                    totalGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  評価損益 {totalGain >= 0 ? "+" : ""}
                  {formatCurrency(totalGain)}
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "お小遣い総額", value: totalAllowance },
                { label: "投資中", value: totalInvested },
                { label: "支払い済み", value: totalPaid },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-[18px] bg-[var(--surface-accent)] p-3 text-center"
                >
                  <p className="text-[10px] font-semibold leading-tight text-[var(--text-secondary)]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-black text-[var(--text-primary)]">
                    {formatCurrency(value)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* 4. Notifications */}
          <Card>
            <SectionTitle>やること・お知らせ</SectionTitle>

            {notifications.length === 0 ? (
              <div className="mt-5 flex flex-col items-center gap-2 py-4 text-center">
                <span className="text-3xl">✅</span>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  いま対応が必要なことはありません
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  引き続きファミリーのお金管理を続けましょう
                </p>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {notifications.map((n) => (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="flex items-center gap-3 rounded-[20px] border border-[var(--border-soft)] bg-white px-4 py-3 transition hover:bg-[var(--surface-accent)]"
                  >
                    <span className="text-xl">{n.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{n.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{n.description}</p>
                    </div>
                    <span className="shrink-0 text-lg text-[var(--text-muted)]">›</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* 5. Quick menu */}
          <Card>
            <SectionTitle>クイックメニュー</SectionTitle>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickMenuItems.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-[22px] border border-[var(--border-soft)] bg-white p-5 text-center transition hover:bg-[var(--surface-accent)]"
                >
                  <span className="text-3xl">{icon}</span>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
                </Link>
              ))}
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
