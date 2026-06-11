"use client";

import { useEffect, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/app/components/app-header";
import HomeDashboard from "@/app/components/home-dashboard";
import FooterNav from "@/app/components/ui/footer-nav";
import LandingPage from "@/app/components/landing-page";
import PwaGuideModal, {
  shouldShowPwaModal,
  markPwaModalShown,
} from "@/app/components/pwa-guide-modal";

type AuthState = "loading" | "unauthenticated" | "authenticated";

export default function HomeRoute() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  // PWA案内モーダル: ログイン済みホーム表示時に1回だけ自動表示
  useEffect(() => {
    if (authState !== "authenticated") return;
    const timer = setTimeout(() => {
      if (shouldShowPwaModal()) {
        markPwaModalShown();
        setPwaModalOpen(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [authState]);

  useEffect(() => {
    let isActive = true;

    const check = async () => {
      const { data: { session } } = await getSafeSession(supabase);
      if (!isActive) return;
      setAuthState(session?.user ? "authenticated" : "unauthenticated");
    };

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;
      setAuthState(session?.user ? "authenticated" : "unauthenticated");
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4FAF5]">
        <p className="text-sm text-[#516251]">読み込み中...</p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LandingPage />;
  }

  return (
    <>
      <AppHeader onOpenPwaModal={() => setPwaModalOpen(true)} />
      <HomeDashboard />
      <FooterNav />
      <PwaGuideModal
        open={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
      />
    </>
  );
}
