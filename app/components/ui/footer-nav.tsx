"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

type NavItem = {
  href: string;
  label: string;
  matchPrefix?: boolean;
};

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 13a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" stroke="none" />
      <path d="M2 10h20" />
    </svg>
  );
}

function FamilyIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function NewsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FooterNav() {
  const pathname = usePathname();
  const [isChild, setIsChild] = useState(false);

  useEffect(() => {
    async function checkRole() {
      // Use getSafeSession instead of getUser() to avoid Supabase lock contention
      const { data: { session } } = await getSafeSession(supabase);
      if (!session?.user) return;
      const { data } = await supabase
        .from("family_memberships")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();
      setIsChild(data?.role === "child");
    }
    void checkRole();
  }, []);

  const isActive = (href: string, matchPrefix?: boolean) => {
    if (matchPrefix) return pathname === href || pathname.startsWith(href + "/");
    return pathname === href;
  };

  const navItems: NavItem[] = [
    { href: "/", label: "ホーム" },
    { href: "/allowance", label: "お小遣い" },
    { href: "/news", label: "ニュース", matchPrefix: true },
    { href: "/charts", label: "チャート", matchPrefix: true },
    ...(isChild
      ? [{ href: "/settings", label: "設定" } as NavItem]
      : [{ href: "/family", label: "家族設定", matchPrefix: true } as NavItem]
    ),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-soft)] bg-[rgba(248,252,246,0.95)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1120px] justify-around py-1">
        {navItems.map(({ href, label, matchPrefix }) => {
          const active = isActive(href, matchPrefix);
          const color = active ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]";
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-semibold transition sm:px-4 sm:text-xs ${color}`}
            >
              {href === "/" && <HomeIcon active={active} />}
              {href === "/allowance" && <WalletIcon active={active} />}
              {href === "/news" && <NewsIcon active={active} />}
              {href === "/charts" && <ChartIcon active={active} />}
              {href === "/family" && <FamilyIcon active={active} />}
              {href === "/settings" && <SettingsIcon active={active} />}
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
