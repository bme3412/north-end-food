"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { TimePreviewControl } from "@/components/TimePreviewControl";
import { useAsOfTime } from "@/lib/asOfTime";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-linen/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="min-w-0">
          <p className="font-[family-name:var(--font-fraunces)] text-[1.35rem] font-medium leading-none tracking-tight text-ink">
            North End Food
          </p>
          <p className="mt-1 text-[0.7rem] leading-none text-muted">Search menus on the map</p>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <nav className="flex shrink-0 items-center gap-4">
            <HeaderTab href="/" label="Map" active={pathname === "/"} />
            <HeaderTab href="/restaurants" label="Places" active={pathname?.startsWith("/restaurants") ?? false} />
          </nav>
          <ServiceModeToggle />
          <OpenNowCheckbox />
          <TimePreviewControl />
        </div>
      </div>
    </header>
  );
}

function HeaderTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`border-b-2 pb-1 pt-1 text-sm font-medium ${
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function OpenNowCheckbox() {
  const { openNowEnabled, setOpenNowEnabled } = useAsOfTime();

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink">
      <input
        type="checkbox"
        checked={openNowEnabled}
        onChange={(event) => setOpenNowEnabled(event.target.checked)}
        className="size-4 rounded border-line"
      />
      <span className="hidden sm:inline">Open now</span>
    </label>
  );
}

// Purely cosmetic to match the mockup -- there's no backend concept of
// dine-in vs. takeout availability, so this never affects search results.
function ServiceModeToggle() {
  const [mode, setMode] = useState<"dine-in" | "takeout">("dine-in");

  return (
    <div className="hidden items-center gap-1 rounded-full bg-linen-2 p-1 sm:flex">
      <button
        type="button"
        onClick={() => setMode("dine-in")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
          mode === "dine-in" ? "bg-card text-ink shadow-sm" : "text-muted"
        }`}
      >
        <span aria-hidden="true">🍴</span> Dine-in
      </button>
      <button
        type="button"
        onClick={() => setMode("takeout")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
          mode === "takeout" ? "bg-card text-ink shadow-sm" : "text-muted"
        }`}
      >
        <span aria-hidden="true">🥡</span> Takeout
      </button>
    </div>
  );
}
