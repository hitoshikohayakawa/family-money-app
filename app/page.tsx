import PageContainer from "@/app/components/ui/page-container";
import AppHeader from "@/app/components/app-header";
import AllowanceGrantsPanel from "@/app/components/allowance-grants-panel";

export default function Home() {
  return (
    <>
      <AppHeader />
      <PageContainer>
        <AllowanceGrantsPanel />
      </PageContainer>
    </>
  );
}
