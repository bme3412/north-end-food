"use client";

import { useEffect, useRef, useState } from "react";

import { listSimilarDishes } from "@/lib/api";
import { formatDollars } from "@/lib/format";
import type { SimilarDish } from "@/lib/types";

export function SimilarDishesCarousel({ canonicalDish }: { canonicalDish: string }) {
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
    <section>
      <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-medium text-ink">
        Similar dishes you might like
      </h2>
      <div className="relative mt-3">
        <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {dishes.map((dish) => (
            <div
              key={dish.canonical_dish}
              className="flex w-40 shrink-0 flex-col gap-2 rounded-2xl border border-line bg-card p-3"
            >
              <div
                className="flex h-16 w-full items-center justify-center rounded-xl bg-basil-soft text-2xl"
                aria-hidden="true"
              >
                🍽️
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{dish.canonical_name}</p>
              <p className="text-xs text-muted">
                {dish.restaurant_count} place{dish.restaurant_count === 1 ? "" : "s"}
                {dish.median_price != null ? ` · ${formatDollars(dish.median_price)} median` : ""}
              </p>
            </div>
          ))}
        </div>
        {dishes.length > 3 ? (
          <button
            type="button"
            onClick={() => scrollerRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
            aria-label="Scroll for more dishes"
            className="absolute -right-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card shadow-md sm:flex"
          >
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
