import AppHeader from "@/app/components/app-header";
import FamilyMembersList from "@/app/components/family-members-list";
import FamilySetup from "@/app/components/family-setup";
import PageContainer from "@/app/components/ui/page-container";

export default function FamilyPage() {
  return (
    <>
      <AppHeader />
      <PageContainer
        title="家族設定"
        description="名前の編集、メールアドレス確認、家族メンバーの管理をここでまとめて行えます。"
      >
        <div className="space-y-5">
          <FamilySetup />
          <div
            id="name-settings"
            className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] px-5 py-5 shadow-[var(--shadow-card)]"
          >
            <p className="text-xl font-extrabold text-[var(--text-primary)]">名前とアカウント</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              親と子どもの表示名はここで編集できます。表示名があると、ホーム画面ではメールアドレスより先に名前が表示されます。
            </p>
          </div>
          <FamilyMembersList />
        </div>
      </PageContainer>
    </>
  );
}
