"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Search, Sparkles, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DishVisual } from "@/components/DishVisual";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { SearchBox } from "@/components/SearchBox";
import { getFilterMeta, listMenuItems, listRestaurants } from "@/lib/api";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, FEATURED_CATEGORIES } from "@/lib/categoryIcons";
import { formatPrice, prettyCategory } from "@/lib/format";
import type { FilterMeta, MenuItem, RestaurantSummary } from "@/lib/types";

const CLASSIC_DISHES = ["CALAMARI", "CARBONARA", "LOBSTER_RAVIOLI", "CHICKEN_PARM", "CANNOLI"];

export function DiscoverHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listMenuItems({ priced_only: "true", limit: "160" }, controller.signal),
      listRestaurants(),
      getFilterMeta(),
    ])
      .then(([menu, places, filterMeta]) => {
        setItems(menu.items);
        setRestaurants(places);
        setMeta(filterMeta);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const classics = useMemo(() => {
    const unique = new Map<string, MenuItem>();
    for (const item of items) {
      const key = item.canonical_dish ?? item.raw_name;
      if (!CLASSIC_DISHES.includes(item.canonical_dish ?? "") || unique.has(key)) continue;
      unique.set(key, item);
    }
    return [...unique.values()].slice(0, 4);
  }, [items]);

  const bestValue = useMemo(
    () =>
      [...items]
        .filter((item) => item.pct_vs_median != null && item.pct_vs_median < 0)
        .sort((a, b) => (a.pct_vs_median ?? 0) - (b.pct_vs_median ?? 0))
        .slice(0, 4),
    [items],
  );
  const openPlaces = restaurants.filter((restaurant) => restaurant.open_now).slice(0, 4);
  const categories = (meta?.categories ?? FEATURED_CATEGORIES)
    .filter((category) => FEATURED_CATEGORIES.includes(category))
    .slice(0, 6);

  function submitSearch() {
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6 md:pb-12 md:pt-8">
      <section className="rounded-[28px] border border-line bg-card shadow-[0_20px_60px_rgba(23,27,32,0.08)]">
        <div className="grid md:grid-cols-2">
          <div className="relative z-20 flex flex-col justify-center px-5 py-6 sm:px-8 sm:py-10">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-4" aria-hidden="true" /> Boston&apos;s North End
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Find the dish, then choose the table.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
              Compare official menus, prices, and open restaurants across the neighborhood.
            </p>
            <form
              className="relative mt-6 flex min-h-12 items-center rounded-2xl border border-line bg-linen px-4 shadow-inner focus-within:border-ink/30"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder="Search dishes, restaurants, or ingredients"
                variant="hero"
                ariaLabel="Search dishes, restaurants, or ingredients"
              />
              <button type="submit" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <ArrowRight className="size-4" aria-hidden="true" />
                <span className="sr-only">Search</span>
              </button>
            </form>
          </div>
          <div className="relative min-h-52 overflow-hidden rounded-b-[28px] md:min-h-full md:rounded-none md:rounded-r-[28px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/paul-revere-mall.jpg"
              alt="Paul Revere statue on the mall, with Old North Church behind it"
              className="h-52 w-full object-cover md:absolute md:inset-0 md:h-full"
            />
          </div>
        </div>
      </section>

      <Section title="Explore the North End" link="/search">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/search?category=${encodeURIComponent(category)}`}
              className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-line bg-card p-3 text-center shadow-sm transition-transform active:scale-[0.98]"
            >
              <span className="text-2xl" aria-hidden="true">{CATEGORY_ICONS[category] ?? DEFAULT_CATEGORY_ICON}</span>
              <span className="mt-2 text-xs font-bold">{prettyCategory(category)}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="North End classics" eyebrow="Start with a neighborhood favorite">
        <DishRail items={classics} loading={loading} />
      </Section>

      <Section title="Best value pasta & plates" eyebrow="Priced below the neighborhood median" icon={<TrendingDown className="size-4" />}>
        <DishRail items={bestValue} loading={loading} />
      </Section>

      <Section title="Open now" eyebrow="Restaurant photos show the venue" icon={<Clock3 className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(openPlaces.length ? openPlaces : restaurants.slice(0, 4)).map((restaurant) => (
            <Link
              key={restaurant.restaurant_id}
              href={`/restaurants/${restaurant.restaurant_id}`}
              className="group overflow-hidden rounded-2xl border border-line bg-card shadow-sm"
            >
              <RestaurantPhoto src={restaurant.photo_url} alt={restaurant.name} className="aspect-[16/9] w-full object-cover" />
              <div className="p-3">
                <p className="truncate font-bold">{restaurant.name}</p>
                <p className="mt-1 truncate text-xs text-muted">{restaurant.address}</p>
                {restaurant.open_now != null ? (
                  <p className={`mt-2 text-[10px] font-bold uppercase ${restaurant.open_now ? "text-basil" : "text-muted"}`}>
                    {restaurant.open_now ? "Open now" : "Hours available"}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function DishRail({ items, loading }: { items: MenuItem[]; loading: boolean }) {
  if (loading) {
    return <div className="h-36 animate-pulse rounded-2xl bg-linen-2" />;
  }
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.menu_item_id}
          href={`/search?q=${encodeURIComponent(item.canonical_dish?.replaceAll("_", " ") ?? item.raw_name)}`}
          className="w-[76vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-card shadow-sm sm:w-auto sm:max-w-none"
        >
          <DishVisual category={item.canonical_category} name={item.raw_name} className="h-20 w-full" showLabel />
          <div className="p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-1 font-bold">{item.raw_name}</p>
              <p className="shrink-0 font-bold text-primary">{formatPrice(item)}</p>
            </div>
            <p className="mt-1 truncate text-xs text-muted">{item.restaurant_name}</p>
            {item.pct_vs_median != null && item.pct_vs_median < 0 ? (
              <p className="mt-2 text-[10px] font-bold text-basil">{Math.abs(Math.round(item.pct_vs_median))}% below median</p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Section({
  title,
  eyebrow,
  link,
  icon,
  children,
}: {
  title: string;
  eyebrow?: string;
  link?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">{icon}{title}</h2>
          {eyebrow ? <p className="mt-0.5 text-xs text-muted">{eyebrow}</p> : null}
        </div>
        {link ? <Link href={link} className="text-xs font-bold text-primary">See all</Link> : null}
      </div>
      {children}
    </section>
  );
}
