import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Car,
  Check,
  ClipboardList,
  Coins,
  Gamepad2,
  GitFork,
  Globe,
  LineChart,
  ListChecks,
  Music,
  Newspaper,
  Search,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LegalLinks } from "@/app/components/ui/legal-links";
import LpAnnouncements from "@/app/components/lp-announcements";

// ─── 生成イラストの差し替えスイッチ ──────────────────────────────────────────
// Codex CLI imagegen で /public/images/lp/generated/ に PNG を生成したら、
// この値を true にするだけで、各セクションの lucide アイコンが生成PNGに切り替わる。
// （PNG未生成の現状は false = lucide アイコンで表示。絵文字は一切使わない）
const USE_GENERATED_ILLUSTRATIONS: boolean = true;

// アイコン枠。生成PNGがあればそれを、無ければ lucide アイコンを表示する。
function Illustration({
  src,
  Icon,
  boxClassName = "",
  iconClassName = "",
}: {
  src: string;
  Icon: LucideIcon;
  boxClassName?: string;
  iconClassName?: string;
}) {
  return (
    <span className={`flex items-center justify-center ${boxClassName}`}>
      {USE_GENERATED_ILLUSTRATIONS ? (
        <Image
          src={src}
          alt=""
          aria-hidden
          width={512}
          height={512}
          className="h-full w-full object-contain"
        />
      ) : (
        <Icon className={iconClassName} strokeWidth={1.6} aria-hidden />
      )}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    <section id={id} className={`px-5 py-12 sm:px-8 lg:px-10 lg:py-16 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

// スマホ画面スクリーンショットを並べる枠（画面そのものは作り直さない）
function PhoneFrame({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="w-full max-w-[380px] rounded-[40px] border border-[rgba(31,45,32,0.08)] bg-[linear-gradient(180deg,#FFFFFF_0%,#F4FAF5_100%)] p-3 shadow-[0_36px_80px_rgba(31,45,32,0.16)] sm:p-4">
        <div className="overflow-hidden rounded-[30px] bg-white">
          <Image
            src={src}
            alt={alt}
            width={540}
            height={1080}
            className="h-auto w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

// ─── データ ────────────────────────────────────────────────────────────────

const PROBLEMS = [
  { img: "/images/lp/generated/problem-allowance.png", Icon: Wallet, text: "おこづかいを渡しているけど、\n学びにつながっているか分からない" },
  { img: "/images/lp/generated/problem-investment.png", Icon: Search, text: "投資やお金の話を、\nどう伝えたらいいか分からない" },
  { img: "/images/lp/generated/problem-task.png", Icon: ListChecks, text: "お手伝いや宿題を、\n前向きに続けてほしい" },
];

const FLOW_STEPS: { step: string; title: string; desc: string; img: string; Icon: LucideIcon }[] = [
  { step: "01", title: "やる", desc: "お手伝いや宿題を、親子でタスクにする", img: "/images/lp/generated/flow-do.png", Icon: ClipboardList },
  { step: "02", title: "もらう", desc: "できたら、ごほうびとしておこづかい", img: "/images/lp/generated/flow-receive.png", Icon: Coins },
  { step: "03", title: "選ぶ", desc: "すぐにもらう？ 投資にまわす？", img: "/images/lp/generated/flow-choose.png", Icon: GitFork },
  { step: "04", title: "学ぶ", desc: "ニュースやチャートで、お金の動きを知る", img: "/images/lp/generated/flow-learn.png", Icon: BookOpen },
];

const INVEST_THEMES = [
  { img: "/images/lp/generated/invest-theme-game.png", Icon: Gamepad2, label: "ゲーム" },
  { img: "/images/lp/generated/invest-theme-car.png", Icon: Car, label: "自動車" },
  { img: "/images/lp/generated/invest-theme-global.png", Icon: Globe, label: "世界企業" },
  { img: "/images/lp/generated/invest-theme-entertainment.png", Icon: Music, label: "エンタメ" },
  { img: "/images/lp/generated/invest-theme-tech.png", Icon: Smartphone, label: "テクノロジー" },
];

const INVEST_POINTS: { Icon: LucideIcon; t: string; d: string }[] = [
  { Icon: LineChart, t: "値動きを見る", d: "上がる・下がるを体感する" },
  { Icon: Brain, t: "なぜ動くか考える", d: "理由を親子で話し合う" },
  { Icon: Newspaper, t: "ニュースを読む", d: "社会のしくみを知る" },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F4FAF5_0%,#FFFFFF_14%,#FFFFFF_100%)] text-[#1F2D20]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(55,140,65,0.10)] bg-[rgba(255,255,255,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/lp/logo.png"
              alt="ミラマネ"
              width={180}
              height={54}
              className="h-10 w-auto sm:h-12"
              priority
            />
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <MarketingButton href="/login" variant="secondary" className="min-h-11 px-5">
              ログイン
            </MarketingButton>
            <MarketingButton href="/register" variant="primary" className="min-h-11 px-5">
              無料ではじめる
            </MarketingButton>
          </div>
          {/* Mobile header buttons */}
          <div className="flex items-center gap-2 sm:hidden">
            <MarketingButton href="/login" variant="secondary" className="min-h-10 px-4 text-xs">
              ログイン
            </MarketingButton>
            <MarketingButton href="/register" variant="primary" className="min-h-10 px-4 text-xs">
              登録
            </MarketingButton>
          </div>
        </div>
      </header>

      <main>
        {/* 01 HERO ── hero-visual.png にコピー・ミラくん・UI・¥0が含まれるため、
            同じコピーをHTML側で重複表示しない。画像の下にCTAと無料訴求のみ置く。 */}
        <MarketingSection className="overflow-hidden pb-8 pt-6 sm:pt-8 lg:pb-10 lg:pt-10">
          <div className="overflow-hidden rounded-[36px] border border-[rgba(75,175,87,0.16)] bg-white shadow-[0_44px_100px_rgba(75,175,87,0.22)]">
            <Image
              src="/images/lp/hero-visual.png"
              alt="家族でお金を学ぶマネーリテラシーアプリ「ミラマネ」。お金の大切さを、親子で楽しく学ぼう。"
              width={1600}
              height={900}
              className="h-auto w-full object-contain"
              priority
            />
          </div>

          <div className="mt-7 flex flex-col items-center gap-5">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <MarketingButton href="/register" variant="primary" className="min-h-14 px-12 text-base">
                無料ではじめる
              </MarketingButton>
              <MarketingButton href="/login" variant="secondary" className="min-h-14 px-12 text-base">
                ログイン
              </MarketingButton>
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-2.5">
              {["登録無料", "利用料無料", "広告表示なし"].map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full bg-[#E8F5E9] px-4 py-2 text-sm font-bold text-[#1F2D20]"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#4BAF57] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </MarketingSection>

        {/* 02 共感セクション ── アイコンは lucide / 生成PNGに自動切替。高さを抑え2行に */}
        <MarketingSection className="pt-4 lg:pt-6">
          <div className="text-center">
            <SectionLabel>こんなお悩み</SectionLabel>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
              こんなお悩み、ありませんか？
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((card) => (
              <article
                key={card.text}
                className="flex items-center gap-4 rounded-[22px] border border-[rgba(55,140,65,0.12)] bg-white p-5 shadow-[0_14px_36px_rgba(75,175,87,0.08)]"
              >
                <Illustration
                  src={card.img}
                  Icon={card.Icon}
                  boxClassName="h-14 w-14 shrink-0 rounded-2xl bg-[#F4FAF5]"
                  iconClassName="h-7 w-7 text-[#4BAF57]"
                />
                <p className="whitespace-pre-line text-sm font-bold leading-7 text-[#1F2D20]">
                  {card.text}
                </p>
              </article>
            ))}
          </div>
        </MarketingSection>

        {/* 03 お手伝いが学びに変わる（主役・体験フロー）
            PC: 横4カード＋矢印 / モバイル: コンパクトなタイムライン */}
        <MarketingSection className="bg-[#F7FBF7]">
          <div className="text-center">
            <SectionLabel>ミラマネでできること</SectionLabel>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-[2.6rem]">
              お手伝いが、
              <span className="text-[#4BAF57]">学びに変わる</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[#516251] sm:text-base">
              「やる → もらう → 選ぶ → 学ぶ」。ひとつの体験の流れとしてつながっています。
            </p>
          </div>

          {/* PC: 横並びカード＋矢印 */}
          <div className="mt-9 hidden items-stretch gap-2 lg:flex">
            {FLOW_STEPS.map((s, i) => (
              <div key={s.step} className="flex flex-1 items-stretch">
                <article className="flex flex-1 flex-col items-center rounded-[24px] border border-[rgba(55,140,65,0.14)] bg-white p-6 text-center shadow-[0_18px_44px_rgba(75,175,87,0.10)]">
                  <Illustration
                    src={s.img}
                    Icon={s.Icon}
                    boxClassName="h-16 w-16 rounded-2xl bg-[#E8F5E9]"
                    iconClassName="h-8 w-8 text-[#378C41]"
                  />
                  <span className="mt-4 inline-flex h-7 items-center rounded-full bg-[#4BAF57] px-3 text-xs font-black text-white">
                    STEP {s.step}
                  </span>
                  <h3 className="mt-3 text-xl font-black text-[#1F2D20]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#516251]">{s.desc}</p>
                </article>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="flex items-center px-1 text-[#4BAF57]" aria-hidden>
                    <ArrowRight className="h-6 w-6" strokeWidth={2.4} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* モバイル: コンパクトなタイムライン */}
          <ol className="mt-8 space-y-3 lg:hidden">
            {FLOW_STEPS.map((s) => (
              <li
                key={s.step}
                className="flex items-center gap-3 rounded-[20px] border border-[rgba(55,140,65,0.14)] bg-white p-3.5 shadow-[0_12px_30px_rgba(75,175,87,0.08)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4BAF57] text-sm font-black text-white">
                  {s.step}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-[#1F2D20]">{s.title}</h3>
                  <p className="mt-0.5 text-xs leading-5 text-[#516251]">{s.desc}</p>
                </div>
                <Illustration
                  src={s.img}
                  Icon={s.Icon}
                  boxClassName="h-11 w-11 shrink-0 rounded-xl bg-[#E8F5E9]"
                  iconClassName="h-6 w-6 text-[#378C41]"
                />
              </li>
            ))}
          </ol>
        </MarketingSection>

        {/* 04 タスク機能 ── モバイルは テキスト→画像 の順 */}
        <MarketingSection>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>タスク機能</SectionLabel>
              <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
                お手伝いを、
                <span className="text-[#4BAF57]">タスクにできる</span>
              </h2>
              <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
                宿題やお皿洗い、お風呂掃除など、家庭のやることを登録。
                できたらおこづかいを渡せるので、お手伝いが自然と習慣になります。
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {["宿題をする", "お皿洗い", "お風呂掃除", "ゴミ出し"].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(75,175,87,0.18)] bg-white px-4 py-2 text-sm font-bold text-[#1F2D20] shadow-[0_10px_24px_rgba(75,175,87,0.08)]"
                  >
                    <Check className="h-4 w-4 text-[#4BAF57]" strokeWidth={3} aria-hidden />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <PhoneFrame src="/images/lp/lp-phone-task.png" alt="ミラマネのタスク機能の画面" />
          </div>
        </MarketingSection>

        {/* 05 おこづかい体験 */}
        <MarketingSection className="bg-[#F7FBF7]">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="flex justify-center">
              <Image
                src="/images/character/mirakun-money.png"
                alt="おこづかいを持ったミラくん"
                width={460}
                height={460}
                className="h-auto w-full max-w-[320px] object-contain sm:max-w-[380px]"
              />
            </div>
            <div>
              <SectionLabel>おこづかい体験</SectionLabel>
              <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
                おこづかいを渡して、
                <span className="text-[#4BAF57]">終わらない</span>
              </h2>
              <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
                受け取ったおこづかいを「いま使う」のか「投資してみる」のか、子どもが自分で考えて選びます。
                選ぶこと自体が、お金との付き合い方を学ぶ第一歩になります。
              </p>
              <div className="mt-6 rounded-[24px] border border-[rgba(75,175,87,0.14)] bg-white px-5 py-5 text-sm leading-8 text-[#516251] shadow-[0_14px_34px_rgba(75,175,87,0.08)]">
                サービス内にお金を預ける仕組みではありません。子どもの申請を受けて、
                <strong className="font-bold text-[#1F2D20]">親が直接お金を渡して完了</strong>
                するので、家庭のペースで安心して使えます。
              </div>
            </div>
          </div>
        </MarketingSection>

        {/* 06 投資体験 ── モバイルは テキスト→画像。3カードは lucide アイコン */}
        <MarketingSection>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>投資体験</SectionLabel>
              <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
                投資は、
                <span className="text-[#4BAF57]">学びの選択肢</span>
              </h2>
              <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
                ミラマネの投資は、儲けるためのものではありません。値動きを見て、なぜ動くのかを考え、
                お金や社会のしくみを学ぶための、教育目的のシミュレーションです。
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {INVEST_POINTS.map((p) => (
                  <div
                    key={p.t}
                    className="rounded-[22px] border border-[rgba(75,175,87,0.12)] bg-white px-3 py-4 text-center shadow-[0_12px_30px_rgba(75,175,87,0.08)]"
                  >
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F5E9]">
                      <p.Icon className="h-6 w-6 text-[#378C41]" strokeWidth={1.6} aria-hidden />
                    </span>
                    <p className="mt-2 text-sm font-extrabold leading-5 text-[#1F2D20]">{p.t}</p>
                    <p className="mt-1 text-xs leading-5 text-[#516251]">{p.d}</p>
                  </div>
                ))}
              </div>
            </div>
            <PhoneFrame src="/images/lp/lp-phone-chart.png" alt="ミラマネの投資チャート画面" />
          </div>
        </MarketingSection>

        {/* 07 ニュース体験 ── モバイルは テキスト先行（ラベル→見出し→チップ→説明→ミラくん→画面） */}
        <MarketingSection className="bg-[#F7FBF7]">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="lg:order-2">
              <SectionLabel>ニュース体験</SectionLabel>
              <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
                ニュースから、
                <span className="text-[#4BAF57]">社会とつながる</span>
              </h2>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {["株ってなに？", "円高ってなに？", "ビットコインってなに？"].map((q) => (
                  <span
                    key={q}
                    className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-[#378C41] shadow-[0_10px_24px_rgba(75,175,87,0.10)]"
                  >
                    {q}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm leading-8 text-[#516251] sm:text-base">
                やさしく解説されたニュースが、親子で話すきっかけになります。
                「これってどういうこと？」から、社会やお金への興味が広がります。
              </p>
              <Image
                src="/images/character/mirakun-surprised.png"
                alt="おどろくミラくん"
                width={200}
                height={200}
                className="mt-5 h-auto w-28 object-contain sm:w-32"
              />
            </div>
            <PhoneFrame
              src="/images/lp/lp-phone-news.png"
              alt="ミラマネのニュース画面"
              className="lg:order-1"
            />
          </div>
        </MarketingSection>

        {/* 08 投資先アップデート ── ベージュ/クリーム背景・横長カード・アイコンは lucide/生成PNG */}
        <MarketingSection>
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#FBEFD0_0%,#FFFAEF_100%)] px-6 py-9 shadow-[0_24px_60px_rgba(246,182,43,0.14)] sm:px-10">
            <div className="grid gap-7 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <SectionLabel>投資先アップデート</SectionLabel>
                <h2 className="mt-5 text-3xl font-black leading-tight text-[#1F2D20] sm:text-4xl">
                  興味の数だけ、
                  <span className="text-[#4BAF57]">学びが広がる</span>
                </h2>
                <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
                  身近な会社やテーマを少しずつ追加予定。
                  子どもの「好き」から、お金や社会を学ぶきっかけが広がります。
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                {INVEST_THEMES.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-2.5 rounded-2xl border border-[rgba(246,182,43,0.35)] bg-white px-5 py-3 text-base font-bold text-[#1F2D20] shadow-[0_12px_28px_rgba(246,182,43,0.14)]"
                  >
                    <Illustration
                      src={c.img}
                      Icon={c.Icon}
                      boxClassName="h-9 w-9 rounded-xl bg-[#FFF8E1]"
                      iconClassName="h-5 w-5 text-[#C8951E]"
                    />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </MarketingSection>

        {/* 09 アップデート情報（app_announcements から取得 / 0件時は非表示） */}
        <LpAnnouncements />

        {/* 10 CTA ── モバイルは ミラくん→見出し→本文→ボタン */}
        <MarketingSection className="pb-14">
          <div className="overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#4BAF57_0%,#2F8F3D_100%)] px-6 py-12 text-white shadow-[0_32px_80px_rgba(55,140,65,0.30)] sm:px-12 sm:py-16 lg:px-16">
            <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-14">
              <div className="flex justify-center lg:justify-start">
                <Image
                  src="/images/character/mirakun-cheer.png"
                  alt="応援するミラくん"
                  width={400}
                  height={400}
                  className="h-auto w-56 object-contain sm:w-72"
                />
              </div>
              <div>
                <h2 className="text-3xl font-black leading-tight sm:text-[2.7rem]">
                  おこづかいを渡すだけで、
                  <br className="hidden sm:block" />
                  終わらない。
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/90">
                  親子で「使う・貯める・考える・学ぶ」を
                  <br className="hidden sm:block" />
                  いっしょに体験してみませんか。
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <MarketingButton
                    href="/register"
                    variant="secondary"
                    className="min-h-14 border-white/30 bg-white px-12 text-base text-[#2F8F3D] hover:bg-[#F4FAF5]"
                  >
                    無料ではじめる
                  </MarketingButton>
                  <MarketingButton
                    href="/login"
                    variant="ghost"
                    className="min-h-14 border-white/60 px-12 text-base text-white hover:bg-white/10"
                  >
                    ログイン
                  </MarketingButton>
                </div>
              </div>
            </div>
          </div>
        </MarketingSection>
      </main>

      {/* Footer */}
      <footer className="bg-[#2F6F3A] px-5 py-10 text-white sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              src="/assets/lp/logo-white.png"
              alt="ミラマネ"
              width={220}
              height={64}
              className="h-12 w-auto"
            />
            <p className="mt-4 max-w-md text-sm leading-7 text-white/78">
              お手伝いやおこづかいを通じて、親子で「使う・貯める・考える・学ぶ」を体験できるアプリ。
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/80 sm:items-end">
            <Link href="/login" className="transition hover:text-white">ログイン</Link>
            <Link href="/register" className="transition hover:text-white">無料ではじめる</Link>
            <p className="leading-7 text-white/75">
              <LegalLinks linkClassName="underline underline-offset-4 transition hover:text-white" />
            </p>
            <p className="text-white/60">© {new Date().getFullYear()} ミラマネ</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
