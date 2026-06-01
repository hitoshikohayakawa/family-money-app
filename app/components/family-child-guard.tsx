"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function FamilyChildGuard() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("family_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (data?.role === "child") {
        router.replace("/");
      }
    }
    void check();
  }, [router]);

  return null;
}
