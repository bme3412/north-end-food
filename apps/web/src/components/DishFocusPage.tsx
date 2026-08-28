"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { DishSummaryCard } from "@/components/DishSummaryCard";
import { PriceDistributionPanel } from "@/components/PriceDistributionPanel";
import { RankedDishRow } from "@/components/RankedDishRow";
import { SimilarDishesCarousel } from "@/components/SimilarDishesCarousel";
import { oneItemPerRestaurant, type DishGroup } from "@/lib/dishGroups";
import { NORTH_END_CENTER, haversineMiles } from "@/lib/geo";
import type { MenuItem, PlaceMatch } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[256px] animate-pulse rounded-xl bg-linen-2" />,
});

const TOP_SLICE = 5;

type SortKey = "rank" | "price" | "distance";

const SORT_LABELS: Record<SortKey, string> = {
  rank: "Best match",
  price: "Lowest price",
  distance: "Nearest",
};

function itemToPlaceMatch(item: MenuItem): PlaceMatch {
  return {
    restaurant_id: item.restaurant_id,
    name: item.restaurant_name,
    address: item.address ?? "",
    latitude: item.latitude,
    longitude: item.longitude,
    establishment_type: item.establishment_type ?? "",
    primary_cuisine: item.primary_cuisine,
    match_count: 1,
    lowest_price: item.price,
    lowest_price_pct_vs_median: item.pct_vs_median,
    sample_name: item.raw_name,
    photo_url: item.photo_url,
    open_now: item.open_now,
    hours_summary: item.hours_summary,
    rating: item.rating,
    review_count: item.review_count,
    price_level: item.price_level,
    takeout: item.takeout,
    dine_in: item.dine_in,
    delivery: item.delivery,
  };
}

// One quality badge per restaurant, at most -- "Best value" is the
// cheapest priced item, while "Top rated" only exists once >=1 item has a
// non-null rating (never true today -- no restaurant has Google Places
// data linked yet), and "Great option" is a fallback for anything else at
// or below the North End median that isn't already tagged.
function assignQualityBadges(items: MenuItem[]): Map<string, string> {
  const badges = new Map<string, string>();
  const cheapest = items.reduce<MenuItem | null>((current, item) => {
    if (item.price == null) return current;
    if (current?.price == null) return item;
    return Number(item.price) < Number(current.price) ? item : current;
  }, null);
  if (cheapest) badges.set(cheapest.menu_item_id, "Best value");

  const rated = items.filter((item) => item.rating != null);
  if (rated.length) {
    const topRated = rated.reduce((max, item) => (Number(item.rating) > Number(max.rating) ? item : max));
    if (!badges.has(topRated.menu_item_id)) badges.set(topRated.menu_item_id, "Top rated");
  }

  for (const item of items) {
    if (badges.has(item.menu_item_id)) continue;
    if (item.pct_vs_median != null && item.pct_vs_median <= 0) {
      badges.set(item.menu_item_id, "Great option");
    }
  }
  return badges;
}

export function DishFocusPage({
  group,
  onSelectDish,
  onBack,
}: {
  group: DishGroup;
  onSelectDish: (dishName: string) => void;
  onBack?: () => void;
}) {
  const [showTop5, setShowTop5] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const qualityBadges = useMemo(() => assignQualityBadges(group.items), [group.items]);

  // Distance is computed once per item here (not inside the render loop)
  // so it can double as the "distance" sort key as well as the per-row
  // display value -- one source, two uses.
  const distanceByItem = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const item of group.items) {
      map.set(
        item.menu_item_id,
        item.latitude != null && item.longitude != null
          ? haversineMiles(item.latitude, item.longitude, NORTH_END_CENTER.latitude, NORTH_END_CENTER.longitude)
          : null,
      );
    }
    return map;
  }, [group.items]);

  // `group.items` retains the API's intent-first "Best match" order.
  // Explicit sorts reorder only a copy -- items missing the sort field (no
  // price, no resolvable distance) sink to the end rather than being
  // dropped, so switching sort never hides a restaurant.
  const sortedItems = useMemo(() => {
    if (sortKey === "rank") return group.items;
    const withMetric = group.items.map((item) => ({
      item,
      metric: sortKey === "price" ? (item.price != null ? Number(item.price) : null) : distanceByItem.get(item.menu_item_id) ?? null,
    }));
    withMetric.sort((a, b) => {
      if (a.metric == null && b.metric == null) return 0;
      if (a.metric == null) return 1;
      if (b.metric == null) return -1;
      return a.metric - b.metric;
    });
    return withMetric.map((entry) => entry.item);
  }, [group.items, sortKey, distanceByItem]);

  // A restaurant can serve more than one preparation of the same dish
  // (e.g. two calamari items on one menu) -- `group.items` is per menu
  // item, not per restaurant. Every downstream consumer here (the ranked
  // list, the map's one-marker-per-place, "N restaurants serve X") is
  // restaurant-scoped, so collapse to one representative item per
  // restaurant_id here, keeping the first occurrence in the current sort
  // order (its cheapest/nearest/best-ranked item, whichever sort is
  // active). Without this, a restaurant with 2 items renders as 2 map
  // markers sharing one key (React duplicate-key warning) and 2 rows in
  // an "N restaurants" list.
  const restaurantItems = useMemo(() => oneItemPerRestaurant(sortedItems), [sortedItems]);

  const mapItems = showTop5 ? restaurantItems.slice(0, TOP_SLICE) : restaurantItems;

  const places = useMemo(() => mapItems.map(itemToPlaceMatch), [mapItems]);
  // Ranks follow the current sort order, not the original price order, so
  // the map pins and the list numbers always agree with what's on screen.
  const ranks = useMemo(() => {
    const map: Record<string, number> = {};
    restaurantItems.forEach((item, index) => {
      map[item.restaurant_id] = index + 1;
    });
    return map;
  }, [restaurantItems]);

  const selectedItem = restaurantItems.find((item) => item.restaurant_id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5">
      <div className="mb-3 grid grid-cols-2 rounded-lg bg-linen-2 p-1 lg:hidden">
        {(["list", "map"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setMobileView(view)}
            className={`rounded-md py-1.5 text-xs font-semibold capitalize ${
              mobileView === view ? "bg-card text-ink shadow-sm" : "text-muted"
            }`}
          >
            {view === "list" ? `Dishes (${restaurantItems.length})` : "Map & prices"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <div className={`${mobileView === "list" ? "flex" : "hidden"} min-w-0 flex-col gap-3 lg:flex`}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="self-start text-[11px] font-medium text-basil underline underline-offset-2"
            >
              All matching dishes
            </button>
          ) : null}
          <DishSummaryCard group={group} />

          <div className="flex h-8 items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold text-ink">
              {group.restaurantCount} restaurant{group.restaurantCount === 1 ? "" : "s"} serve {group.displayName}
            </h2>
            <div className="flex items-center gap-1 text-[9px] text-muted">
              <span>Sort by</span>
              <label className="relative">
                <span className="sr-only">Sort by</span>
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="appearance-none bg-transparent py-1 pl-1 pr-4 text-[10px] font-semibold text-ink outline-none"
                >
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((value) => (
                    <option key={value} value={value}>
                      {SORT_LABELS[value]}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-[8px] text-muted"
                >
                  ▾
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {restaurantItems.map((item, index) => {
              // `visibleItems` is always a prefix of `restaurantItems` (either
              // the whole thing or its first TOP_SLICE), so the map index
              // here doubles as the correct 1-based rank without a second
              // lookup, and stays consistent with the `ranks` map passed
              // to MapView regardless of which sort is active.
              const distanceMiles = distanceByItem.get(item.menu_item_id) ?? null;
              return (
                <RankedDishRow
                  key={item.menu_item_id}
                  item={item}
                  rank={index + 1}
                  qualityBadge={qualityBadges.get(item.menu_item_id) ?? null}
                  distanceMiles={distanceMiles}
                />
              );
            })}
          </div>
        </div>

        <div className={`${mobileView === "map" ? "flex" : "hidden"} min-w-0 flex-col gap-3 lg:flex`}>
          <div className="relative h-[300px] overflow-hidden rounded-xl border border-line">
            <MapView
              places={places}
              ranks={ranks}
              variant="ranked"
              selectedId={selectedId}
              selectedItems={selectedItem ? [selectedItem] : []}
              onSelect={(place) => setSelectedId(place?.restaurant_id ?? null)}
            />
            <button
              type="button"
              onClick={() => setShowTop5((current) => !current)}
              aria-pressed={showTop5}
              className={`absolute right-10 top-2.5 flex h-7 items-center gap-2 rounded-lg border px-2.5 text-[9px] font-medium shadow-sm ${
                showTop5 ? "border-line bg-card text-ink" : "border-line bg-card/90 text-muted"
              }`}
            >
              Show top {TOP_SLICE}
              <span
                className={`relative h-3.5 w-6 rounded-full transition-colors ${showTop5 ? "bg-primary" : "bg-linen-2"}`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 size-2.5 rounded-full bg-card transition-transform ${
                    showTop5 ? "translate-x-3" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          </div>

          <PriceDistributionPanel group={group} />
          {group.items[0]?.canonical_dish ? (
            <SimilarDishesCarousel
              canonicalDish={group.items[0].canonical_dish}
              onSelectDish={onSelectDish}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
