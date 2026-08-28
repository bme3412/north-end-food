"use client";

import Link from "next/link";
import { Bookmark, Compass, Map, Search, UserRound, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

const ITEMS: { href: string; label: string; icon: LucideIcon; matches: (pathname: string) => boolean }[] = [
  { href: "/", label: "Explore", icon: Compass, matches: (pathname) => pathname === "/" },
  { href: "/search", label: "Search", icon: Search, matches: (pathname) => pathname === "/search" },
  { href: "/map", label: "Map", icon: Map, matches: (pathname) => pathname === "/map" },
  { href: "/saved", label: "Saved", icon: Bookmark, matches: (pathname) => pathname === "/saved" },
  { href: "/profile", label: "Profile", icon: UserRound, matches: (pathname) => pathname === "/profile" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/restaurants/")) return null;

  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-card/95 px-1 pt-1 backdrop-blur-xl md:hidden"
    >
      {ITEMS.map(({ href, label, icon: Icon, matches }) => {
        const active = matches(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${
              active ? "text-primary" : "text-muted active:bg-linen-2"
            }`}
          >
            <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
