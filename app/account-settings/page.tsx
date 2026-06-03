import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import AccountSettingsPanel from "@/app/components/account-settings-panel";
import FooterNav from "@/app/components/ui/footer-nav";
import PageContainer from "@/app/components/ui/page-container";

export default function AccountSettingsPage() {
  return (
    <>
      <AuthGuard />
      <AppHeader />
      <PageContainer
        title="アカウント設定"
        description="メールアドレスやファミリー名の変更、退会手続きを行えます。"
      >
        <AccountSettingsPanel />
      </PageContainer>
      <FooterNav />
    </>
  );
}
