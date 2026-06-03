import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import FamilyChildGuard from "@/app/components/family-child-guard";
import FamilyMembersList from "@/app/components/family-members-list";
import FamilySetup from "@/app/components/family-setup";
import FooterNav from "@/app/components/ui/footer-nav";
import PageContainer from "@/app/components/ui/page-container";

export default function FamilyPage() {
  return (
    <>
      <AuthGuard />
      <FamilyChildGuard />
      <AppHeader />
      <PageContainer
        title="家族設定"
        description="名前の編集、メールアドレス確認、家族メンバーの管理をここでまとめて行えます。"
      >
        <div className="space-y-5">
          <FamilySetup />
          <FamilyMembersList />
          {/* Spacer for fixed FooterNav */}
          <div className="h-16" />
        </div>
      </PageContainer>
      <FooterNav />
    </>
  );
}
