import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-linen/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="min-w-0">
          <p className="font-[family-name:var(--font-fraunces)] text-[1.35rem] font-medium leading-none tracking-tight text-ink">
            North End Food
          </p>
          <p className="mt-1 text-[0.7rem] leading-none text-muted">Search menus on the map</p>
        </Link>
        <nav className="flex shrink-0 items-center gap-1">
          <Link href="/" className="rounded-full px-3 py-2 text-sm text-ink hover:bg-linen-2">
            Map
          </Link>
          <Link href="/restaurants" className="rounded-full px-3 py-2 text-sm text-ink hover:bg-linen-2">
            Places
          </Link>
        </nav>
      </div>
    </header>
  );
}
