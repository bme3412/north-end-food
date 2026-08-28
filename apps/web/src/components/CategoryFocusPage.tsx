"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ArrowRight, Utensils } from "lucide-react";

import { getCategorySummary } from "@/lib/api";
import { formatDollars, prettyCategory } from "@/lib/format";
import type { CategorySummary, MenuItem, PlaceMatch } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[256px] animate-pulse rounded-xl bg-linen-2" />,
});

// The category-browse counterpart to DishFocusPage: a category-name query
// ("pasta") has no single "best" item the way a dish-name query does, so
// rather than picking one arbitrary dish to feature (the old behavior --
// see SearchWorkspace.tsx's routing comment), this shows every real dish
// identity in the category and lets picking one hand off to DishFocusPage
// via onSelectDish, reusing the same callback SimilarDishesCarousel uses.
// Layout deliberately mirrors DishFocusPage's list+persistent-map split
// (not a full-width grid) so browsing dish identities never comes at the
// cost of losing the map -- both stay visible together, same as there.
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
  places,
  items,
  onSelectDish,
  onOpenItem,
  onBrowseAll,
}: {
  category: string;
  places: PlaceMatch[];
  items: MenuItem[];
  onSelectDish: (dishName: string) => void;
  onOpenItem: (item: MenuItem) => void;
  onBrowseAll: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="h-[76px] animate-pulse rounded-xl bg-linen-2" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-linen-2" />
              ))}
            </div>
          </div>
          <div className="hidden h-[300px] animate-pulse rounded-xl bg-linen-2 lg:block" />
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
            {view === "list" ? `Dishes (${summary.dishes.length})` : "Map"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <div className={`${mobileView === "list" ? "flex" : "hidden"} min-w-0 flex-col gap-3 lg:flex`}>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summary.dishes.map((dish) => (
                <button
                  key={`${dish.canonical_dish}:${dish.pizza_serving ?? ""}`}
                  type="button"
                  onClick={() =>
                    onSelectDish(
                      dish.pizza_serving === "slice"
                        ? `slice ${dish.canonical_name}`
                        : dish.pizza_serving === "whole"
                          ? `whole ${dish.canonical_name}`
                          : dish.canonical_name,
                    )
                  }
                  className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-left shadow-[0_1px_3px_rgba(23,27,32,0.04)] transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
                >
                  <div
                    className="flex size-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 via-orange-50 to-slate-100 text-amber-700"
                    aria-hidden="true"
                  >
                    <Utensils className="size-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-ink">
                      {dish.canonical_name}
                      {dish.pizza_serving === "slice"
                        ? " — Slice"
                        : dish.pizza_serving === "whole"
                          ? " — Whole"
                          : dish.pizza_serving === "unknown"
                            ? " — Size unclear"
                            : ""}
                    </p>
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
            <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
              No {prettyCategory(category)} dishes are individually comparable yet.
            </p>
          )}

          {summary.uncategorized_count > 0 ? (
            <button
              type="button"
              onClick={onBrowseAll}
              className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-linen px-3 py-2.5 text-left text-[11px] text-muted transition-colors hover:border-primary/30 hover:bg-primary-soft/30 hover:text-ink"
            >
              <span>
                Browse all {summary.uncategorized_count} more {prettyCategory(category)} dish
                {summary.uncategorized_count === 1 ? "" : "es"} individually
              </span>
              <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className={`${mobileView === "map" ? "flex" : "hidden"} min-w-0 flex-col gap-3 lg:flex`}>
          <div className="relative h-[300px] overflow-hidden rounded-xl border border-line lg:h-full lg:min-h-[420px]">
            <MapView
              places={places}
              selectedId={selectedId}
              selectedItems={items}
              onSelect={(place) => setSelectedId(place?.restaurant_id ?? null)}
              onOpenItem={onOpenItem}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
