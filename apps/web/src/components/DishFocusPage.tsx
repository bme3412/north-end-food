"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { PriceLadder } from "@/components/PriceLadder";
import { SimilarDishesCarousel } from "@/components/SimilarDishesCarousel";
import { dishGroupMedian, oneItemPerRestaurant, type DishGroup } from "@/lib/dishGroups";
import type { MenuItem, PlaceMatch } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[256px] animate-pulse rounded-xl bg-linen-2" />,
});

const TOP_SLICE = 5;

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

export function DishFocusPage({
  group,
  showMap = false,
  onSelectDish,
  onBack,
  onOpen,
}: {
  group: DishGroup;
  showMap?: boolean;
  onSelectDish: (dishName: string) => void;
  onBack?: () => void;
  onOpen?: (item: MenuItem) => void;
}) {
  const [showTop5, setShowTop5] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const keepEveryItem = group.key.startsWith("kids-cat-");
  const medianPrice = dishGroupMedian(group);

  const pricedItems = useMemo(() => {
    return [...group.items].sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return Number(a.price) - Number(b.price);
    });
  }, [group.items]);

  const ladderItems = useMemo(
    () => (keepEveryItem ? pricedItems : oneItemPerRestaurant(pricedItems)),
    [keepEveryItem, pricedItems],
  );
  const restaurantItems = useMemo(() => oneItemPerRestaurant(pricedItems), [pricedItems]);
  const mapItems = showTop5 ? restaurantItems.slice(0, TOP_SLICE) : restaurantItems;

  const places = useMemo(() => mapItems.map(itemToPlaceMatch), [mapItems]);
  const ranks = useMemo(() => {
    const map: Record<string, number> = {};
    restaurantItems.forEach((item, index) => {
      map[item.restaurant_id] = index + 1;
    });
    return map;
  }, [restaurantItems]);

  const selectedItem = restaurantItems.find((item) => item.restaurant_id === selectedId) ?? null;
  const similar = group.items[0]?.canonical_dish ? (
    <SimilarDishesCarousel canonicalDish={group.items[0].canonical_dish} onSelectDish={onSelectDish} />
  ) : null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5">
      <div className={`grid gap-4 ${showMap ? "lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]" : ""}`}>
        <div className={`${showMap ? "hidden lg:flex" : "flex"} min-w-0 flex-col gap-3`}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="self-start text-[11px] font-medium text-basil underline underline-offset-2"
            >
              All matching dishes
            </button>
          ) : null}
          <PriceLadder
            items={ladderItems}
            displayName={group.displayName}
            medianPrice={medianPrice}
            onOpen={(item) => onOpen?.(item)}
          />
          {!showMap ? similar : null}
        </div>

        {showMap ? (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative h-[300px] overflow-hidden rounded-xl border border-line lg:h-full lg:min-h-[420px]">
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
          {similar}
        </div>
        ) : null}
      </div>
    </div>
  );
}
