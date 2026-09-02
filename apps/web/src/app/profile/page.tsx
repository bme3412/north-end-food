import Link from "next/link";
import { Bookmark, Clock3, MapPin, UserRound } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-8 sm:px-6">
      <div className="rounded-[28px] border border-line bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <UserRound className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Your North End</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Saved places stay on this device. Accounts and cross-device syncing can be added later.
        </p>
      </div>
      <nav aria-label="Legal" className="mt-6 flex justify-center gap-5 text-sm text-muted">
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        <Link href="/terms" className="underline underline-offset-2">Terms</Link>
      </nav>
      <div className="mt-5 grid gap-3">
        <Link href="/saved" className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-card px-4 shadow-sm">
          <Bookmark className="size-5 text-primary" aria-hidden="true" />
          <span className="flex-1 font-bold">Saved dishes and restaurants</span>
          <span aria-hidden="true">›</span>
        </Link>
        <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-card px-4 text-muted shadow-sm">
          <Clock3 className="size-5" aria-hidden="true" />
          <span className="flex-1">Recent searches</span>
          <span className="text-xs">Coming soon</span>
        </div>
        <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-card px-4 text-muted shadow-sm">
          <MapPin className="size-5" aria-hidden="true" />
          <span className="flex-1">Location preferences</span>
          <span className="text-xs">North End</span>
        </div>
      </div>
    </div>
  );
}
