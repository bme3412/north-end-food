"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TimePreviewControl } from "@/components/TimePreviewControl";
import { useAsOfTime } from "@/lib/asOfTime";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-linen/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-base text-linen"
          >
            🍴
          </span>
          <span className="min-w-0">
            <p className="truncate font-[family-name:var(--font-fraunces)] text-[1.2rem] font-medium leading-none tracking-tight text-ink">
              North End Food
            </p>
            <p className="mt-1 hidden truncate text-[0.7rem] leading-none text-muted sm:block">
              Find what to eat. Compare. Explore.
            </p>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <nav className="flex shrink-0 items-center gap-1">
            <HeaderTab href="/" icon="🗺️" label="Map" active={pathname === "/"} />
            <HeaderTab
              href="/restaurants"
              icon="🏪"
              label="Restaurants"
              active={pathname?.startsWith("/restaurants") ?? false}
            />
          </nav>
          <OpenNowIndicator />
          <TimePreviewControl />
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
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? "bg-ink text-linen" : "text-muted hover:bg-linen-2 hover:text-ink"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
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
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
        openNowEnabled ? "border-basil/30 bg-basil-soft text-basil" : "border-line bg-card text-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${openNowEnabled ? "bg-basil" : "bg-muted/40"}`}
      />
      <span className="hidden sm:inline">Open now</span>
    </button>
  );
}
