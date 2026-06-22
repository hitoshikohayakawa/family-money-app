"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LegalLinks } from "@/app/components/ui/legal-links";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }

  return nextPath;
}

function mapAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("user already registered")) {
    return "このメールアドレスはすでに登録されています。ログインしてください。";
  }

  return message;
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      const { data, error } = await getSafeSession(supabase);

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("セッションの確認に失敗しました。");
        return;
      }

      if (data.session?.user) {
        router.replace(nextPath);
      }
    };

    void checkSession();

    return () => {
      isActive = false;
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (displayName.trim().length === 0) {
      setErrorMessage("名前を入力してください。");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage("確認用パスワードが一致していません。");
      return;
    }

    if (!agreedToPolicies) {
      setErrorMessage("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const normalizedDisplayName = displayName.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
        data: {
          display_name: normalizedDisplayName,
          requires_password_setup: false,
        },
      },
    });

    if (error) {
      setErrorMessage(mapAuthErrorMessage(error.message));
      setIsSubmitting(false);
      return;
    }

    // 登録成功時のみ GTM の dataLayer へコンバージョンイベントを送信する。
    // エラー時は上の return で抜けるため発火せず、ここは成功時に一度だけ通る。
    // 現状の登録経路は email/password のみ（OAuth 未使用）のため signup_method は "email"。
    const dataLayerWindow = window as typeof window & {
      dataLayer?: Record<string, unknown>[];
    };
    dataLayerWindow.dataLayer = dataLayerWindow.dataLayer || [];
    dataLayerWindow.dataLayer.push({
      event: "signup_complete",
      service: "miramane",
      signup_method: "email",
    });

    if (data.session) {
      router.replace(nextPath);
    } else {
      setRegisteredEmail(email);
      setRegistrationComplete(true);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          新規登録
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          名前、メールアドレス、パスワードを設定して使い始めます。
        </p>

        {registrationComplete ? (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              確認メールを送りました
            </p>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              <strong>{registeredEmail}</strong> にメールを送りました。
              メール内のリンクをクリックして、メールアドレスを確認してください。
            </p>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              メールが届かない場合は、迷惑メールフォルダもご確認ください。
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="text-sm text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
            >
              ログインページへ
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                名前
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="例: 小早川"
                  className="rounded-lg border border-zinc-300 px-4 py-3 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  required
                />
              </label>

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

              <label className="flex items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={agreedToPolicies}
                  onChange={(event) => setAgreedToPolicies(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-zinc-300 text-black focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>
                  <LegalLinks linkClassName="underline underline-offset-4" />
                  {" に同意する"}
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !agreedToPolicies}
                className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
              >
                {isSubmitting ? "登録中..." : "新規登録する"}
              </button>
            </form>

            <div className="mt-5 text-sm">
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
              >
                ログインページへ戻る
              </Link>
            </div>

            {errorMessage ? (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black"><p className="text-sm text-zinc-600 dark:text-zinc-400">読み込み中です。</p></div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
