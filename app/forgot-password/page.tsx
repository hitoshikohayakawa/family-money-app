"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }

  return nextPath;
}

function ForgotPasswordPageContent() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const redirectTo = `${window.location.origin}/setup-password?next=${encodeURIComponent(
      nextPath
    )}&mode=reset`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setErrorMessage(`パスワード再設定メールの送信に失敗しました: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(
      "パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。"
    );
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          パスワードを再設定
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          登録済みのメールアドレスへ、パスワード再設定用のリンクを送ります。
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            {isSubmitting ? "送信中..." : "再設定メールを送る"}
          </button>
        </form>

        <div className="mt-5 text-sm">
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
          >
            ログイン画面に戻る
          </Link>
        </div>

        {successMessage ? (
          <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black"><p className="text-sm text-zinc-600 dark:text-zinc-400">読み込み中です。</p></div>}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
