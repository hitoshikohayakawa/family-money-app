"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import SectionCard from "@/app/components/ui/section-card";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import StatusBadge from "@/app/components/ui/status-badge";

type AuthStatusState = {
  email: string | null;
  loading: boolean;
  error: string;
  signingOut: boolean;
};

export default function AuthStatus() {
  const [state, setState] = useState<AuthStatusState>({
    email: null,
    loading: true,
    error: "",
    signingOut: false,
  });

  useEffect(() => {
    let isActive = true;

    const ensureProfileExists = async (user: User) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        return `profiles の確認に失敗しました: ${error.message}`;
      }

      if (data) {
        return "";
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email ?? "",
        display_name: null,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          return "";
        }

        return `profiles の自動作成に失敗しました: ${insertError.message}`;
      }

      return "";
    };

    const loadUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        setState({
          email: null,
          loading: false,
          error: "ユーザー情報の取得に失敗しました。",
          signingOut: false,
        });
        return;
      }

      const profileError = session?.user ? await ensureProfileExists(session.user) : "";

      setState({
        email: session?.user?.email ?? null,
        loading: false,
        error: profileError,
        signingOut: false,
      });
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }

      setState((currentState) => ({
        email: session?.user?.email ?? null,
        loading: false,
        error: "",
        signingOut: currentState.signingOut && !!session,
      }));

      if (!session?.user) {
        return;
      }

      void (async () => {
        const profileError = await ensureProfileExists(session.user);

        if (!isActive || !profileError) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          error: profileError,
        }));
      })();
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
      error: "",
    }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setState((currentState) => ({
        ...currentState,
        signingOut: false,
        error: "ログアウトに失敗しました。",
      }));
      return;
    }

    setState({
      email: null,
      loading: false,
      error: "",
      signingOut: false,
    });
  };

  return (
    <SectionCard
      title="ログイン状態"
      description="いま使っている人をここで確認できます。"
    >

      {state.loading ? (
        <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">現在のアカウント</p>
              <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                {state.email ?? "まだログインしていません"}
              </p>
            </div>
            <StatusBadge tone={state.email ? "success" : "neutral"}>
              {state.email ? "利用中" : "未ログイン"}
            </StatusBadge>
          </div>

          {state.email ? (
            <PrimaryButton
              onClick={handleSignOut}
              disabled={state.signingOut}
              fullWidth={false}
              size="sm"
              className="mt-4"
            >
              {state.signingOut ? "ログアウト中..." : "ログアウト"}
            </PrimaryButton>
          ) : (
            <Link
              href="/login"
              className="mt-4 inline-flex"
            >
              <SecondaryButton size="sm">ログインページへ</SecondaryButton>
            </Link>
          )}
        </>
      )}

      {state.error ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
    </SectionCard>
  );
}