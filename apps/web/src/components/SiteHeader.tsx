"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Map, Search, Store, Utensils, type LucideIcon } from "lucide-react";

import { TimePreviewControl } from "@/components/TimePreviewControl";
import { useAsOfTime } from "@/lib/asOfTime";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 h-[50px] border-b border-line bg-card/95 backdrop-blur-md">
      <div className="mx-auto grid h-full max-w-[1440px] grid-cols-[1fr_auto] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr] md:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Utensils aria-hidden="true" className="size-6 shrink-0 text-muted" strokeWidth={1.8} />
          <span className="min-w-0">
            <p className="truncate text-[16px] font-bold leading-none tracking-[-0.02em] text-ink">
              North End Food
            </p>
            <p className="mt-1 hidden truncate text-[9px] leading-none text-muted sm:block">
              Find what to eat. Compare. Explore.
            </p>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden h-full items-center gap-1 md:flex">
          <HeaderTab href="/" icon={Compass} label="Discover" active={pathname === "/"} />
          <HeaderTab href="/search" icon={Search} label="Search" active={pathname === "/search"} />
          <HeaderTab
            href="/restaurants"
            icon={Store}
            label="Restaurants"
            active={pathname?.startsWith("/restaurants") ?? false}
          />
          <HeaderTab href="/map" icon={Map} label="Map" active={pathname === "/map"} />
          <HeaderTab href="/saved" icon={Bookmark} label="Saved" active={pathname === "/saved"} />
        </nav>

        <div className="flex justify-end">
          <div className="flex items-center rounded-xl border border-line bg-card shadow-[0_2px_8px_rgba(23,27,32,0.06)]">
            <TimePreviewControl />
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <OpenNowIndicator />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderTab({
  href,
  icon,
  label,
  active,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  const Icon = icon;
  const className = `relative flex h-full items-center gap-1.5 border-b-2 px-3 text-[11px] font-medium transition-colors ${
    active
      ? "border-primary bg-primary-soft/40 text-primary"
      : href
        ? "border-transparent text-ink hover:bg-linen"
        : "cursor-default border-transparent text-muted"
  }`;
  const content = (
    <>
      <Icon className="size-3.5" aria-hidden={true} />
      <span>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <span className={className} aria-disabled="true" title={`${label} is coming soon`}>
      {content}
    </span>
  );
}

// Toggle, styled as the mockup's green-dot status pill rather than a plain
// checkbox -- still the same `openNowEnabled` boolean from useAsOfTime,
// read by the search query builder to actually filter results (see
// SearchWorkspace.tsx).
function OpenNowIndicator() {
  const { openNowEnabled, setOpenNowEnabled } = useAsOfTime();

  return (
    <button
      type="button"
      onClick={() => setOpenNowEnabled(!openNowEnabled)}
      aria-pressed={openNowEnabled}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-r-lg px-2.5 text-[11px] font-medium transition-colors ${
        openNowEnabled ? "text-ink hover:bg-basil-soft" : "text-muted hover:bg-linen"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${openNowEnabled ? "bg-basil" : "bg-muted/40"}`}
      />
      <span>Open now</span>
    </button>
  );
}
