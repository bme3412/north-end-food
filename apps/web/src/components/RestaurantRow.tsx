import Link from "next/link";

import { formatDollars, formatPriceLevel, prettyCategory } from "@/lib/format";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { GoogleMapsAttribution } from "@/components/GoogleMapsAttribution";
import type { PlaceMatch } from "@/lib/types";

export function RestaurantRow({ place }: { place: PlaceMatch }) {
  return (
    <Link
      href={`/restaurants/${place.restaurant_id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-[0_1px_3px_rgba(23,27,32,0.04)] transition-colors hover:border-primary/30 hover:bg-primary-soft/20"
    >
      <RestaurantPhoto
        restaurantId={place.restaurant_id}
        localSrc={place.photo_url}
        alt={place.name}
        variant="thumbnail"
        showSourceLink={false}
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-snug text-ink">
          {place.name}
        </p>
        {place.rating != null || place.price_level != null ? <GoogleMapsAttribution /> : null}
        <p className="mt-0.5 truncate text-xs text-muted">
          {place.rating != null ? <span>★ {place.rating} · </span> : null}
          {place.primary_cuisine ? <span className="capitalize">{prettyCategory(place.primary_cuisine)}</span> : null}
          {place.price_level != null ? <span> · {formatPriceLevel(place.price_level)}</span> : null}
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
