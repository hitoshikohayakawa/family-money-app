import type { Metadata } from "next";
import AppHeader from "@/app/components/app-header";
import AllowanceGrantsPanel from "@/app/components/allowance-grants-panel";
import FooterNav from "@/app/components/ui/footer-nav";
import PageContainer from "@/app/components/ui/page-container";

export const metadata: Metadata = {
  title: "お小遣い | ファミマネ",
};

export default function AllowancePage() {
  return (
    <>
      <AppHeader />
      <PageContainer>
        <AllowanceGrantsPanel />
        {/* Spacer for fixed FooterNav */}
        <div className="h-16" />
      </PageContainer>
      <FooterNav />
    </>
  );
}
