"use client";

import { useState } from "react";

import { Badge } from "@/components/Badge";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { formatDollars } from "@/lib/format";
import type { DishGroup } from "@/lib/dishGroups";

// A restaurant count at or above this earns the "Popular" badge -- a
// simple, documented threshold rather than a hidden magic number. No
// ratings/reviews go into this since none exist yet for any restaurant
// (see plan notes); it's purely "how many places serve this dish".
const POPULAR_THRESHOLD = 5;

export function DishSummaryCard({ group }: { group: DishGroup }) {
  const [favorited, setFavorited] = useState(false);
  // Dish-level median is already computed server-side (queries.py's
  // dish_and_category_medians, exposed as north_end_median_price on every
  // item in this group) -- read it from any item rather than recomputing
  // a second, possibly-drifting median client-side from minPrice/maxPrice.
  const medianPrice = group.items[0]?.north_end_median_price ?? null;
  const photo = group.items.find((item) => item.photo_url)?.photo_url ?? null;

  return (
    <section className="flex gap-4 rounded-3xl border border-line bg-card p-5">
      <RestaurantPhoto src={photo} alt={group.displayName} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-medium leading-snug text-ink">
            {group.displayName}
          </h1>
          <button
            type="button"
            onClick={() => setFavorited((current) => !current)}
            aria-pressed={favorited}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className={`shrink-0 text-xl ${favorited ? "text-tomato" : "text-muted hover:text-ink"}`}
          >
            {favorited ? "★" : "☆"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
          <span>
            {group.restaurantCount} restaurant{group.restaurantCount === 1 ? "" : "s"}
          </span>
          {group.minPrice != null && group.maxPrice != null ? (
            <span>
              {formatDollars(group.minPrice)} – {formatDollars(group.maxPrice)}
            </span>
          ) : null}
          {medianPrice != null ? <span>Median {formatDollars(medianPrice)}</span> : null}
          {group.restaurantCount >= POPULAR_THRESHOLD ? <Badge tone="tomato">Popular</Badge> : null}
        </div>
      </div>
    </section>
  );
}
