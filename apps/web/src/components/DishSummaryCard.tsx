"use client";

import { useState } from "react";
import { ChartNoAxesColumnIncreasing, CircleDollarSign, Leaf, Star, Utensils } from "lucide-react";

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
  const description = group.items.find((item) => item.raw_description?.trim())?.raw_description ?? null;

  return (
    <section className="flex min-h-[99px] gap-3 rounded-xl border border-line bg-card p-2.5 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
      <RestaurantPhoto src={photo} alt={group.displayName} className="h-[78px] w-[82px] shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {group.displayName}
          </h1>
          <button
            type="button"
            onClick={() => setFavorited((current) => !current)}
            aria-pressed={favorited}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className={`shrink-0 ${favorited ? "text-primary" : "text-muted hover:text-ink"}`}
          >
            <Star className="size-4" fill={favorited ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        </div>
        {description ? <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-muted">{description}</p> : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Utensils className="size-3.5" aria-hidden="true" />
            {group.restaurantCount} restaurant{group.restaurantCount === 1 ? "" : "s"}
          </span>
          {group.minPrice != null && group.maxPrice != null ? (
            <span className="inline-flex items-center gap-1.5">
              <CircleDollarSign className="size-3.5" aria-hidden="true" />
              {formatDollars(group.minPrice)} – {formatDollars(group.maxPrice)}
            </span>
          ) : null}
          {medianPrice != null ? (
            <span className="inline-flex items-center gap-1.5">
              <ChartNoAxesColumnIncreasing className="size-3.5" aria-hidden="true" />
              Median {formatDollars(medianPrice)}
            </span>
          ) : null}
          {group.restaurantCount >= POPULAR_THRESHOLD ? (
            <Badge tone="basil" icon={<Leaf className="size-3" />}>Popular</Badge>
          ) : null}
        </div>
      </div>
    </section>
  );
}
