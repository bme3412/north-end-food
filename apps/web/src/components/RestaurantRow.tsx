import Link from "next/link";

import { formatDollars, prettyCategory } from "@/lib/format";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import type { PlaceMatch } from "@/lib/types";

export function RestaurantRow({ place }: { place: PlaceMatch }) {
  return (
    <Link
      href={`/restaurants/${place.restaurant_id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(42,35,28,0.04)]"
    >
      <RestaurantPhoto
        src={place.photo_url}
        alt={place.name}
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-fraunces)] text-base font-medium leading-snug text-ink">
          {place.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {place.primary_cuisine ? <span className="capitalize">{prettyCategory(place.primary_cuisine)}</span> : null}
          {place.lowest_price != null ? <span> · from {formatDollars(place.lowest_price)}</span> : null}
          <span>
            {" "}
            · {place.match_count} matched dish{place.match_count === 1 ? "" : "es"}
          </span>
        </p>
      </div>
      <span className="shrink-0 text-muted" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
