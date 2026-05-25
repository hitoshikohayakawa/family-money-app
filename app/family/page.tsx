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
        description="家族の作成と、いま参加しているメンバーを確認できます。"
      >
        <div className="space-y-5">
          <FamilySetup />
          <FamilyMembersList />
        </div>
      </PageContainer>
    </>
  );
}
