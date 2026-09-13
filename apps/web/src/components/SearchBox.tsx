"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search, Store, Utensils, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { suggestSearch } from "@/lib/api";
import { prettyCategory } from "@/lib/format";
import type { DishSuggestion, RestaurantSuggestion, SearchSuggestions } from "@/lib/types";

const EMPTY: SearchSuggestions = { restaurants: [], dishes: [] };

type FlatItem =
  | { kind: "query"; query: string }
  | { kind: "starter"; query: string }
  | { kind: "restaurant"; restaurant: RestaurantSuggestion }
  | { kind: "dish"; dish: DishSuggestion };

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder: string;
  variant: "panel" | "hero";
  compact?: boolean;
  autoFocus?: boolean;
  starterQueries?: string[];
  ariaLabel?: string;
};

export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  variant,
  compact = false,
  autoFocus = false,
  starterQueries = [],
  ariaLabel = "Search menus",
}: SearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const query = value.trim();
  const queryEligible = query.length >= 2;
  const visibleSuggestions = queryEligible ? suggestions : EMPTY;
  const showStarters = open && focused && !queryEligible && starterQueries.length > 0;

  const items = useMemo<FlatItem[]>(() => {
    if (showStarters) {
      return starterQueries.map((starter) => ({ kind: "starter" as const, query: starter }));
    }
    const next: FlatItem[] = [];
    if (queryEligible) next.push({ kind: "query", query });
    for (const restaurant of visibleSuggestions.restaurants) {
      next.push({ kind: "restaurant", restaurant });
    }
    for (const dish of visibleSuggestions.dishes) {
      next.push({ kind: "dish", dish });
    }
    return next;
  }, [query, queryEligible, showStarters, starterQueries, visibleSuggestions]);

  useEffect(() => {
    if (!queryEligible || !focused) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      suggestSearch(query, controller.signal)
        .then((data) => {
          setSuggestions(data);
          if (inputRef.current === document.activeElement) {
            setOpen(true);
          }
          setHighlight(-1);
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") {
            setSuggestions(EMPTY);
            if (inputRef.current === document.activeElement) {
              setOpen(true);
            }
            setHighlight(-1);
          }
        });
    }, 150);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [query, queryEligible, focused]);

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

  function applyQuery(next: string) {
    onChange(next);
    onSubmit?.(next);
    if (pathname !== "/search") {
      router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
    }
  }

  function closeSuggestions() {
    setOpen(false);
    setHighlight(-1);
    setFocused(false);
    inputRef.current?.blur();
  }

  function selectItem(item: FlatItem) {
    closeSuggestions();
    if (item.kind === "restaurant") {
      router.push(`/restaurants/${item.restaurant.restaurant_id}`);
      return;
    }
    if (item.kind === "dish") {
      applyQuery(item.dish.canonical_name);
      return;
    }
    applyQuery(item.query);
  }

  function submitCurrent() {
    closeSuggestions();
    applyQuery(query);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (event.key === "Enter") {
      if (open && highlight >= 0 && items[highlight]) {
        event.preventDefault();
        selectItem(items[highlight]);
        return;
      }
      event.preventDefault();
      submitCurrent();
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
    }
  }

  const activeId = highlight >= 0 ? `${listId}-option-${highlight}` : undefined;
  const showList = open && items.length > 0;

  return (
    <div ref={rootRef} className={variant === "panel" ? "relative min-w-0 flex-1" : "min-w-0 flex-1"}>
      {variant === "panel" ? (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 z-10 flex items-center text-muted" aria-hidden="true">
          <Search className="size-4" />
        </span>
      ) : null}
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue.trim().length < 2) {
            setSuggestions(EMPTY);
            setHighlight(-1);
          }
          onChange(nextValue);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
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
            ? `w-full rounded-xl border border-line bg-linen pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted/80 focus:border-ink/35 focus:bg-card ${compact ? "h-10" : "h-12"}`
            : "min-w-0 w-full flex-1 bg-transparent px-3 text-sm outline-none"
        }
      />
      {variant === "panel" && value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onSubmit?.("");
            setSuggestions(EMPTY);
            setOpen(false);
          }}
          aria-label="Clear search"
          className="absolute inset-y-0 right-2 z-10 flex items-center px-1.5 text-muted hover:text-ink"
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
          {showStarters ? (
            <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted" role="presentation">
              Try a search
            </li>
          ) : null}
          {items.map((item, index) => {
            const id = `${listId}-option-${index}`;
            const previous = items[index - 1];
            const showRestaurantLabel = item.kind === "restaurant" && previous?.kind !== "restaurant";
            const showDishLabel = item.kind === "dish" && previous?.kind !== "dish";
            return (
              <Fragment key={item.kind === "restaurant" ? item.restaurant.restaurant_id : item.kind === "dish" ? item.dish.canonical_dish : `${item.kind}-${item.query}`}>
                {showRestaurantLabel ? (
                  <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted" role="presentation">
                    Restaurants
                  </li>
                ) : null}
                {showDishLabel ? (
                  <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted" role="presentation">
                    Dishes
                  </li>
                ) : null}
                {item.kind === "starter" ? (
                  <SuggestionRow id={id} active={highlight === index} onSelect={() => selectItem(item)}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linen-2 text-muted">
                      <Search className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.query}</span>
                  </SuggestionRow>
                ) : null}
                {item.kind === "query" ? (
                  <SuggestionRow id={id} active={highlight === index} onSelect={() => selectItem(item)}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Search className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">Search menus for “{item.query}”</span>
                      <span className="block text-[11px] text-muted">Dishes, restaurants, and ingredients</span>
                    </span>
                  </SuggestionRow>
                ) : null}
                {item.kind === "restaurant" ? (
                  <SuggestionRow id={id} active={highlight === index} onSelect={() => selectItem(item)}>
                    <RestaurantPhoto
                      restaurantId={item.restaurant.restaurant_id}
                      localSrc={item.restaurant.photo_url}
                      alt=""
                      variant="thumbnail"
                      showSourceLink={false}
                      className="size-8 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{item.restaurant.name}</span>
                      {item.restaurant.primary_cuisine ? (
                        <span className="block truncate text-[11px] capitalize text-muted">
                          {prettyCategory(item.restaurant.primary_cuisine)}
                        </span>
                      ) : null}
                    </span>
                    <Store className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  </SuggestionRow>
                ) : null}
                {item.kind === "dish" ? (
                  <SuggestionRow id={id} active={highlight === index} onSelect={() => selectItem(item)}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linen-2 text-muted">
                      <Utensils className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{item.dish.canonical_name}</span>
                      <span className="block truncate text-[11px] capitalize text-muted">
                        {prettyCategory(item.dish.category)}
                        {item.dish.restaurant_count
                          ? ` · ${item.dish.restaurant_count} place${item.dish.restaurant_count === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </span>
                  </SuggestionRow>
                ) : null}
              </Fragment>
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
