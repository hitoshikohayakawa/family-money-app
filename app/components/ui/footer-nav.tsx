"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
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

export default function FooterNav() {
  const pathname = usePathname();

  const isActive = (href: string, matchPrefix?: boolean) => {
    if (matchPrefix) return pathname === href || pathname.startsWith(href + "/");
    return pathname === href;
  };

  const navItems: NavItem[] = [
    { href: "/", label: "ホーム", icon: null },
    { href: "/allowance", label: "お小遣い", icon: null },
    { href: "/family", label: "家族設定", icon: null, matchPrefix: true },
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
              className={`flex flex-col items-center gap-0.5 px-5 py-2 text-xs font-semibold transition ${color}`}
            >
              {href === "/" && <HomeIcon active={active} />}
              {href === "/allowance" && <WalletIcon active={active} />}
              {href === "/family" && <FamilyIcon active={active} />}
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
