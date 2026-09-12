"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TrendingDown } from "lucide-react";

import { DishVisual } from "@/components/DishVisual";
import { getFeaturedMenu } from "@/lib/api";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, FEATURED_CATEGORIES } from "@/lib/categoryIcons";
import { formatPrice, prettyCategory } from "@/lib/format";
import type { FilterMeta, MenuItem } from "@/lib/types";

export function SearchBrowse({
  meta,
  onSelectCategory,
  onSelectDish,
}: {
  meta: FilterMeta | null;
  onSelectCategory: (category: string) => void;
  onSelectDish: (query: string) => void;
}) {
  const [classics, setClassics] = useState<MenuItem[]>([]);
  const [bestValue, setBestValue] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getFeaturedMenu(controller.signal)
      .then((featured) => {
        setClassics(featured.classics);
        setBestValue(featured.best_value);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setClassics([]);
          setBestValue([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const categories = (meta?.categories ?? FEATURED_CATEGORIES)
    .filter((category) => FEATURED_CATEGORIES.includes(category))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-ink">Pick a category or type a dish</h1>
        <p className="mt-1 text-sm text-muted">Search official North End menus, then compare prices and places.</p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Categories</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-line bg-card p-3 text-center shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
            >
              <span className="text-2xl" aria-hidden="true">
                {CATEGORY_ICONS[category] ?? DEFAULT_CATEGORY_ICON}
              </span>
              <span className="mt-2 text-xs font-bold capitalize">{prettyCategory(category)}</span>
            </button>
          ))}
        </div>
      </section>

      <FeaturedSection title="North End classics" eyebrow="A few neighborhood favorites" items={classics} loading={loading} onSelectDish={onSelectDish} />
      <FeaturedSection
        title="Below the median"
        eyebrow="Priced under the neighborhood typical"
        icon={<TrendingDown className="size-4" aria-hidden="true" />}
        items={bestValue}
        loading={loading}
        onSelectDish={onSelectDish}
      />
    </div>
  );
}

function FeaturedSection({
  title,
  eyebrow,
  icon,
  items,
  loading,
  onSelectDish,
}: {
  title: string;
  eyebrow: string;
  icon?: ReactNode;
  items: MenuItem[];
  loading: boolean;
  onSelectDish: (query: string) => void;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          {icon}
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted">{eyebrow}</p>
      </div>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-linen-2" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.menu_item_id}
              type="button"
              onClick={() => onSelectDish(item.canonical_dish?.replaceAll("_", " ") ?? item.raw_name)}
              className="overflow-hidden rounded-2xl border border-line bg-card text-left shadow-sm transition-colors hover:border-primary/30"
            >
              <DishVisual category={item.canonical_category} name={item.raw_name} className="h-20 w-full" showLabel />
              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-1 font-bold">{item.raw_name}</p>
                  <p className="shrink-0 font-bold text-primary">{formatPrice(item)}</p>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{item.restaurant_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
