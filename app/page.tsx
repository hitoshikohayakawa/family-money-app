import PageContainer from "@/app/components/ui/page-container";
import AuthStatus from "@/app/components/auth-status";
import FamilyInvitesPanel from "@/app/components/family-invites-panel";
import FamilySetup from "@/app/components/family-setup";
import FamilyMembersList from "@/app/components/family-members-list";

export default function Home() {
  return (
    <PageContainer>
      <section>
        <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(160deg,var(--surface-strong),var(--surface-strong-soft))] px-6 py-7 text-white shadow-[0_22px_52px_rgba(36,59,107,0.26)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[rgba(255,255,255,0.1)]" />
          <div className="pointer-events-none absolute right-16 top-20 h-20 w-20 rounded-full border border-[rgba(255,255,255,0.18)]" />
          <div className="pointer-events-none absolute bottom-5 right-8 h-16 w-16 rounded-[20px] bg-[rgba(246,230,184,0.2)] rotate-12" />

          <span className="inline-flex rounded-full bg-[rgba(255,255,255,0.12)] px-3 py-1 text-sm font-semibold text-white/90">
            お金の体験を、家族でたのしく
          </span>
          <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight sm:text-5xl">
            家族で学ぶお金の時間を、
            やさしく始める
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[rgba(255,255,255,0.82)] sm:text-lg">
            家族をつくる、みんなを招待する、いっしょに使い始める。
            はじめの準備を、見やすい順番で並べました。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur">
              <p className="text-sm font-semibold text-white/78">まずやること</p>
              <p className="mt-2 text-xl font-bold">家族をつくる</p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                家族ができると、次の招待や参加が進めやすくなります。
              </p>
            </div>
            <div className="rounded-[24px] bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur">
              <p className="text-sm font-semibold text-white/78">つぎにやること</p>
              <p className="mt-2 text-xl font-bold">家族を招待する</p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                リンクを送るだけで、家族が自分のタイミングで参加できます。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <AuthStatus />
        <FamilySetup />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <FamilyMembersList />
        <FamilyInvitesPanel />
      </section>
    </PageContainer>
  );
}
