"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Utensils } from "lucide-react";

import { listSimilarDishes } from "@/lib/api";
import { formatDollars } from "@/lib/format";
import type { SimilarDish } from "@/lib/types";

export function SimilarDishesCarousel({
  canonicalDish,
  onSelectDish,
}: {
  canonicalDish: string;
  onSelectDish?: (dishName: string) => void;
}) {
  const [dishes, setDishes] = useState<SimilarDish[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listSimilarDishes(canonicalDish)
      .then((data) => {
        if (!cancelled) setDishes(data.dishes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canonicalDish]);

  // Never fabricated data: /menu-items/similar-dishes returns [] rather
  // than an error or an invented entry when a dish's category has no
  // priced siblings -- this hides the whole section in that case instead
  // of showing an empty carousel shell.
  if (dishes.length === 0) return null;

  return (
    <section className="min-w-0">
      <h2 className="text-[11px] font-bold text-ink">
        Similar dishes you might like
      </h2>
      <div className="relative mt-2">
        <div ref={scrollerRef} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {dishes.map((dish) => (
            <button
              type="button"
              key={dish.canonical_dish}
              onClick={() => onSelectDish?.(dish.canonical_name)}
              className="flex w-[122px] shrink-0 items-center gap-2 rounded-lg border border-line bg-card p-1.5 text-left shadow-[0_1px_3px_rgba(23,27,32,0.04)] transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 via-orange-50 to-slate-100 text-amber-700"
                aria-hidden="true"
              >
                <Utensils className="size-4" strokeWidth={1.5} />
              </div>
              <span className="min-w-0">
                <span className="line-clamp-1 block text-[9px] font-semibold text-ink">{dish.canonical_name}</span>
                <span className="mt-0.5 block whitespace-nowrap text-[7px] text-muted">
                  {dish.restaurant_count} place{dish.restaurant_count === 1 ? "" : "s"}
                  {dish.median_price != null ? ` · ${formatDollars(dish.median_price)} med.` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
        {dishes.length > 3 ? (
          <button
            type="button"
            onClick={() => scrollerRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
            aria-label="Scroll for more dishes"
            className="absolute -right-2 top-1/2 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card shadow-md sm:flex"
          >
            <ArrowRight className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
