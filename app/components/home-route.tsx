"use client";

import { useEffect, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/app/components/app-header";
import HomeDashboard from "@/app/components/home-dashboard";
import FooterNav from "@/app/components/ui/footer-nav";
import LandingPage from "@/app/components/landing-page";

type AuthState = "loading" | "unauthenticated" | "authenticated";

export default function HomeRoute() {
  const [authState, setAuthState] = useState<AuthState>("loading");

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
      <AppHeader />
      <HomeDashboard />
      <FooterNav />
    </>
  );
}
