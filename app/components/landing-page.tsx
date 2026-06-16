import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Coins,
  Gift,
  LineChart,
  ListChecks,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { LegalLinks } from "@/app/components/ui/legal-links";
import LpAnnouncements from "@/app/components/lp-announcements";

// ─── デザイントークン（design.md / famimane-design-md 準拠）──────────────────
// このLP配下だけに適用する CSS 変数。globals.css（アプリ全体）には触れない。
// クラスからは bg-[var(--green-600)] / text-[var(--ink-900)] のように参照する。
const TOKENS = {
  "--green-50": "#EAF6EF",
  "--green-100": "#D3ECDD",
  "--green-200": "#A9DABF",
  "--green-300": "#7FC79F",
  "--green-400": "#54B27D",
  "--green-500": "#2E9E63",
  "--green-600": "#258552",
  "--green-700": "#1E6B43",
  "--green-800": "#14512F",
  "--amber-50": "#FDF6E6",
  "--amber-100": "#FBEBC4",
  "--amber-300": "#F4CE78",
  "--amber-400": "#EFB23F",
  "--amber-500": "#E5972A",
  "--sky-100": "#DCEEF6",
  "--sky-400": "#5BB4D6",
  "--sky-600": "#2E7C9E",
  "--ink-900": "#1F2A23",
  "--ink-700": "#3A463E",
  "--ink-500": "#6B7B72",
  "--ink-300": "#A7B2AB",
  "--line": "#E3EAE5",
  "--base": "#F4F8F5",
  "--surface": "#FFFFFF",
  "--danger": "#E5654B",
  "--sh-card": "0 2px 8px rgba(31,42,35,0.06)",
  "--sh-float": "0 6px 20px rgba(31,42,35,0.10)",
  "--sh-pop": "0 10px 30px rgba(46,158,99,0.18)",
} as CSSProperties;

// ─── 共通パーツ ────────────────────────────────────────────────────────────

function MarketingButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "reward" | "ghost";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-[var(--green-600)] text-white shadow-[var(--sh-pop)] hover:bg-[var(--green-700)]"
      : variant === "reward"
        ? "bg-[var(--amber-500)] text-white hover:brightness-[0.96]"
        : variant === "secondary"
          ? "bg-white text-[var(--green-600)] border-[1.5px] border-[var(--green-200)] hover:bg-[var(--green-50)]"
          : "bg-transparent text-white border-[1.5px] border-white/60 hover:bg-white/10";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] px-7 text-[15px] font-bold transition duration-150 ${variantClass} ${className}`}
    >
      {children}
    </Link>
  );
}

// セクション見出し（左右に短い緑のライン）
function SectionHead({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center justify-center gap-3 text-center text-[24px] font-bold text-[var(--green-600)]">
      <span aria-hidden className="h-0.5 w-6 rounded-full bg-[var(--green-300)]" />
      {children}
      <span aria-hidden className="h-0.5 w-6 rounded-full bg-[var(--green-300)]" />
    </h2>
  );
}

function SectionSub({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-center text-[14px] text-[var(--ink-500)]">{children}</p>
  );
}

// イラスト枠（対応する実PNGを表示。装飾用途のため alt は空）
function Illust({
  src,
  className = "",
  imgClassName = "object-contain",
}: {
  src: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <span className={`flex items-center justify-center overflow-hidden ${className}`}>
      <Image
        src={src}
        alt=""
        aria-hidden
        width={256}
        height={256}
        className={`h-full w-full ${imgClassName}`}
      />
    </span>
  );
}

// ─── データ ────────────────────────────────────────────────────────────────

const HERO_FEATURES: { Icon: LucideIcon; label: string; bg: string; stroke: string }[] = [
  { Icon: ClipboardList, label: "お手伝い", bg: "var(--green-100)", stroke: "var(--green-500)" },
  { Icon: Coins, label: "おこづかい", bg: "var(--amber-100)", stroke: "var(--amber-500)" },
  { Icon: LineChart, label: "投資", bg: "var(--green-100)", stroke: "var(--green-500)" },
  { Icon: Newspaper, label: "ニュース", bg: "var(--sky-100)", stroke: "var(--sky-400)" },
];

const PROBLEMS = [
  { img: "/images/lp/generated/problem-allowance.png", title: "おこづかい、どう渡す？", desc: "金額や渡し方に迷う。記録もつい忘れてしまう。" },
  { img: "/images/lp/generated/problem-investment.png", title: "投資ってむずかしそう", desc: "子どもにどう教えればいいか分からない。" },
  { img: "/images/lp/generated/problem-task.png", title: "お手伝いが続かない", desc: "ごほうびにしても、なかなか定着しない。" },
];

const FLOW_STEPS = [
  { num: "1", img: "/images/lp/generated/flow-do.png", title: "お手伝いをタスクにする", desc: "お手伝いや宿題を、タスクとして登録！" },
  { num: "2", img: "/images/lp/generated/flow-receive.png", title: "おこづかいを渡す", desc: "タスクができたら、ごほうびのおこづかい！" },
  { num: "3", img: "/images/lp/generated/flow-choose.png", title: "投資先を選ぶ", desc: "もらったおこづかいを、投資にまわすことも！" },
  { num: "4", img: "/images/lp/generated/flow-learn.png", title: "ニュースやチャートで学ぶ", desc: "やさしい解説で、お金や投資の知識が身につく！" },
];

const JOURNEY = [
  { img: "/images/character/mirakun-study.png", label: "お手伝い・宿題をする" },
  { img: "/images/character/mirakun-money.png", label: "おこづかいをもらう" },
  { img: "/images/character/mirakun-chart.png", label: "投資やニュースで学ぶ！" },
];

const THEMES = [
  { img: "/images/lp/generated/invest-theme-car.png", label: "自動車" },
  { img: "/images/lp/generated/invest-theme-entertainment.png", label: "エンタメ" },
  { img: "/images/lp/generated/invest-theme-game.png", label: "ゲーム" },
  { img: "/images/lp/generated/invest-theme-global.png", label: "世界企業" },
  { img: "/images/lp/generated/invest-theme-tech.png", label: "テクノロジー" },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div
      style={TOKENS}
      className="min-h-screen bg-[var(--base)] font-sans text-[var(--ink-700)]"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] w-full max-w-[1040px] items-center justify-between px-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/lp/logo.png"
              alt="ミラマネ"
              width={180}
              height={54}
              className="h-9 w-auto sm:h-10"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-[14px] font-medium text-[var(--ink-700)] transition hover:text-[var(--green-600)] sm:inline"
            >
              ログイン
            </Link>
            <MarketingButton href="/register" variant="primary" className="min-h-10 px-5 text-[14px]">
              無料ではじめる
            </MarketingButton>
          </div>
        </div>
      </header>

      <main>
        {/* 01 HERO ── miramane-lp-hero.png を背景に、コピーをオーバーレイ。
            lg+: 画像を全面背景にして左側にコピー（左→右の明スクリムで可読性確保）。
            〜lg: 画像の右側を上部バナーで見せ、下段にコピーを縦積み（添付の挙動）。 */}
        <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--green-50)_0%,var(--base)_100%)]">
          {/* デスクトップ：画像を中央寄せ max-w-[1040px] コンテナ内に閉じ込める。
              右端は下の「お悩み」3カードの右端と揃い、これより右へは追随しない。
              object-contain なので上下も切れない。+ 左スクリムでコピーを可読に。 */}
          <div aria-hidden className="absolute inset-0 hidden lg:block">
            <div className="relative mx-auto h-full w-full max-w-[1040px] px-5">
              <Image
                src="/images/lp/miramane-lp-hero.png"
                alt=""
                fill
                sizes="1040px"
                priority
                className="object-contain object-right"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--base)_0%,rgba(244,248,245,0.78)_24%,rgba(244,248,245,0)_50%)]" />
            </div>
          </div>

          {/* モバイル/タブレット：上部バナー。被写体（ミラくん＋スマホ＋¥0）が
              ある右側だけを切り出して表示する（縦横比固定 + 右寄せクロップ）。 */}
          <div className="relative aspect-[6/5] w-full overflow-hidden lg:hidden">
            <Image
              src="/images/lp/miramane-lp-hero.png"
              alt="家族でお金を学ぶマネーリテラシーアプリ「ミラマネ」のイメージ。ミラくんとアプリ画面。"
              fill
              priority
              sizes="100vw"
              className="object-cover object-right"
            />
          </div>

          {/* コピー */}
          <div className="relative mx-auto w-full max-w-[1040px] px-5 pb-12 pt-7 lg:min-h-[540px] lg:py-20">
            <div className="lg:max-w-[510px]">
              <span className="inline-block rounded-full bg-[var(--green-100)] px-4 py-1.5 text-[13px] font-semibold text-[var(--green-700)]">
                家族でお金を学ぶ マネーリテラシーアプリ
              </span>
              <h1 className="mt-4 text-[32px] font-bold leading-[1.32] tracking-[-0.01em] text-[var(--ink-900)] sm:text-[42px]">
                お金の<span className="text-[var(--green-500)]">大切さ</span>を、
                <br />
                親子で<span className="text-[var(--amber-500)]">楽しく学</span>ぼう。
              </h1>

              <div className="mt-6 flex flex-wrap gap-4">
                {HERO_FEATURES.map(({ Icon, label, bg, stroke }) => (
                  <div key={label} className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink-700)]">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                      style={{ background: bg }}
                    >
                      <Icon className="h-[18px] w-[18px]" style={{ color: stroke }} strokeWidth={1.8} aria-hidden />
                    </span>
                    {label}
                  </div>
                ))}
              </div>

              <p className="mt-5 text-[15px] leading-7 text-[var(--ink-700)]">
                お手伝い・宿題・おこづかい・投資・ニュース。
                <br className="hidden sm:block" />
                親子の日常から、お金を学ぶきっかけをつくります。
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3.5">
                <MarketingButton href="/register" variant="primary" className="min-h-13 px-7 text-base">
                  ¥0&nbsp;&nbsp;無料ではじめる
                </MarketingButton>
                <MarketingButton href="/login" variant="secondary" className="min-h-13 px-7 text-base">
                  ログイン
                </MarketingButton>
              </div>
              <p className="mt-3.5 text-[12px] tracking-wider text-[var(--ink-500)]">
                ＼ 登録も利用もすべて無料！ ／
              </p>
            </div>
          </div>
        </section>

        {/* 02 PROBLEM */}
        <section className="py-14">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <SectionHead>こんなお悩み、ありませんか？</SectionHead>
            <SectionSub>
              ミラマネは、親子のお金にまつわる「困った」をいっしょに解決します。
            </SectionSub>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <article
                  key={p.title}
                  className="rounded-[16px] bg-[var(--surface)] p-6 text-center shadow-[var(--sh-card)]"
                >
                  <Illust src={p.img} className="mx-auto h-26 w-26 rounded-full bg-[var(--green-50)]" />
                  <h3 className="mt-4 text-[16px] font-bold text-[var(--ink-900)]">{p.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-6 text-[var(--ink-500)]">{p.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 03 STEPS */}
        <section className="pb-14">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <SectionHead>ミラマネでできること</SectionHead>
            <SectionSub>4つのステップで、お金の学びが自然と身につきます。</SectionSub>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FLOW_STEPS.map((s) => (
                <article
                  key={s.num}
                  className="rounded-[16px] bg-[var(--surface)] p-5 shadow-[var(--sh-card)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--green-500)] text-[14px] font-bold text-white">
                    {s.num}
                  </span>
                  <Illust src={s.img} className="mt-3 h-24 w-full rounded-[12px] bg-[var(--green-50)]" />
                  <h3 className="mt-3.5 text-[15px] font-bold leading-snug text-[var(--ink-900)]">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--ink-500)]">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 04 JOURNEY band */}
        <section className="pb-14">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <div className="rounded-[28px] bg-[linear-gradient(135deg,var(--green-50),var(--green-100))] px-8 py-9 sm:px-9">
              <div className="grid items-center gap-7 lg:grid-cols-[0.9fr_2fr]">
                <div>
                  <h2 className="text-[24px] font-bold leading-snug text-[var(--ink-900)] sm:text-[26px]">
                    おこづかいが、
                    <br />
                    学びにつながり、
                    <br />
                    未来につながる。
                  </h2>
                  <p className="mt-3 text-[14px] leading-7 text-[var(--ink-700)]">
                    親子で「使う・貯める・増やす」を、いっしょに体験しよう。
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {JOURNEY.map((j, i) => (
                    <div key={j.label} className="flex flex-1 items-center gap-2.5">
                      <div className="flex-1 rounded-[16px] bg-white p-4 text-center shadow-[var(--sh-card)]">
                        <Illust src={j.img} className="mx-auto h-22 w-full" />
                        <span className="mt-2.5 block text-[12px] font-semibold text-[var(--ink-700)]">
                          {j.label}
                        </span>
                      </div>
                      {i < JOURNEY.length - 1 && (
                        <ArrowRight
                          className="hidden h-5 w-5 shrink-0 text-[var(--green-500)] sm:block"
                          strokeWidth={2}
                          aria-hidden
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 05 FEATURES（コードUI） */}
        <section className="pb-14">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <SectionHead>主な機能</SectionHead>
            <SectionSub>
              実際の画面は、こんな感じ。シンプルで、子どもにもわかりやすい設計です。
            </SectionSub>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* タスク */}
              <FeatureCard
                Icon={ListChecks}
                title="やること（タスク）"
                desc="お手伝いや宿題を設定して、できたらおこづかいを渡せます。"
              >
                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--base)] p-3">
                  {[
                    { t: "リビングを片付ける", rw: "+¥50" },
                    { t: "お皿を洗う", rw: "+¥100" },
                    { t: "宿題をする", rw: "+¥150" },
                  ].map((row) => (
                    <div
                      key={row.t}
                      className="flex items-center gap-2 border-b border-[var(--line)] py-2 text-[12px] text-[var(--ink-700)] last:border-b-0"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--green-500)]">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
                      </span>
                      {row.t}
                      <span className="ml-auto font-bold text-[var(--green-600)]">{row.rw}</span>
                    </div>
                  ))}
                </div>
              </FeatureCard>

              {/* チャート */}
              <FeatureCard
                Icon={LineChart}
                title="チャート機能"
                desc="投資先の値動きを、シンプルなグラフで見える化。気軽にチェック！"
              >
                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--base)] p-3">
                  <p className="text-[11px] text-[var(--ink-500)]">eMAXIS Slim 全世界株式</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[18px] font-bold text-[var(--ink-900)]">¥37,147</span>
                    <span className="text-[11px] font-bold text-[var(--green-600)]">+1.2% ↗︎</span>
                  </div>
                  <svg viewBox="0 0 220 64" className="mt-1.5 h-[58px] w-full" aria-hidden>
                    <polyline
                      fill="none"
                      stroke="var(--green-500)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points="0,50 30,46 60,48 90,36 120,40 150,24 180,26 220,12"
                    />
                    <polygon
                      fill="var(--green-500)"
                      opacity="0.08"
                      points="0,50 30,46 60,48 90,36 120,40 150,24 180,26 220,12 220,64 0,64"
                    />
                  </svg>
                </div>
              </FeatureCard>

              {/* ニュース */}
              <FeatureCard
                Icon={Newspaper}
                title="ミラマネニュース"
                desc="お金や投資のニュースを、子どもにもわかりやすくお届け！"
              >
                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--base)] p-3">
                  {[
                    { dot: "var(--amber-400)", t: "ダウ平均が下落？ 投資家のお金はどこへ移動した？" },
                    { dot: "var(--sky-400)", t: "円高・円安ってどういうこと？ やさしく解説！" },
                  ].map((n) => (
                    <div
                      key={n.t}
                      className="flex items-start gap-2 border-b border-[var(--line)] py-2 text-[11px] leading-5 text-[var(--ink-700)] last:border-b-0"
                    >
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: n.dot }}
                      />
                      {n.t}
                    </div>
                  ))}
                </div>
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* 06 REWARD + THEMES（amber） */}
        <section className="pb-14">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <div className="rounded-[20px] bg-[linear-gradient(135deg,var(--amber-50),var(--amber-100))] px-8 py-8">
              <div className="mb-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-white shadow-[var(--sh-card)]">
                  <Gift className="h-7 w-7 text-[var(--amber-500)]" strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[20px] font-bold text-[var(--ink-900)]">
                    投資先は、これからどんどんアップデート！
                  </h3>
                  <p className="mt-1 text-[14px] leading-7 text-[var(--ink-700)]">
                    身近な会社やテーマを追加予定。子どもの興味に合わせて、学びの幅が広がります。
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {THEMES.map((t) => (
                  <div key={t.label} className="rounded-[12px] bg-white/75 p-3.5 text-center">
                    <Illust src={t.img} className="mx-auto h-14 w-14 rounded-[10px] bg-white" />
                    <span className="mt-2 block text-[11px] font-semibold text-[var(--ink-700)]">
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 07 ONE POINT */}
        <section className="pb-14">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <div className="flex flex-col items-center gap-6 rounded-[20px] bg-[var(--green-50)] px-7 py-6 text-center sm:flex-row sm:text-left">
              <Illust
                src="/images/character/mirakun-happy.png"
                className="h-28 w-24 shrink-0"
              />
              <div>
                <span className="inline-block rounded-full bg-[var(--amber-100)] px-3 py-1 text-[12px] font-bold text-[var(--amber-500)]">
                  ワンポイント
                </span>
                <h4 className="mt-2 text-[16px] font-bold leading-relaxed text-[var(--ink-900)]">
                  おこづかいの使い方を見直すことで、将来に役立つお金の習慣が身につきます。
                </h4>
                <p className="mt-1 text-[13.5px] text-[var(--ink-700)]">
                  ミラマネと一緒に、楽しく学んでいきましょう。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 08 UPDATES（DBの公開お知らせ。0件時は非表示） */}
        <LpAnnouncements />

        {/* 09 FINAL CTA */}
        <section className="pb-16">
          <div className="mx-auto w-full max-w-[1040px] px-5">
            <div className="flex flex-col items-center gap-6 rounded-[28px] bg-[linear-gradient(135deg,var(--green-100),var(--green-50))] px-8 py-9 text-center sm:flex-row sm:text-left">
              <Illust src="/images/character/mirakun-cheer.png" className="h-30 w-24 shrink-0" />
              <div className="flex-1">
                <h3 className="text-[22px] font-bold text-[var(--ink-900)]">
                  おこづかいを渡すだけで、終わらない。
                </h3>
                <p className="mt-1.5 text-[14px] leading-7 text-[var(--ink-700)]">
                  親子で「使う・貯める・増やす・学ぶ」を、いっしょに体験してみませんか！
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <MarketingButton href="/register" variant="primary" className="min-h-12 px-7">
                  ¥0&nbsp;&nbsp;無料ではじめる
                </MarketingButton>
                <MarketingButton href="/login" variant="secondary" className="min-h-12 px-7">
                  ログイン
                </MarketingButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--line)] bg-[var(--surface)] py-8">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              src="/assets/lp/logo.png"
              alt="ミラマネ"
              width={180}
              height={54}
              className="h-9 w-auto"
            />
            <p className="mt-3 max-w-md text-[13px] leading-7 text-[var(--ink-500)]">
              お手伝いやおこづかいを通じて、親子で「使う・貯める・考える・学ぶ」を体験できるアプリ。
            </p>
          </div>
          <div className="flex flex-col gap-2.5 text-[13px] text-[var(--ink-500)] sm:items-end">
            <Link href="/login" className="transition hover:text-[var(--green-600)]">
              ログイン
            </Link>
            <Link href="/register" className="transition hover:text-[var(--green-600)]">
              無料ではじめる
            </Link>
            <p className="leading-7">
              <LegalLinks linkClassName="underline underline-offset-4 transition hover:text-[var(--green-600)]" />
            </p>
            <p className="text-[var(--ink-300)]">© {new Date().getFullYear()} ミラマネ</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── FEATURES カード ────────────────────────────────────────────────────────
function FeatureCard({
  Icon,
  title,
  desc,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-[16px] bg-[var(--surface)] p-5 shadow-[var(--sh-card)]">
      <div className="mb-2 flex items-center gap-2 text-[17px] font-bold text-[var(--ink-900)]">
        <Icon className="h-5 w-5 text-[var(--green-500)]" strokeWidth={1.8} aria-hidden />
        {title}
      </div>
      <p className="mb-4 flex-1 text-[13.5px] leading-6 text-[var(--ink-500)]">{desc}</p>
      {children}
    </article>
  );
}
