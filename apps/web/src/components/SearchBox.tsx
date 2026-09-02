"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search, Store, Utensils, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { suggestSearch } from "@/lib/api";
import { prettyCategory } from "@/lib/format";
import type { DishSuggestion, RestaurantSuggestion, SearchSuggestions } from "@/lib/types";

const EMPTY: SearchSuggestions = { restaurants: [], dishes: [] };

type FlatItem =
  | { kind: "restaurant"; restaurant: RestaurantSuggestion }
  | { kind: "dish"; dish: DishSuggestion };

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  variant: "panel" | "hero";
  compact?: boolean;
  ariaLabel?: string;
};

export function SearchBox({
  value,
  onChange,
  placeholder,
  variant,
  compact = false,
  ariaLabel = "Search menus",
}: SearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const queryEligible = value.trim().length >= 2;
  const visibleSuggestions = queryEligible ? suggestions : EMPTY;

  const items = useMemo<FlatItem[]>(() => {
    return [
      ...visibleSuggestions.restaurants.map((restaurant) => ({ kind: "restaurant" as const, restaurant })),
      ...visibleSuggestions.dishes.map((dish) => ({ kind: "dish" as const, dish })),
    ];
  }, [visibleSuggestions]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      suggestSearch(query, controller.signal)
        .then((data) => {
          setSuggestions(data);
          const has = data.restaurants.length + data.dishes.length > 0;
          setOpen(has);
          setHighlight(-1);
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") {
            setSuggestions(EMPTY);
            setOpen(false);
          }
        });
    }, 150);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  function selectItem(item: FlatItem) {
    setOpen(false);
    setHighlight(-1);
    if (item.kind === "restaurant") {
      router.push(`/restaurants/${item.restaurant.restaurant_id}`);
      return;
    }
    onChange(item.dish.canonical_name);
    if (pathname !== "/search") {
      router.push(`/search?q=${encodeURIComponent(item.dish.canonical_name)}`);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, items.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, -1));
      return;
    }
    if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      selectItem(items[highlight]);
    }
  }

  const activeId = highlight >= 0 ? `${listId}-option-${highlight}` : undefined;
  const showList = queryEligible && open && items.length > 0;

  return (
    <div ref={rootRef} className={variant === "panel" ? "relative block min-w-0 flex-1 basis-64" : "min-w-0 flex-1"}>
      {variant === "panel" ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-muted" aria-hidden="true">
          <Search className="size-4" />
        </span>
      ) : null}
      <input
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue.trim().length < 2) { setSuggestions(EMPTY); setOpen(false); setHighlight(-1); }
          onChange(nextValue);
        }}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        className={
          variant === "panel"
            ? `w-full rounded-lg border border-line bg-card pl-9 pr-9 text-sm outline-none focus:border-ink/30 ${compact ? "h-8" : "h-10"}`
            : "min-w-0 w-full flex-1 bg-transparent px-3 text-sm outline-none"
        }
      />
      {variant === "panel" && value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setSuggestions(EMPTY);
            setOpen(false);
          }}
          aria-label="Clear search"
          className="absolute inset-y-0 right-2 z-10 flex items-center px-1 text-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className={
            variant === "hero"
              ? "absolute inset-x-0 top-full z-50 mt-3 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-[0_16px_40px_rgba(23,27,32,0.12)]"
              : "absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-[0_12px_32px_rgba(23,27,32,0.12)]"
          }
        >
          {visibleSuggestions.restaurants.length ? (
            <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted" role="presentation">
              Restaurants
            </li>
          ) : null}
          {visibleSuggestions.restaurants.map((restaurant, index) => {
            const flatIndex = index;
            return (
              <SuggestionRow
                key={restaurant.restaurant_id}
                id={`${listId}-option-${flatIndex}`}
                active={highlight === flatIndex}
                onSelect={() => selectItem({ kind: "restaurant", restaurant })}
              >
                <RestaurantPhoto
                  restaurantId={restaurant.restaurant_id}
                  localSrc={restaurant.photo_url}
                  alt=""
                  variant="thumbnail"
                  showSourceLink={false}
                  className="size-8 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{restaurant.name}</span>
                  {restaurant.primary_cuisine ? (
                    <span className="block truncate text-[11px] capitalize text-muted">
                      {prettyCategory(restaurant.primary_cuisine)}
                    </span>
                  ) : null}
                </span>
                <Store className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              </SuggestionRow>
            );
          })}
          {visibleSuggestions.dishes.length ? (
            <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted" role="presentation">
              Dishes
            </li>
          ) : null}
          {visibleSuggestions.dishes.map((dish, index) => {
            const flatIndex = visibleSuggestions.restaurants.length + index;
            return (
              <SuggestionRow
                key={dish.canonical_dish}
                id={`${listId}-option-${flatIndex}`}
                active={highlight === flatIndex}
                onSelect={() => selectItem({ kind: "dish", dish })}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linen-2 text-muted">
                  <Utensils className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{dish.canonical_name}</span>
                  <span className="block truncate text-[11px] capitalize text-muted">
                    {prettyCategory(dish.category)}
                    {dish.restaurant_count
                      ? ` · ${dish.restaurant_count} place${dish.restaurant_count === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </span>
              </SuggestionRow>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function SuggestionRow({
  id,
  active,
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <li role="option" id={id} aria-selected={active}>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSelect}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${active ? "bg-linen" : "hover:bg-linen"}`}
      >
        {children}
      </button>
    </li>
  );
}
