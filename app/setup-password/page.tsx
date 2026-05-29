"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LegalLoginNotice } from "@/app/components/ui/legal-links";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }

  return nextPath;
}

function SetupPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const isResetMode = searchParams.get("mode") === "reset";
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await getSafeSession(supabase);

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("セッションの確認に失敗しました。");
        setLoading(false);
        return;
      }

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      setEmail(session.user.email ?? null);
      setLoading(false);
    };

    void checkSession();

    return () => {
      isActive = false;
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      setErrorMessage("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage("確認用パスワードが一致していません。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
      data: {
        requires_password_setup: false,
      },
    });

    if (error) {
      setErrorMessage(`パスワード設定に失敗しました: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    router.replace(nextPath);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {isResetMode ? "パスワード再設定" : "初回パスワード設定"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {isResetMode
            ? "メール内のリンクで本人確認できました。新しいパスワードを設定してください。"
            : "受け取った初期パスワードから、使いやすい新しいパスワードへ変更します。"}
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">読み込み中です。</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              メールアドレス
              <input
                type="email"
                value={email ?? ""}
                readOnly
                className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-black outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              新しいパスワード
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

            <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              確認用パスワード
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                placeholder="もう一度入力"
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
              {isSubmitting ? "設定中..." : "新しいパスワードを設定する"}
            </button>

            <LegalLoginNotice
              className="text-sm leading-7 text-zinc-600 dark:text-zinc-400"
              linkClassName="underline underline-offset-4"
            />
          </form>
        )}

        <div className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/login" className="underline underline-offset-4">
            ログインページへ戻る
          </Link>
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

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black"><p className="text-sm text-zinc-600 dark:text-zinc-400">読み込み中です。</p></div>}>
      <SetupPasswordPageContent />
    </Suspense>
  );
}
