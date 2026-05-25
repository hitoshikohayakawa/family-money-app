import AppHeader from "@/app/components/app-header";
import FamilyInvitesPanel from "@/app/components/family-invites-panel";
import PageContainer from "@/app/components/ui/page-container";

export default function FamilyInvitesPage() {
  return (
    <>
      <AppHeader />
      <PageContainer
        title="家族を招待"
        description="家族への招待を作成し、招待一覧を確認できます。"
      >
        <FamilyInvitesPanel />
      </PageContainer>
    </>
  );
}
