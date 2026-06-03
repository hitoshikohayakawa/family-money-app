import AppHeader from "@/app/components/app-header";
import AuthGuard from "@/app/components/auth-guard";
import AllowanceHistoryContent from "@/app/allowance-history/allowance-history-content";

export default function AllowanceHistoryPage() {
  return (
    <>
      <AuthGuard />
      <AppHeader />
      <AllowanceHistoryContent />
    </>
  );
}
