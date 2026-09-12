"use client";

import Link from "next/link";
import { Clock3, Map, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SearchBox } from "@/components/SearchBox";
import { getFeaturedMenu, getFilterMeta, listRestaurants } from "@/lib/api";
import { formatDollars, formatPrice, formatPriceLevel, prettyCategory } from "@/lib/format";
import { rangePositionPercent } from "@/lib/priceScale";
import { LiveClock } from "@/components/LiveClock";
import type { FeaturedCompareDish, FeaturedMenu, FilterMeta, MenuItem, RestaurantSummary } from "@/lib/types";

const LANDING_CATEGORIES = ["pasta", "pizza", "seafood", "antipasti", "meat", "dessert", "bakery"];
const COMPARE_TITLES: Record<string, string> = {
  LOBSTER_RAVIOLI: "Lobster Ravioli",
  CHICKEN_PARMIGIANA: "Chicken Parmigiana",
  CARBONARA: "Spaghetti alla Carbonara",
  CALAMARI: "New England Fritto Misto",
};

export function DiscoverHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<FeaturedMenu | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getFeaturedMenu(controller.signal), listRestaurants(), getFilterMeta()])
      .then(([menu, places, filterMeta]) => {
        setFeatured(menu);
        setRestaurants(places);
        setMeta(filterMeta);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setFeatured({ classics: [], best_value: [], compare: [] });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const openPlaces = useMemo(() => {
    return restaurants
      .filter((restaurant) => restaurant.open_now)
      .sort((a, b) => (b.closes_sort ?? -1) - (a.closes_sort ?? -1))
      .slice(0, 5);
  }, [restaurants]);
  const openCount = restaurants.filter((restaurant) => restaurant.open_now).length;

  function submitSearch() {
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 md:pb-16 md:pt-12">
      <section className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {restaurants.length || 44} official menus · Boston&apos;s North End
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-ink sm:text-5xl lg:text-[56px]">
          Find the dish, then choose the table.
        </h1>
        <form
          className="mx-auto mt-8 flex max-w-2xl items-center rounded-full border border-line bg-card py-1.5 pl-5 pr-1.5 shadow-[0_8px_30px_rgba(23,27,32,0.06)]"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={'Try “lobster ravioli under $35” or “pizza by the slice”'}
            variant="hero"
            starterQueries={["lobster ravioli under $35", "pizza by the slice", "vegetarian", "Neptune Oyster"]}
            ariaLabel="Search dishes, restaurants, or ingredients"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {LANDING_CATEGORIES.map((category) => {
            const count = meta?.category_counts?.[category];
            return (
              <Link
                key={category}
                href={`/search?category=${encodeURIComponent(category)}`}
                className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] capitalize text-ink shadow-sm hover:border-ink/20"
              >
                <span className="font-medium">{prettyCategory(category)}</span>
                {count != null ? <span className="ml-1.5 tabular-nums text-muted">{count}</span> : null}
              </Link>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/search?dietary=vegetarian"
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-sm hover:border-ink/20"
          >
            Vegetarian
          </Link>
          <Link
            href="/search?q=late%20night"
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-sm hover:border-ink/20"
          >
            Open late
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">Compare a classic</h2>
            <p className="mt-1 text-sm text-muted">One dish, every kitchen that serves it, side by side.</p>
          </div>
          <Link href="/search" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
            All dishes
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-linen-2" />
              ))
            : (featured?.compare ?? []).map((dish) => <ClassicCompareCard key={dish.canonical_dish} dish={dish} />)}
        </div>
      </section>

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
                <Clock3 className="size-5" aria-hidden="true" />
                Open right now
              </h2>
              <p className="mt-1 text-sm text-muted">
                {openCount} of {restaurants.length || 44} open
                {openCount ? (
                  <>
                    {" "}
                    at <LiveClock />
                  </>
                ) : null}
                , closing soonest last.
              </p>
            </div>
            <Link href="/search?view=map" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
              <Map className="size-3.5" aria-hidden="true" />
              Map
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <li key={index} className="h-[72px] animate-pulse bg-linen-2 first:rounded-t-2xl last:rounded-b-2xl" />
                ))
              : openPlaces.map((restaurant) => (
                  <OpenRestaurantRow key={restaurant.restaurant_id} restaurant={restaurant} />
                ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight text-ink">Best value tonight</h2>
          <p className="mt-1 text-sm text-muted">
            Priced well under the neighborhood median, at places open now.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <li key={index} className="h-[72px] animate-pulse bg-linen-2 first:rounded-t-2xl last:rounded-b-2xl" />
                ))
              : (featured?.best_value ?? []).map((item) => <ValueRow key={item.menu_item_id} item={item} />)}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ClassicCompareCard({ dish }: { dish: FeaturedCompareDish }) {
  const min = dish.min_price != null ? Number(dish.min_price) : null;
  const max = dish.max_price != null ? Number(dish.max_price) : null;
  const median = dish.median_price != null ? Number(dish.median_price) : null;
  const tick = rangePositionPercent(median, min, max);
  const popular = dish.restaurant_count >= 5;
  return (
    <Link
      href={`/search?q=${encodeURIComponent(dish.canonical_name)}`}
      className="rounded-2xl border border-line bg-card p-4 text-left shadow-[0_1px_4px_rgba(23,27,32,0.04)] transition-colors hover:border-ink/20"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-tight text-ink">
          {COMPARE_TITLES[dish.canonical_dish] ?? dish.canonical_name}
        </h3>
        {popular ? (
          <span className="shrink-0 rounded-full bg-basil-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-basil">
            Popular
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {prettyCategory(dish.category)} · {dish.restaurant_count} restaurant{dish.restaurant_count === 1 ? "" : "s"}
      </p>
      {min != null && max != null ? (
        <div className="mt-5">
          <div className="relative h-1.5 rounded-full bg-linen-2">
            {tick != null ? (
              <span
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                style={{ left: `${tick}%` }}
              />
            ) : null}
          </div>
          <div className="relative mt-2 h-4 text-[11px] tabular-nums text-muted">
            <span className="absolute left-0">{formatDollars(min)}</span>
            {median != null && tick != null ? (
              <span className="absolute -translate-x-1/2 text-ink" style={{ left: `${tick}%` }}>
                {formatDollars(median)}
              </span>
            ) : null}
            <span className="absolute right-0">{formatDollars(max)}</span>
          </div>
        </div>
      ) : null}
    </Link>
  );
}

function OpenRestaurantRow({ restaurant }: { restaurant: RestaurantSummary }) {
  const initial = restaurant.name.replace(/^(The|A)\s+/i, "").charAt(0).toUpperCase();
  return (
    <li>
      <Link href={`/restaurants/${restaurant.restaurant_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-linen/70">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linen-2 text-sm font-bold text-ink">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{restaurant.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {prettyCategory(restaurant.primary_cuisine || restaurant.establishment_type)}
            {restaurant.price_level != null ? ` · ${formatPriceLevel(restaurant.price_level)}` : ""}
            {restaurant.lowest_price != null ? ` · from ${formatDollars(restaurant.lowest_price)}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-[12px] font-medium ${restaurant.closes_at === "Open 24 hours" ? "text-basil" : "text-basil"}`}>
            {restaurant.closes_at ?? "Hours listed"}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">{busynessLabel(restaurant)}</span>
        </span>
      </Link>
    </li>
  );
}

function ValueRow({ item }: { item: MenuItem }) {
  const below = item.pct_vs_median != null ? Math.abs(Math.round(item.pct_vs_median)) : null;
  return (
    <li>
      <Link
        href={`/search?q=${encodeURIComponent(item.canonical_dish?.replaceAll("_", " ") ?? item.raw_name)}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-linen/70"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{item.raw_name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {item.restaurant_name}
            {item.north_end_median_price != null ? ` · median ${formatDollars(item.north_end_median_price)}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-bold tabular-nums text-ink">{formatPrice(item)}</span>
          {below != null ? <span className="mt-0.5 block text-[11px] font-medium text-basil">{below}% below median</span> : null}
        </span>
      </Link>
    </li>
  );
}

function busynessLabel(restaurant: RestaurantSummary): string {
  const percent = restaurant.busyness_percent;
  if (restaurant.closes_sort != null && restaurant.closes_sort < 24 * 60) {
    const now = new Date();
    const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const minutesNow = ny.getHours() * 60 + ny.getMinutes();
    if (restaurant.closes_sort - minutesNow <= 90 && restaurant.closes_sort - minutesNow >= 0) {
      return "Last seating soon";
    }
  }
  if (percent == null) return "";
  if (percent <= 15) return "Quiet";
  if (percent <= 35) return "Usually quiet now";
  if (percent <= 60) return "Moderately busy";
  return "Busier than usual";
}
