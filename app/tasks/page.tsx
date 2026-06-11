import type { Metadata } from "next";
import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import FamilyChildGuard from "@/app/components/family-child-guard";
import FamilyTasksPanel from "@/app/components/family-tasks-panel";
import FooterNav from "@/app/components/ui/footer-nav";
import PageContainer from "@/app/components/ui/page-container";

export const metadata: Metadata = {
  title: "やること設定 | ミラマネ",
};

export default function TasksPage() {
  return (
    <>
      <AuthGuard />
      <FamilyChildGuard />
      <AppHeader />
      <PageContainer
        title="やること設定"
        description="子どものお手伝いや宿題などの「やること」を登録できます。ごほうびを設定すると、完了を承認したときにお小遣いとして追加されます。"
      >
        <FamilyTasksPanel />
        {/* Spacer for fixed FooterNav */}
        <div className="h-16" />
      </PageContainer>
      <FooterNav />
    </>
  );
}
