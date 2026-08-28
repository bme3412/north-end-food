"use client";

import { useEffect, useState } from "react";
import { Utensils } from "lucide-react";

import { getCategorySummary } from "@/lib/api";
import { formatDollars, prettyCategory } from "@/lib/format";
import type { CategorySummary } from "@/lib/types";

// The category-browse counterpart to DishFocusPage: a category-name query
// ("pasta") has no single "best" item the way a dish-name query does, so
// rather than picking one arbitrary dish to feature (the old behavior --
// see SearchWorkspace.tsx's routing comment), this shows every real dish
// identity in the category and lets picking one hand off to DishFocusPage
// via onSelectDish, reusing the same callback SimilarDishesCarousel uses.
type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: CategorySummary };

// Rendered with `key={category}` by the caller (SearchWorkspace.tsx), so a
// category change remounts this component and the initial `useState`
// value handles resetting to "loading" -- no effect-body setState needed
// to reset state on prop change, just the one forward transition once the
// fetch settles.
export function CategoryFocusPage({
  category,
  onSelectDish,
}: {
  category: string;
  onSelectDish: (dishName: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getCategorySummary(category)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", summary: data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5">
        <div className="h-[76px] animate-pulse rounded-xl bg-linen-2" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-linen-2" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 text-center sm:px-5">
        <p className="text-sm text-muted">Can’t load {prettyCategory(category)} dishes right now.</p>
      </div>
    );
  }

  const { summary } = state;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5">
      <section className="rounded-xl border border-line bg-card p-3 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
        <h1 className="text-[17px] font-bold capitalize leading-tight tracking-[-0.02em] text-ink">
          {prettyCategory(summary.category)}
        </h1>
        <p className="mt-1 text-[11px] text-muted">
          {summary.total_items} dish{summary.total_items === 1 ? "" : "es"} across {summary.restaurant_count}{" "}
          restaurant{summary.restaurant_count === 1 ? "" : "s"}
        </p>
      </section>

      {summary.dishes.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {summary.dishes.map((dish) => (
            <button
              key={dish.canonical_dish}
              type="button"
              onClick={() => onSelectDish(dish.canonical_name)}
              className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-left shadow-[0_1px_3px_rgba(23,27,32,0.04)] transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
            >
              <div
                className="flex size-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 via-orange-50 to-slate-100 text-amber-700"
                aria-hidden="true"
              >
                <Utensils className="size-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-ink">{dish.canonical_name}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {dish.restaurant_count} restaurant{dish.restaurant_count === 1 ? "" : "s"}
                </p>
                {dish.min_price != null && dish.max_price != null ? (
                  <p className="mt-1 text-[11px] font-bold text-ink">
                    {formatDollars(dish.min_price)}–{formatDollars(dish.max_price)}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          No {prettyCategory(category)} dishes are individually comparable yet.
        </p>
      )}

      {summary.uncategorized_count > 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-linen px-3 py-2.5 text-[11px] text-muted">
          + {summary.uncategorized_count} more {prettyCategory(category)} dish
          {summary.uncategorized_count === 1 ? "" : "es"} on North End menus, not yet grouped into a comparable dish
          type.
        </div>
      ) : null}
    </div>
  );
}
