"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LegalLinks, LegalLoginNotice } from "@/app/components/ui/legal-links";
import { getSafeSession } from "@/lib/client-auth";
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

function createPageHref(path: string, nextPath: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams();

  if (nextPath && nextPath !== "/") {
    params.set("next", nextPath);
  }

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function MarketingButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-[#4BAF57] text-white shadow-[0_16px_40px_rgba(75,175,87,0.24)] hover:bg-[#378C41]"
      : variant === "secondary"
        ? "border border-[rgba(55,140,65,0.16)] bg-white text-[#1F2D20] hover:border-[rgba(55,140,65,0.32)] hover:bg-[#F4FAF5]"
        : "border border-[rgba(75,175,87,0.45)] bg-transparent text-[#378C41] hover:bg-[#E8F5E9]";

  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition duration-200 ${variantClass} ${className}`}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[#E8F5E9] px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-[#378C41]">
      {children}
    </span>
  );
}

function MarketingSection({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`px-5 py-16 sm:px-8 lg:px-10 lg:py-24 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function FeatureCard({
  imageSrc,
  imageAlt,
  title,
  description,
}: {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[30px] border border-[rgba(55,140,65,0.12)] bg-white p-6 shadow-[0_20px_50px_rgba(75,175,87,0.10)]">
      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#F7FBF7] shadow-inner shadow-[rgba(75,175,87,0.08)]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={64}
          height={64}
          className="h-16 w-16 object-contain"
        />
      </div>
      <h3 className="mt-5 text-xl font-extrabold leading-8 text-[#1F2D20]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#516251]">{description}</p>
    </article>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <article className="relative rounded-[28px] border border-[rgba(55,140,65,0.12)] bg-white p-6 shadow-[0_16px_44px_rgba(75,175,87,0.10)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4BAF57] text-sm font-black text-white">
        {step}
      </div>
      <h3 className="mt-5 text-lg font-extrabold text-[#1F2D20]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#516251]">{description}</p>
    </article>
  );
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
  const showLoginForm = useMemo(
    () => searchParams.get("show") === "login" || initialEmail.length > 0,
    [initialEmail.length, searchParams]
  );
  const loginHref = useMemo(
    () => `${createPageHref("/login", nextPath, { show: "login" })}#login-form`,
    [nextPath]
  );
  const registerHref = useMemo(
    () => createPageHref("/register", nextPath),
    [nextPath]
  );
  const forgotPasswordHref = useMemo(
    () => createPageHref("/forgot-password", nextPath),
    [nextPath]
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
      const { data, error } = await getSafeSession(supabase);

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#F4FAF5_0%,#FFFFFF_16%,#FFFFFF_100%)] text-[#1F2D20]">
      <header className="sticky top-0 z-50 border-b border-[rgba(55,140,65,0.10)] bg-[rgba(255,255,255,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/lp/logo.png"
              alt="ファミマネ"
              width={180}
              height={54}
              className="h-10 w-auto sm:h-12"
              priority
            />
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <MarketingButton href={loginHref} variant="secondary" className="min-h-11 px-5">
              ログイン
            </MarketingButton>
            <MarketingButton href={registerHref} variant="primary" className="min-h-11 px-5">
              無料ではじめる
            </MarketingButton>
          </div>
        </div>
      </header>

      <main>
        <MarketingSection className="overflow-hidden pb-12 pt-10 sm:pt-14 lg:pb-16 lg:pt-20">
          <div className="rounded-[38px] border border-[rgba(75,175,87,0.14)] bg-[linear-gradient(155deg,#FFFFFF_0%,#F4FAF5_100%)] p-5 shadow-[0_30px_70px_rgba(75,175,87,0.14)] sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="max-w-2xl">
                <SectionLabel>FAMILY MONEY LITERACY</SectionLabel>
                <h1 className="mt-5 text-[2rem] font-black leading-[1.25] tracking-[-0.03em] text-[#1F2D20] sm:text-[2.8rem] lg:text-[3.6rem]">
                  お金の
                  <span className="relative mx-2 inline-block text-[#4BAF57]">
                    大切さ
                    <span className="absolute inset-x-0 bottom-1 h-3 rounded-full bg-[#F6B62B]/35" />
                  </span>
                  を、親子で楽しく学ぼう。
                </h1>
                <p className="mt-6 max-w-xl text-base leading-8 text-[#516251] sm:text-lg">
                  お小遣いを通じて、使う・貯める・増やすを体験できる、親子のためのマネーリテラシーアプリ。
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <MarketingButton href={registerHref} variant="primary">
                    無料ではじめる
                  </MarketingButton>
                  <MarketingButton href={loginHref} variant="secondary">
                    ログイン
                  </MarketingButton>
                </div>
              </div>

              <div className="relative">
                <div className="relative overflow-hidden rounded-[32px] border border-[rgba(75,175,87,0.12)] bg-white p-3 shadow-[0_20px_44px_rgba(75,175,87,0.10)] sm:p-4">
                  <div className="relative overflow-hidden rounded-[28px] bg-[#E8F5E9]">
                    <Image
                      src="/assets/lp/hero-family.png"
                      alt="親子でファミマネを使っているイメージ"
                      width={800}
                      height={600}
                      className="h-auto w-full object-cover"
                      priority
                    />
                    <div className="absolute right-3 top-3 max-w-[160px] rounded-[18px] bg-white/96 px-4 py-3 text-center text-sm font-bold leading-6 text-[#378C41] shadow-[0_16px_36px_rgba(31,45,32,0.12)] sm:right-4 sm:top-4 sm:max-w-[180px]">
                      一緒に考えて、
                      <br />
                      一緒に学ぶ。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["選ぶ体験", "すぐにもらう・投資する"],
                ["見える化", "増え方・減り方がひと目でわかる"],
                ["親子の会話", "お金のことを自然に話せる"],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-[rgba(75,175,87,0.12)] bg-white/88 px-4 py-4 shadow-[0_16px_36px_rgba(75,175,87,0.08)] backdrop-blur"
                >
                  <p className="text-sm font-extrabold text-[#1F2D20]">{title}</p>
                  <p className="mt-2 text-xs leading-6 text-[#516251]">{body}</p>
                </div>
              ))}
            </div>
          </div>

          {showLoginForm ? (
            <div
              id="login-form"
              className="mx-auto mt-8 w-full max-w-2xl rounded-[32px] border border-[rgba(55,140,65,0.14)] bg-white p-6 shadow-[0_30px_70px_rgba(75,175,87,0.14)] sm:p-8"
            >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold tracking-[0.16em] text-[#4BAF57]">
                      LOGIN
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-[#1F2D20]">ログイン</h2>
                    <p className="mt-3 text-sm leading-7 text-[#516251]">
                      招待を受け取った方は、メールに記載されたパスワードで初回ログインをしてください。
                    </p>
                  </div>
                  <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#F4FAF5] text-xl sm:flex">
                    🔐
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm font-medium text-[#1F2D20]">
                    メールアドレス
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
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
                      onChange={(event) => setPassword(event.target.value)}
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

                <div className="mt-5 flex flex-col gap-3 text-sm">
                  <Link
                    href={forgotPasswordHref}
                    className="font-medium text-[#516251] underline underline-offset-4 transition hover:text-[#378C41]"
                  >
                    パスワードを忘れた方はこちら
                  </Link>
                  <Link
                    href={registerHref}
                    className="font-medium text-[#516251] underline underline-offset-4 transition hover:text-[#378C41]"
                  >
                    新規登録はこちら
                  </Link>
                  <p className="leading-7 text-[#7A8D7A]">
                    既存アカウントで初回パスワードが未設定の場合は、管理者に初期パスワード設定を依頼してください。
                  </p>
                </div>

                {errorMessage ? (
                  <p className="mt-4 rounded-2xl border border-[rgba(220,107,90,0.22)] bg-[rgba(255,242,238,0.92)] px-4 py-3 text-sm text-[#C45C48]">
                    {errorMessage}
                  </p>
                ) : null}
            </div>
          ) : null}
        </MarketingSection>

        <MarketingSection className="pt-8 lg:pt-12">
          <div className="rounded-[36px] bg-[#FFF8E1] px-6 py-8 shadow-[0_24px_60px_rgba(246,182,43,0.10)] sm:px-10">
            <SectionLabel>よくある悩み</SectionLabel>
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <blockquote className="rounded-r-[28px] border-l-[6px] border-[#F6B62B] bg-white/75 px-5 py-5 text-xl font-black leading-9 text-[#1F2D20] sm:text-2xl">
                「お金のことを教えたいけれど、
                <br />
                何から話せばいいかわからない」
              </blockquote>
              <div className="space-y-4 text-sm leading-8 text-[#516251] sm:text-base">
                <p>
                  ファミマネは、親が一方的に教えるのではなく、
                  <strong className="font-bold text-[#1F2D20]"> 一緒に選んで、一緒に見る </strong>
                  体験を通じて、お金の感覚を育てていくサービスです。
                </p>
                <p>
                  「すぐにもらう」「投資する」を親子で話しながら選ぶから、
                  将来のことや目標のことも自然に会話のきっかけになります。
                </p>
              </div>
            </div>
          </div>
        </MarketingSection>

        <MarketingSection>
          <div className="text-center">
            <SectionLabel>できること 3 ポイント</SectionLabel>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
              お小遣い体験が、
              <span className="text-[#4BAF57]">学びのきっかけ</span>
              になる
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-8 text-[#516251] sm:text-base">
              親が渡して終わりではなく、子どもが自分で選び、結果を見て、親子で話せる流れをつくります。
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <FeatureCard
              imageSrc="/assets/lp/icon-choice.png"
              imageAlt="お小遣いの選び方を学べるイメージ"
              title="お小遣いを渡して、選び方を学べる"
              description="親が渡したお小遣いを、子どもが「すぐにもらう」「投資する」から自分で選べます。"
            />
            <FeatureCard
              imageSrc="/assets/lp/icon-visualize.png"
              imageAlt="お金の流れを見える化できるイメージ"
              title="お金の流れを見える化できる"
              description="受け取ったお金、投資中のお金、増えた・減った結果を、子どもにもわかりやすく確認できます。"
            />
            <FeatureCard
              imageSrc="/assets/lp/icon-conversation.png"
              imageAlt="親子の会話につながるイメージ"
              title="親子で会話しながら学ぶきっかけに"
              description="お金の選択を通じて、将来のことや目標について親子で自然に話せます。"
            />
          </div>
          <div className="mt-5 rounded-[30px] border border-[rgba(75,175,87,0.14)] bg-[linear-gradient(140deg,rgba(244,250,245,0.98),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_40px_rgba(75,175,87,0.08)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[rgba(76,163,104,0.14)] text-[#378C41]">
                <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8">
                  <path d="M4 12.5 8.5 17 20 6.5" />
                  <path d="M12 3 5 6v5.2c0 4.5 3 7.2 7 8.8 4-1.6 7-4.3 7-8.8V6Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-extrabold leading-8 text-[#1F2D20]">
                  サービスに入金しないから、安心して使える
                </h3>
                <p className="mt-3 text-sm leading-8 text-[#516251] sm:text-base">
                  ファミマネは、サービス内にお金を預ける仕組みではありません。子どもから申請が届いたあと、
                  親が直接お金を渡して完了するので、家庭のペースで安心して使えます。
                </p>
              </div>
            </div>
          </div>
        </MarketingSection>

        <MarketingSection className="bg-[#F7FBF7]">
          <div className="text-center">
            <SectionLabel>使い方 3 ステップ</SectionLabel>
            <h2 className="mt-5 text-3xl font-black text-[#1F2D20] sm:text-4xl">
              はじめる流れは、
              <span className="text-[#4BAF57]">シンプル</span>
            </h2>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <StepCard
              step="01"
              title="親がお小遣いを登録する"
              description="渡す金額や日にちを決めて、子どもに渡すお小遣いをアプリに登録します。"
            />
            <StepCard
              step="02"
              title="子どもが受け取り方を選ぶ"
              description="子どもは「すぐにもらう」か「投資する」かを自分で選びながら体験できます。"
            />
            <StepCard
              step="03"
              title="結果を見て親子で話す"
              description="増えた・減った結果を見ながら、使い方や貯め方、これからの目標を話せます。"
            />
          </div>
        </MarketingSection>

        <MarketingSection>
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <SectionLabel>アプリ画面</SectionLabel>
              <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
                子どもにも、
                <span className="text-[#4BAF57]">わかりやすい見た目</span>
              </h2>
              <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
                今いくらあるか、まだ決めていないお小遣いがあるか、投資中のお金がどう動いたかを、
                やさしい言葉と整理された画面で確認できます。
              </p>
              <ul className="mt-6 grid gap-3">
                {[
                  "いまのお小遣い総額を大きく表示",
                  "未選択・投資中・支払い済みを整理して見える化",
                  "子どもが迷わないよう、やることを上から順に案内",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-[22px] border border-[rgba(75,175,87,0.12)] bg-white px-4 py-4 text-sm leading-7 text-[#516251] shadow-[0_14px_34px_rgba(75,175,87,0.08)]"
                  >
                    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-xs font-black text-[#378C41]">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-[430px] rounded-[42px] border border-[rgba(31,45,32,0.08)] bg-[linear-gradient(180deg,#FFFFFF_0%,#F4FAF5_100%)] p-3 shadow-[0_30px_70px_rgba(31,45,32,0.12)] sm:p-4">
                <div className="overflow-hidden rounded-[30px] bg-white">
                  <Image
                    src="/assets/lp/app-mockup.png"
                    alt="ファミマネのアプリ画面モック"
                    width={540}
                    height={960}
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </MarketingSection>

        <MarketingSection className="pb-20">
          <div className="rounded-[40px] bg-[linear-gradient(135deg,#4BAF57_0%,#378C41_100%)] px-6 py-10 text-white shadow-[0_28px_70px_rgba(55,140,65,0.24)] sm:px-10 sm:py-12 lg:px-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <SectionLabel>はじめてみる</SectionLabel>
                <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
                  親子で、お金の話を
                  <br />
                  自然にはじめられる。
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-white/88 sm:text-base">
                  お小遣いの選び方を通じて、使う・貯める・増やすを一緒に体験しませんか。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <MarketingButton href={registerHref} variant="secondary" className="border-white/30 bg-white text-[#378C41] hover:bg-[#F4FAF5]">
                  無料ではじめる
                </MarketingButton>
                <MarketingButton href={loginHref} variant="ghost" className="border-white/55 text-white hover:bg-white/10">
                  ログイン
                </MarketingButton>
              </div>
            </div>
          </div>
        </MarketingSection>
      </main>

      <footer className="bg-[#2F6F3A] px-5 py-10 text-white sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              src="/assets/lp/logo-white.png"
              alt="ファミマネ"
              width={220}
              height={64}
              className="h-12 w-auto"
            />
            <p className="mt-4 max-w-md text-sm leading-7 text-white/78">
              お小遣い体験を通じて、親子で使う・貯める・増やすを学べるマネーリテラシーアプリ。
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/80 sm:items-end">
            <Link href={loginHref} className="transition hover:text-white">
              ログイン
            </Link>
            <Link href={registerHref} className="transition hover:text-white">
              無料ではじめる
            </Link>
            <p className="leading-7 text-white/75">
              <LegalLinks linkClassName="underline underline-offset-4 transition hover:text-white" />
            </p>
            <p className="text-white/60">© {new Date().getFullYear()} ファミマネ</p>
          </div>
        </div>
      </footer>
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
