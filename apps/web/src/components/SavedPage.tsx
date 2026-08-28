"use client";

import Link from "next/link";
import { Bookmark, Search } from "lucide-react";

import { DishVisual } from "@/components/DishVisual";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { SaveButton } from "@/components/SaveButton";
import { useSaved } from "@/lib/saved";

export function SavedPage() {
  const { saved, ready } = useSaved();
  const empty = saved.dishes.length === 0 && saved.restaurants.length === 0;

  if (!ready) {
    return <div className="mx-auto mt-8 h-40 max-w-xl animate-pulse rounded-3xl bg-linen-2" />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your shortlist</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Saved</h1>
      <p className="mt-1 text-sm text-muted">Stored privately on this device.</p>

      {empty ? (
        <div className="mt-8 rounded-[28px] border border-dashed border-line bg-card p-8 text-center">
          <Bookmark className="mx-auto size-8 text-muted" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold">Build a North End shortlist</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            Save a dish comparison or restaurant and it will appear here.
          </p>
          <Link href="/search" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-white">
            <Search className="size-4" aria-hidden="true" /> Start searching
          </Link>
        </div>
      ) : null}

      {saved.dishes.length ? (
        <section className="mt-7">
          <h2 className="text-sm font-bold">Dishes</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {saved.dishes.map((dish) => (
              <Link
                key={dish.menu_item_id}
                href={`/search?q=${encodeURIComponent(dish.raw_name)}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm"
              >
                <DishVisual category={dish.canonical_category} name={dish.raw_name} className="size-16 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{dish.raw_name}</span>
                  <span className="mt-1 block truncate text-xs text-muted">{dish.restaurant_name}</span>
                  <span className="mt-1 block text-xs font-bold text-primary">
                    {dish.market_price ? "Market price" : dish.price ? `$${Number(dish.price).toFixed(0)}` : "Price unavailable"}
                  </span>
                </span>
                <SaveButton kind="dish" item={dish} compact />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {saved.restaurants.length ? (
        <section className="mt-7">
          <h2 className="text-sm font-bold">Restaurants</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {saved.restaurants.map((restaurant) => (
              <Link
                key={restaurant.restaurant_id}
                href={`/restaurants/${restaurant.restaurant_id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm"
              >
                <RestaurantPhoto src={restaurant.photo_url} alt={restaurant.name} className="size-16 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{restaurant.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted">{restaurant.address}</span>
                  {restaurant.open_now != null ? (
                    <span className={`mt-1 block text-[10px] font-bold uppercase ${restaurant.open_now ? "text-basil" : "text-muted"}`}>
                      {restaurant.open_now ? "Open now" : "Closed now"}
                    </span>
                  ) : null}
                </span>
                <SaveButton kind="restaurant" item={restaurant} compact />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
