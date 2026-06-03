"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LegalLinks, LegalLoginNotice } from "@/app/components/ui/legal-links";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

function mapAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid_grant")) {
    return "メールアドレスまたはパスワードが違います。";
  }
  return message;
}

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) return "/";
  return nextPath;
}

function normalizeEmail(email: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

function createPageHref(path: string, nextPath: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams();
  if (nextPath && nextPath !== "/") params.set("next", nextPath);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => normalizeNextPath(searchParams.get("next")), [searchParams]);
  const initialEmail = useMemo(() => normalizeEmail(searchParams.get("email")), [searchParams]);
  const registerHref = useMemo(() => createPageHref("/register", nextPath), [nextPath]);
  const forgotPasswordHref = useMemo(() => createPageHref("/forgot-password", nextPath), [nextPath]);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    const getDestination = (requiresPasswordSetup: boolean) =>
      requiresPasswordSetup
        ? `/setup-password?next=${encodeURIComponent(nextPath)}`
        : nextPath;

    const checkSession = async () => {
      const { data, error } = await getSafeSession(supabase);
      if (!isActive) return;
      if (error) { setErrorMessage("セッションの確認に失敗しました。"); return; }
      const user = data.session?.user;
      if (user) router.replace(getDestination(Boolean(user.user_metadata?.requires_password_setup)));
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) router.replace(getDestination(Boolean(user.user_metadata?.requires_password_setup)));
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage(mapAuthErrorMessage(error.message));
      setIsSubmitting(false);
      return;
    }

    // Block logically-deleted users (family_memberships.status = 'disabled')
    const { data: isDisabled } = await supabase.rpc("is_own_membership_disabled");
    if (isDisabled) {
      await supabase.auth.signOut();
      setErrorMessage("存在しないアカウントです。新規登録を行ってください。");
      setIsSubmitting(false);
      return;
    }

    router.replace(
      Boolean(data.user?.user_metadata?.requires_password_setup)
        ? `/setup-password?next=${encodeURIComponent(nextPath)}`
        : nextPath
    );
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F4FAF5_0%,#FFFFFF_16%,#FFFFFF_100%)] text-[#1F2D20]">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(55,140,65,0.10)] bg-[rgba(255,255,255,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/">
            <Image
              src="/assets/lp/logo.png"
              alt="ファミマネ"
              width={180}
              height={54}
              className="h-10 w-auto sm:h-12"
              priority
            />
          </Link>
          <Link
            href={registerHref}
            className="text-sm font-bold text-[#378C41] underline underline-offset-4 transition hover:text-[#2A6B34]"
          >
            新規登録はこちら
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-5 py-16 sm:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-[32px] border border-[rgba(55,140,65,0.14)] bg-white p-6 shadow-[0_30px_70px_rgba(75,175,87,0.14)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold tracking-[0.16em] text-[#4BAF57]">LOGIN</p>
                <h1 className="mt-2 text-2xl font-black text-[#1F2D20]">ログイン</h1>
                <p className="mt-3 text-sm leading-7 text-[#516251]">
                  招待を受け取った方は、メールに記載されたパスワードで初回ログインをしてください。
                </p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4FAF5] text-xl sm:flex">
                🔐
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-[#1F2D20]">
                メールアドレス
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="min-h-14 rounded-2xl border border-[rgba(55,140,65,0.16)] bg-[#FBFEFB] px-4 py-3 text-base text-[#1F2D20] outline-none transition focus:border-[#4BAF57] focus:bg-white"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#1F2D20]">
                パスワード
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                  className="min-h-14 rounded-2xl border border-[rgba(55,140,65,0.16)] bg-[#FBFEFB] px-4 py-3 text-base text-[#1F2D20] outline-none transition focus:border-[#4BAF57] focus:bg-white"
                  required
                  minLength={6}
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 min-h-14 rounded-full bg-[#4BAF57] px-5 text-base font-bold text-white shadow-[0_16px_40px_rgba(75,175,87,0.24)] transition hover:bg-[#378C41] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "ログイン中..." : "ログイン"}
              </button>
            </form>

            <LegalLoginNotice
              className="mt-4 text-sm leading-7 text-[#516251]"
              linkClassName="font-semibold underline underline-offset-4 transition hover:text-[#378C41]"
            />

            {errorMessage ? (
              <p className="mt-4 rounded-2xl border border-[rgba(220,107,90,0.22)] bg-[rgba(255,242,238,0.92)] px-4 py-3 text-sm text-[#C45C48]">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 text-sm">
              <Link href={forgotPasswordHref} className="font-medium text-[#516251] underline underline-offset-4 transition hover:text-[#378C41]">
                パスワードを忘れた方はこちら
              </Link>
              <Link href={registerHref} className="font-medium text-[#516251] underline underline-offset-4 transition hover:text-[#378C41]">
                新規登録はこちら
              </Link>
              <p className="leading-7 text-[#7A8D7A]">
                既存アカウントで初回パスワードが未設定の場合は、管理者に初期パスワード設定を依頼してください。
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-[#516251]">
            <LegalLinks linkClassName="font-semibold underline underline-offset-4 transition hover:text-[#378C41]" />
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4FAF5] px-6 py-16">
          <p className="text-sm text-[#516251]">読み込み中です。</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
