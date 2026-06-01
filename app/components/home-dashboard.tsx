"use client";

import Image from "next/image";
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

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconPersonAdd() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
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

// ─── Member card ─────────────────────────────────────────────────────────────

function MemberCard({
  member,
  isSelf,
  navigable = true,
}: {
  member: FamilyMember;
  isSelf: boolean;
  navigable?: boolean;
}) {
  const isChild = member.role === "child";
  const roleLabel = formatFamilyRoleShort(member.role);
  const roleTone = familyRoleShortTone(member.role);

  const inner = (
    <div className="flex w-20 flex-col items-center gap-1.5 text-center">
      <MemberAvatar
        avatarPath={member.avatar_path}
        avatarEmoji={member.avatar_emoji}
        displayLabel={member.display_label}
        size="lg"
      />
      <p className="w-full truncate text-xs font-bold text-[var(--text-primary)]">
        {member.display_label}
      </p>
      <StatusBadge tone={roleTone}>{roleLabel}</StatusBadge>
      {isSelf ? <StatusBadge tone="success">あなた</StatusBadge> : null}
      {isChild && navigable ? (
        <p className="text-[10px] font-semibold text-[var(--brand-primary)]">お小遣いを見る</p>
      ) : null}
    </div>
  );

  if (isChild && navigable) {
    return (
      <Link
        href={`/allowance?childId=${member.user_id}`}
        className="rounded-[18px] p-1 transition hover:bg-[var(--surface-accent)]"
      >
        {inner}
      </Link>
    );
  }

  return <div className="p-1">{inner}</div>;
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
          .select("family_id, role")
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

  // Summary — mirrors AllowanceGrantsPanel: activeGrants excludes cashout_status !== null
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
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    href: string;
  };

  const notifications: NotifItem[] = [];

  if (pendingCashoutsForGuardian.length > 0) {
    notifications.push({
      key: "cashout",
      icon: <IconCash />,
      iconBg: "bg-[rgba(191,110,82,0.12)]",
      iconColor: "text-[var(--danger)]",
      title: "支払い申請が届いています",
      description: `${pendingCashoutsForGuardian.length}件の申請があります`,
      href: "/allowance",
    });
  }
  if (pendingDecisionsForGuardian.length > 0) {
    notifications.push({
      key: "pending-guardian",
      icon: <IconDocument />,
      iconBg: "bg-[rgba(228,163,94,0.12)]",
      iconColor: "text-[var(--warning)]",
      title: "まだ決めていないお小遣いがあります",
      description: `${pendingDecisionsForGuardian.length}件が未決定です`,
      href: "/allowance",
    });
  }
  if (pendingDecisionsForChild.length > 0) {
    notifications.push({
      key: "pending-child",
      icon: <IconDocument />,
      iconBg: "bg-[rgba(228,163,94,0.12)]",
      iconColor: "text-[var(--warning)]",
      title: "まだ決めていないお小遣いがあります",
      description: `${pendingDecisionsForChild.length}件が未決定です`,
      href: "/allowance",
    });
  }
  if (profileNotSet) {
    notifications.push({
      key: "profile",
      icon: <IconCamera />,
      iconBg: "bg-[var(--surface-accent)]",
      iconColor: "text-[var(--brand-primary)]",
      title: "写真やアイコンを設定しましょう",
      description: "アイコンや名前を設定すると、もっと使いやすくなります",
      href: "/family",
    });
  }
  if (isGuardian && state.members.length < 3) {
    notifications.push({
      key: "invite",
      icon: <IconPeople />,
      iconBg: "bg-[rgba(76,163,104,0.12)]",
      iconColor: "text-[var(--success)]",
      title: "家族を招待できます",
      description: "家族メンバーを増やして、より便利に使えます",
      href: "/family/invites",
    });
  }

  // Quick menu items with SVG icons
  type QuickItem = {
    href: string;
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
  };

  const quickMenuItems: QuickItem[] = [
    {
      href: "/allowance",
      label: "お小遣いを見る",
      icon: <IconWallet />,
      iconBg: "bg-[rgba(76,163,104,0.12)]",
      iconColor: "text-[var(--brand-primary)]",
    },
    ...(isGuardian
      ? [
          {
            href: "/family",
            label: "家族設定",
            icon: <IconSettings />,
            iconBg: "bg-[var(--surface-accent)]",
            iconColor: "text-[var(--info)]",
          },
          {
            href: "/family/invites",
            label: "家族を招待",
            icon: <IconPersonAdd />,
            iconBg: "bg-[rgba(228,163,94,0.12)]",
            iconColor: "text-[var(--warning)]",
          },
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
          <section className="relative min-h-[120px] overflow-hidden rounded-[28px] p-6">
            <Image
              src="/famimane_head.png"
              alt=""
              fill
              className="object-cover object-right-bottom"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(236,248,238,0.80)_45%,transparent_78%)]" />
            <div className="relative z-10">
              <p className="text-2xl font-black leading-tight text-[var(--text-primary)] sm:text-3xl">
                おかえりなさい、
                <br />
                {greetingName}さん！
              </p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
                家族みんなでお金のことを楽しく学びましょう
              </p>
            </div>
          </section>

          {/* 2. Family card — guardian only (child sees it at the bottom) */}
          {isGuardian ? (
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
                  <div className="flex min-w-max gap-3 px-1">
                    {state.members.map((member) => (
                      <MemberCard
                        key={member.user_id}
                        member={member}
                        isSelf={member.user_id === state.userId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : null}

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
              <p className="text-xs font-semibold text-[var(--text-secondary)]">現在の総資産</p>
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
                { label: "これまで支払い済み", value: totalPaid },
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
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(76,163,104,0.12)]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--success)]" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
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
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.iconBg} ${n.iconColor}`}
                    >
                      {n.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{n.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{n.description}</p>
                    </div>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* 5a. Quick menu — guardian only */}
          {isGuardian ? (
            <Card>
              <SectionTitle>クイックメニュー</SectionTitle>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {quickMenuItems.map(({ href, label, icon, iconBg, iconColor }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-3 rounded-[22px] border border-[var(--border-soft)] bg-white p-5 text-center transition hover:bg-[var(--surface-accent)]"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg} ${iconColor}`}
                    >
                      {icon}
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}

          {/* 5b. Learning sites — child only */}
          {isChild ? (
            <Card>
              <SectionTitle>お金を学ぶサイト</SectionTitle>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    href: "https://finance.yahoo.co.jp/",
                    name: "Yahoo!ファイナンス",
                    description: "株や投資信託の最新価格、為替レート、マーケットニュースを無料で確認できます。",
                    iconBg: "bg-[rgba(76,163,104,0.12)]",
                    iconColor: "text-[var(--brand-primary)]",
                  },
                  {
                    href: "https://media.rakuten-sec.net/",
                    name: "トウシル（楽天証券）",
                    description: "楽天証券の投資情報サイト。初心者向けのわかりやすい記事やコラムが豊富です。",
                    iconBg: "bg-[rgba(228,163,94,0.12)]",
                    iconColor: "text-[var(--warning)]",
                  },
                ].map(({ href, name, description, iconBg, iconColor }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[20px] border border-[var(--border-soft)] bg-white px-4 py-3 transition hover:bg-[var(--surface-accent)]"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
                    </div>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          {/* 5c. Family card — child only, at bottom, non-navigable */}
          {isChild ? (
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
                  <div className="flex min-w-max gap-3 px-1">
                    {state.members.map((member) => (
                      <MemberCard
                        key={member.user_id}
                        member={member}
                        isSelf={member.user_id === state.userId}
                        navigable={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : null}

        </div>
      </main>
    </div>
  );
}
