"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function mapAuthErrorMessage(message: string) {
  if (message.toLowerCase().includes("email rate limit exceeded")) {
    return "メール送信回数の上限に達しました。少し時間を空けてから、もう一度お試しください。";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("セッションの確認に失敗しました。");
        return;
      }

      if (data.session) {
        router.replace("/");
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/");
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (cooldownSeconds === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownSeconds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (cooldownSeconds > 0) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setErrorMessage(mapAuthErrorMessage(error.message));
      if (error.message.toLowerCase().includes("email rate limit exceeded")) {
        setCooldownSeconds(60);
      }
      setIsSubmitting(false);
      return;
    }

    setMessage(
      "確認メールを送信しました。メール内のリンクを開くとトップページへ戻ります。"
    );
    setCooldownSeconds(60);
    setEmail("");
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          ログイン
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          メールアドレスを入力すると、ログイン用の magic link を送信します。
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
            disabled={isSubmitting || cooldownSeconds > 0}
            className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            {isSubmitting
              ? "送信中..."
              : cooldownSeconds > 0
                ? `${cooldownSeconds}秒待って再送`
                : "magic link を送信"}
          </button>
        </form>

        {message ? (
          <p className="mt-4 text-sm text-green-600 dark:text-green-400">{message}</p>
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