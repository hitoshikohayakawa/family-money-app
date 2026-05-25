"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import useElementaryMode from "@/app/components/use-elementary-mode";
import { supabase } from "@/lib/supabase";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import StatusBadge from "@/app/components/ui/status-badge";

type HeaderState = {
  email: string | null;
  role: string | null;
  loading: boolean;
  signingOut: boolean;
};

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { elementaryMode, setElementaryMode } = useElementaryMode();
  const [state, setState] = useState<HeaderState>({
    email: null,
    role: null,
    loading: true,
    signingOut: false,
  });

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data: membership } = session?.user
        ? await supabase
            .from("family_memberships")
            .select("role")
            .eq("status", "active")
            .eq("user_id", session.user.id)
            .maybeSingle()
        : { data: null };

      if (!isActive) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        email: session?.user?.email ?? null,
        role: typeof membership?.role === "string" ? membership.role : null,
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
        role: null,
        loading: false,
        signingOut: false,
      }));
      void loadSession();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
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

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(84,130,95,0.12)] bg-[rgba(248,252,246,0.9)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
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

        <div className="relative">
          <SecondaryButton
            type="button"
            size="sm"
            onClick={() => setMenuOpen((currentValue) => !currentValue)}
          >
            メニュー
          </SecondaryButton>

          {menuOpen ? (
            <div className="absolute right-0 mt-3 w-[min(86vw,360px)] rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_24px_70px_rgba(42,88,53,0.18)]">
              <div className="rounded-[22px] bg-[var(--surface-accent)] px-4 py-3">
                <p className="text-xs font-semibold text-[var(--text-muted)]">ログイン状態</p>
                <p className="mt-1 break-all text-sm font-bold text-[var(--text-primary)]">
                  {state.loading ? "確認中..." : state.email ?? "未ログイン"}
                </p>
                <div className="mt-2">
                  <StatusBadge tone={state.email ? "success" : "neutral"}>
                    {state.email ? "利用中" : "未ログイン"}
                  </StatusBadge>
                </div>
              </div>

              <nav className="mt-3 grid gap-2">
                <Link
                  href="/"
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
    </header>
  );
}
