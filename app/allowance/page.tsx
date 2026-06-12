import type { Metadata } from "next";
import { Suspense } from "react";
import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import AllowanceTasksTabs from "@/app/components/allowance-tasks-tabs";
import FooterNav from "@/app/components/ui/footer-nav";
import PageContainer from "@/app/components/ui/page-container";

export const metadata: Metadata = {
  title: "タスク・お小遣い | ミラマネ",
};

export default function AllowancePage() {
  return (
    <>
      <AuthGuard />
      <AppHeader />
      <PageContainer>
        {/* Suspense required because the tabs/panel use useSearchParams */}
        <Suspense>
          <AllowanceTasksTabs />
        </Suspense>
        {/* Spacer for fixed FooterNav */}
        <div className="h-16" />
      </PageContainer>
      <FooterNav />
    </>
  );
}
