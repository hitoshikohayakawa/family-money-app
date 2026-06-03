"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

export default function AdminGuard() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: session } = await getSafeSession(supabase);
      if (!session.session) { router.replace("/login"); return; }
      const { data: membership } = await supabase
        .from("family_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membership?.role !== "guardian_admin") router.replace("/");
    };
    void check();
  }, [router]);

  return null;
}
