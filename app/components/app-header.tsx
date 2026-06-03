"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useElementaryMode from "@/app/components/use-elementary-mode";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import StatusBadge from "@/app/components/ui/status-badge";

// ─── Types ───────────────────────────────────────────────────────────────────

type HeaderGrantRow = {
  child_user_id: string;
  granted_by_user_id: string;
  decision_status: string;
  cashout_status: string | null;
};

type HeaderState = {
  email: string | null;
  displayName: string | null;
  role: string | null;
  userId: string | null;
  hasAvatar: boolean;
  loading: boolean;
  signingOut: boolean;
  grants: HeaderGrantRow[];
};

type NotifItem = {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  href: string;
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { elementaryMode, setElementaryMode } = useElementaryMode();
  const [state, setState] = useState<HeaderState>({
    email: null,
    displayName: null,
    role: null,
    userId: null,
    hasAvatar: false,
    loading: true,
    signingOut: false,
    grants: [],
  });

  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await getSafeSession(supabase);

      const [{ data: membership }, { data: profile }, { data: grantsRaw }] = session?.user
        ? await Promise.all([
            supabase
              .from("family_memberships")
              .select("role, avatar_path, avatar_emoji")
              .eq("status", "active")
              .eq("user_id", session.user.id)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("display_name")
              .eq("id", session.user.id)
              .maybeSingle(),
            supabase.rpc("list_allowance_grants_for_current_user"),
          ])
        : [{ data: null }, { data: null }, { data: null }];

      if (!isActive) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        email: session?.user?.email ?? null,
        userId: session?.user?.id ?? null,
        displayName:
          typeof profile?.display_name === "string" && profile.display_name.trim().length > 0
            ? profile.display_name
            : null,
        role: typeof membership?.role === "string" ? membership.role : null,
        hasAvatar: !!(membership?.avatar_path || membership?.avatar_emoji),
        grants: Array.isArray(grantsRaw) ? (grantsRaw as HeaderGrantRow[]) : [],
        loading: false,
      }));
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        email: session?.user?.email ?? null,
        userId: session?.user?.id ?? null,
        displayName: null,
        role: null,
        hasAvatar: false,
        grants: [],
        loading: false,
        signingOut: false,
      }));
      void loadSession();
    });

    // Re-fetch profile when family data updates (e.g. avatar change from settings page)
    const onFamilyUpdated = () => void loadSession();
    window.addEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);
    };
  }, []);

  const handleSignOut = async () => {
    setState((currentState) => ({
      ...currentState,
      signingOut: true,
    }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setState((currentState) => ({
        ...currentState,
        signingOut: false,
      }));
    }
  };

  const isGuardian = state.role === "guardian_admin" || state.role === "guardian";
  const isChild = state.role === "child";

  // ─── Notifications ──────────────────────────────────────────────────────────

  const headerNotifs: NotifItem[] = [];

  if (state.email) {
    const activeGrants = state.grants.filter((g) => !g.cashout_status);

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

    if (pendingCashoutsForGuardian.length > 0) {
      headerNotifs.push({
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
      headerNotifs.push({
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
      headerNotifs.push({
        key: "pending-child",
        icon: <IconDocument />,
        iconBg: "bg-[rgba(228,163,94,0.12)]",
        iconColor: "text-[var(--warning)]",
        title: "まだ決めていないお小遣いがあります",
        description: `${pendingDecisionsForChild.length}件が未決定です`,
        href: "/allowance",
      });
    }
    if (!state.hasAvatar) {
      headerNotifs.push({
        key: "profile",
        icon: <IconCamera />,
        iconBg: "bg-[var(--surface-accent)]",
        iconColor: "text-[var(--brand-primary)]",
        title: "写真やアイコンを設定しましょう",
        description: "アイコンや名前を設定するともっと使いやすくなります",
        href: isChild ? "/settings" : "/family",
      });
    }
  }

  const notifCount = headerNotifs.length;

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(84,130,95,0.12)] bg-[rgba(248,252,246,0.9)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => {
            setMenuOpen(false);
            setNotifOpen(false);
          }}
        >
          <Image
            src="/icon.png"
            alt="ファミマネ"
            width={44}
            height={44}
            className="rounded-2xl shadow-[0_10px_24px_rgba(51,101,63,0.14)]"
            priority
          />
          <div>
            <p className="text-lg font-black tracking-tight text-[var(--text-primary)]">
              ファミマネ
            </p>
            <p className="hidden text-xs font-semibold text-[var(--text-secondary)] sm:block">
              家族でお金を学ぶ
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Bell notification button */}
          {state.email ? (
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                aria-label="お知らせ"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--surface-accent)]"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setMenuOpen(false);
                }}
              >
                <IconBell />
                {notifCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                ) : null}
              </button>

              {notifOpen ? (
                <div className="absolute right-0 mt-3 w-[min(86vw,360px)] rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_24px_70px_rgba(42,88,53,0.18)]">
                  <p className="px-1 text-sm font-extrabold text-[var(--text-primary)]">
                    お知らせ
                  </p>
                  {headerNotifs.length === 0 ? (
                    <div className="mt-3 flex flex-col items-center gap-2 rounded-[22px] bg-[var(--surface-accent)] py-5 text-center">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6 text-[var(--success)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        対応が必要なことはありません
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {headerNotifs.map((n) => (
                        <Link
                          key={n.key}
                          href={n.href}
                          className="flex items-center gap-3 rounded-[20px] border border-[var(--border-soft)] bg-white px-4 py-3 transition hover:bg-[var(--surface-accent)]"
                          onClick={() => setNotifOpen(false)}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.iconBg} ${n.iconColor}`}
                          >
                            {n.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[var(--text-primary)]">
                              {n.title}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">{n.description}</p>
                          </div>
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Menu button */}
          <div className="relative" ref={menuRef}>
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => {
                setMenuOpen((v) => !v);
                setNotifOpen(false);
              }}
            >
              メニュー
            </SecondaryButton>

            {menuOpen ? (
              <div className="absolute right-0 mt-3 w-[min(86vw,360px)] rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_24px_70px_rgba(42,88,53,0.18)]">
                <div className="rounded-[22px] bg-[var(--surface-accent)] px-4 py-3">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">ログイン状態</p>
                  <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                    {state.loading
                      ? "確認中..."
                      : state.displayName ?? state.email ?? "未ログイン"}
                  </p>
                  {state.displayName && state.email ? (
                    <p className="mt-1 break-all text-xs text-[var(--text-muted)]">{state.email}</p>
                  ) : null}
                  <div className="mt-2">
                    <StatusBadge tone={state.email ? "success" : "neutral"}>
                      {state.email ? "利用中" : "未ログイン"}
                    </StatusBadge>
                  </div>
                </div>

                <nav className="mt-3 grid gap-2">
                  <Link
                    href="/allowance"
                    className="rounded-[18px] px-4 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-accent)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {isChild && elementaryMode ? "おこづかい" : "お小遣い"}
                  </Link>
                  {isChild ? (
                    <Link
                      href="/allowance-history"
                      className="rounded-[18px] px-4 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-accent)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {elementaryMode ? "これまでの うけとりきろく" : "過去の受け取り履歴"}
                    </Link>
                  ) : null}
                  {isGuardian ? (
                    <>
                      <Link
                        href="/family"
                        className="rounded-[18px] px-4 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-accent)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        家族設定
                      </Link>
                      <Link
                        href="/family/invites"
                        className="rounded-[18px] px-4 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-accent)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        家族を招待
                      </Link>
                    </>
                  ) : null}
                </nav>

                {isChild ? (
                  <div className="mt-3 rounded-[22px] border border-[var(--border-soft)] bg-[rgba(243,251,244,0.72)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">小学生モード</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                          むずかしい漢字を、ひらがなで表示します。
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={elementaryMode}
                        aria-label="小学生モード"
                        className={`inline-flex min-w-20 items-center justify-center rounded-full px-3 py-2 text-sm font-black transition ${
                          elementaryMode
                            ? "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_rgba(51,101,63,0.22)]"
                            : "border border-[var(--border-soft)] bg-white text-[var(--text-secondary)]"
                        }`}
                        onClick={() => setElementaryMode(!elementaryMode)}
                      >
                        {elementaryMode ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  {state.email ? (
                    <PrimaryButton
                      type="button"
                      size="sm"
                      fullWidth
                      onClick={handleSignOut}
                      disabled={state.signingOut}
                    >
                      {state.signingOut ? "ログアウト中..." : "ログアウト"}
                    </PrimaryButton>
                  ) : (
                    <Link href="/login" onClick={() => setMenuOpen(false)}>
                      <PrimaryButton type="button" size="sm" fullWidth>
                        ログイン
                      </PrimaryButton>
                    </Link>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
