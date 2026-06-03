import AppHeader from "@/app/components/app-header";
import ChildSettingsPanel from "@/app/components/child-settings-panel";
import FooterNav from "@/app/components/ui/footer-nav";
import PageContainer from "@/app/components/ui/page-container";

export default function SettingsPage() {
  return (
    <>
      <AppHeader />
      <PageContainer
        title="アカウント設定"
        description="アイコンや写真を変更できます。"
      >
        <ChildSettingsPanel />
      </PageContainer>
      <FooterNav />
    </>
  );
}
