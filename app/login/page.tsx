"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function mapAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid_grant")
  ) {
    return "メールアドレスまたはパスワードが違います。";
  }

  return message;
}

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }

  return nextPath;
}

function normalizeEmail(email: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const initialEmail = useMemo(
    () => normalizeEmail(searchParams.get("email")),
    [searchParams]
  );
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
      const { data, error } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("セッションの確認に失敗しました。");
        return;
      }

      const user = data.session?.user;

      if (user) {
        router.replace(
          getDestination(Boolean(user.user_metadata?.requires_password_setup))
        );
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (user) {
        router.replace(
          getDestination(Boolean(user.user_metadata?.requires_password_setup))
        );
      }
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(mapAuthErrorMessage(error.message));
      setIsSubmitting(false);
      return;
    }

    const requiresPasswordSetup = Boolean(
      data.user?.user_metadata?.requires_password_setup
    );

    router.replace(
      requiresPasswordSetup
        ? `/setup-password?next=${encodeURIComponent(nextPath)}`
        : nextPath
    );
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          ログイン
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          ※招待を受け取った方はメールに記載されたパスワードで初回ログインを行ってください。
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-zinc-300 px-4 py-3 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6文字以上"
              className="rounded-lg border border-zinc-300 px-4 py-3 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              required
              minLength={6}
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-2 text-sm">
          <Link
            href={`/forgot-password?next=${encodeURIComponent(nextPath)}`}
            className="text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
          >
            パスワードを忘れた方はこちら
          </Link>
          <Link
            href={`/register?next=${encodeURIComponent(nextPath)}`}
            className="text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
          >
            新規登録はこちら
          </Link>
          <p className="text-zinc-500 dark:text-zinc-400">
            既存アカウントで初回パスワードが未設定の場合は、管理者に初期パスワード設定を依頼してください。
          </p>
        </div>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black"><p className="text-sm text-zinc-600 dark:text-zinc-400">読み込み中です。</p></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
