"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ChevronDown, Search, Settings2, ShoppingBag, Tag, Utensils, X } from "lucide-react";

import { useAsOfTime } from "@/lib/asOfTime";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, FEATURED_CATEGORIES } from "@/lib/categoryIcons";
import { prettyCategory } from "@/lib/format";
import type { FilterState } from "@/lib/filters";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { useServiceMode } from "@/lib/serviceMode";
import type { FilterMeta } from "@/lib/types";

// Real, clickable examples (each one sets `filters.q`), not decorative
// text -- picked to showcase the natural-language price/filter parsing
// (see app/routers/menu_items.py's query parsing) alongside a plain dish
// and a plain restaurant name search.
const SUGGESTED_QUERIES = ["lobster ravioli under $35", "pasta open now", "vegetarian", "Neptune Oyster"];

const UNDER_THIRTY = "30";

type FilterPanelProps = {
  filters: FilterState;
  meta: FilterMeta | null;
  parsedTokens: string[];
  onChange: (next: FilterState) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  compact?: boolean;
};

export function FilterPanel({
  filters,
  meta,
  parsedTokens,
  onChange,
  expanded,
  onToggleExpanded,
  compact = false,
}: FilterPanelProps) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleInList = (key: "categories" | "dietary", value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    set(key, next);
  };

  const pickerFor = (key: "subcategories" | "protein" | "ingredients") => ({
    onAdd: (value: string) => {
      if (filters[key].includes(value)) return;
      set(key, [...filters[key], value]);
    },
    onRemove: (value: string) => {
      set(
        key,
        filters[key].filter((item) => item !== value),
      );
    },
  });

  return (
    <div className={`bg-card/95 backdrop-blur-sm ${compact ? "px-4 py-1.5" : "p-4"}`}>
      <div className={`flex items-center ${compact ? "gap-4" : "flex-wrap gap-3"}`}>
        <label className="relative block min-w-0 flex-1 basis-64">
          <span className="sr-only">Search menus</span>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted" aria-hidden="true">
            <Search className="size-4" />
          </span>
          <input
            value={filters.q}
            onChange={(event) => set("q", event.target.value)}
            inputMode="search"
            placeholder="Search North End…"
            className={`w-full rounded-lg border border-line bg-card pl-9 pr-9 text-sm outline-none ring-primary/20 focus:border-primary focus:ring-2 ${
              compact ? "h-8" : "h-10"
            }`}
          />
          {filters.q ? (
            <button
              type="button"
              onClick={() => set("q", "")}
              aria-label="Clear search"
              className="absolute inset-y-0 right-2 flex items-center px-1 text-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <p className={`min-w-0 items-center gap-2 whitespace-nowrap text-[10px] text-muted ${compact ? "hidden lg:flex" : "flex flex-wrap"}`}>
          <span className="shrink-0">Try:</span>
          {SUGGESTED_QUERIES.map((query) => (
            <button
              key={query}
              type="button"
              onClick={() => set("q", query)}
              className="text-muted transition-colors hover:text-primary"
            >
              &ldquo;{query}&rdquo;
            </button>
          ))}
        </p>
      </div>

      <FilterChipRow
        filters={filters}
        onChange={onChange}
        onToggleExpanded={onToggleExpanded}
        expanded={expanded}
        compact={compact}
      />

      {!compact ? <div className="mt-3 flex flex-wrap gap-2">
        {(meta?.categories ?? [])
          .filter((category) => FEATURED_CATEGORIES.includes(category))
          .map((category) => {
          const active = filters.categories.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleInList("categories", category)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm capitalize ${
                active ? "bg-ink text-linen" : "border border-line bg-linen"
              }`}
            >
              <span aria-hidden="true">{CATEGORY_ICONS[category] ?? DEFAULT_CATEGORY_ICON}</span>
              {prettyCategory(category)}
            </button>
          );
        })}
      </div> : null}

      {!compact && parsedTokens.length ? (
        <p className="mt-3 text-xs text-muted">
          Also matching:{" "}
          {parsedTokens.map((token) => (
            <span key={token} className="mr-1 inline-block rounded-full bg-linen-2 px-2 py-0.5 capitalize">
              {token}
            </span>
          ))}
        </p>
      ) : null}

      {expanded ? (
        <>
        <button
          type="button"
          aria-label="Close filters"
          onClick={onToggleExpanded}
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] md:hidden"
        />
        <div className="mobile-filter-sheet fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] space-y-4 overflow-y-auto rounded-t-[28px] border-t border-line bg-card px-5 pb-6 pt-3 shadow-2xl md:static md:mt-4 md:max-h-none md:rounded-none md:border-t md:bg-transparent md:px-0 md:pb-0 md:pt-4 md:shadow-none">
          <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between border-b border-line bg-card/95 px-5 pb-3 pt-1 backdrop-blur md:hidden">
            <div>
              <h2 className="text-base font-bold">Filters</h2>
              <p className="text-[10px] text-muted">Refine restaurants and dishes</p>
            </div>
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label="Close filters"
              className="flex size-11 items-center justify-center rounded-full bg-linen-2"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {meta?.categories.length ? (
            <Field label="Category">
              <ChipGrid
                options={meta.categories}
                selected={filters.categories}
                onToggle={(value) => toggleInList("categories", value)}
                labelFor={prettyCategory}
              />
            </Field>
          ) : null}

          {meta?.subcategories.length ? (
            <Field label="Style">
              <SearchPicker
                options={meta.subcategories}
                selected={filters.subcategories}
                placeholder="Search styles (stuffed, raw bar…)"
                labelFor={prettyCategory}
                {...pickerFor("subcategories")}
              />
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min $">
              <input
                value={filters.minPrice}
                onChange={(event) => set("minPrice", event.target.value)}
                inputMode="decimal"
                placeholder={meta?.min_price != null ? String(meta.min_price) : "0"}
                className="h-10 w-full rounded-xl border border-line bg-linen px-3"
              />
            </Field>
            <Field label="Max $">
              <input
                value={filters.maxPrice}
                onChange={(event) => set("maxPrice", event.target.value)}
                inputMode="decimal"
                placeholder={meta?.max_price != null ? String(meta.max_price) : "100"}
                className="h-10 w-full rounded-xl border border-line bg-linen px-3"
              />
            </Field>
          </div>

          {meta?.proteins.length ? (
            <Field label="Protein">
              <SearchPicker
                options={meta.proteins}
                selected={filters.protein}
                placeholder="Search proteins (lobster, chicken…)"
                {...pickerFor("protein")}
              />
              {filters.protein.length > 1 ? (
                <MatchModeToggle mode={filters.proteinMode} onChange={(mode) => set("proteinMode", mode)} />
              ) : null}
            </Field>
          ) : null}

          <Field label="Ingredient">
            <SearchPicker
              options={meta?.ingredients ?? []}
              selected={filters.ingredients}
              placeholder="Search ingredients (truffle, basil…)"
              {...pickerFor("ingredients")}
            />
            {filters.ingredients.length > 1 ? (
              <MatchModeToggle mode={filters.ingredientMode} onChange={(mode) => set("ingredientMode", mode)} />
            ) : null}
          </Field>

          {meta?.dietary.length ? (
            <Field label="Dietary">
              <ChipGrid options={meta.dietary} selected={filters.dietary} onToggle={(value) => toggleInList("dietary", value)} />
            </Field>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.pricedOnly}
                onChange={(event) => set("pricedOnly", event.target.checked)}
                className="size-4 rounded border-line"
              />
              Priced items only
            </label>
            <label className="flex items-center gap-2 text-sm">
              Sort
              <select
                value={filters.sort}
                onChange={(event) => set("sort", event.target.value as FilterState["sort"])}
                className="rounded-lg border border-line bg-linen px-2 py-1"
              >
                <option value="relevance">Best match</option>
                <option value="price">Price</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-sm text-muted underline underline-offset-4"
          >
            Clear all filters
          </button>
          <button
            type="button"
            onClick={onToggleExpanded}
            className="sticky bottom-0 min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-white shadow-lg md:hidden"
          >
            Show results
          </button>
        </div>
        </>
      ) : null}
    </div>
  );
}

const SORT_LABELS: Record<FilterState["sort"], string> = {
  relevance: "Best match",
  price: "Lowest price",
  name: "Name",
};

// The quick-access row from the mockup: sort, open-now, dine-in/takeout,
// a one-tap price cap, and the trigger for the full filter drawer below.
// Reads/writes the same shared contexts the header does (useAsOfTime,
// useServiceMode) so toggling here and toggling in the header always agree
// -- there's exactly one source of truth for each, just two places to
// reach it from.
function FilterChipRow({
  filters,
  onChange,
  expanded,
  onToggleExpanded,
  compact,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  compact: boolean;
}) {
  const { openNowEnabled, setOpenNowEnabled } = useAsOfTime();
  const { mode, setMode } = useServiceMode();
  const underThirty = filters.maxPrice === UNDER_THIRTY;

  return (
    <div className={`${compact ? "mt-1.5" : "mt-3"} flex flex-wrap items-center gap-2`}>
      <label className="relative">
        <span className="sr-only">Sort</span>
        <select
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value as FilterState["sort"] })}
          className="h-7 appearance-none rounded-lg bg-ink py-1 pl-3 pr-7 text-[11px] font-medium text-white outline-none"
        >
          {(Object.keys(SORT_LABELS) as FilterState["sort"][]).map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[0.6rem] text-linen"
        >
          <ChevronDown className="size-3" />
        </span>
      </label>

      <ChipToggle active={openNowEnabled} onClick={() => setOpenNowEnabled(!openNowEnabled)}>
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${openNowEnabled ? "bg-basil" : "bg-muted/40"}`}
        />
        Open now
      </ChipToggle>

      <ChipToggle active={mode === "dine-in"} onClick={() => setMode("dine-in")}>
        <Utensils className="size-3.5" aria-hidden="true" /> Dine-in
      </ChipToggle>
      <ChipToggle active={mode === "takeout"} onClick={() => setMode("takeout")}>
        <ShoppingBag className="size-3.5" aria-hidden="true" /> Takeout
      </ChipToggle>

      <ChipToggle
        active={underThirty}
        onClick={() => onChange({ ...filters, maxPrice: underThirty ? "" : UNDER_THIRTY })}
      >
        <Tag className="size-3.5" aria-hidden="true" /> Under $30
      </ChipToggle>

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className={`flex h-7 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium ${
          expanded ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-linen"
        }`}
      >
        <Settings2 className="size-3.5" aria-hidden="true" /> More filters
      </button>
    </div>
  );
}

function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-7 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium ${
        active ? "border-basil/20 bg-basil-soft text-basil" : "border-line bg-card text-ink hover:bg-linen"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
  labelFor,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  labelFor?: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-full px-3 py-1.5 text-sm capitalize ${
              active ? "bg-ink text-linen" : "border border-line bg-linen"
            }`}
          >
            {labelFor ? labelFor(option) : option}
          </button>
        );
      })}
    </div>
  );
}

function MatchModeToggle({
  mode,
  onChange,
}: {
  mode: "any" | "all";
  onChange: (mode: "any" | "all") => void;
}) {
  return (
    <div className="mt-2 flex gap-2">
      {(["any", "all"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`rounded-full px-3 py-1 text-xs ${mode === value ? "bg-basil text-linen" : "bg-linen-2"}`}
        >
          Match {value}
        </button>
      ))}
    </div>
  );
}

function SearchPicker({
  options,
  selected,
  onAdd,
  onRemove,
  placeholder,
  labelFor,
}: {
  options: string[];
  selected: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder: string;
  labelFor?: (value: string) => string;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((name) => (labelFor ? labelFor(name) : name).toLowerCase().includes(q) && !selected.includes(name))
      .slice(0, 8);
  }, [query, options, selected, labelFor]);

  return (
    <div>
      {selected.length ? (
        <div className="mb-2 flex flex-wrap gap-2 capitalize">
          {selected.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onRemove(name)}
              className="rounded-full bg-basil px-3 py-1.5 text-sm text-linen"
            >
              {labelFor ? labelFor(name) : name} ×
            </button>
          ))}
        </div>
      ) : null}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-linen px-3"
      />
      {matches.length ? (
        <div className="mt-2 flex flex-wrap gap-2 capitalize">
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onAdd(name);
                setQuery("");
              }}
              className="rounded-full border border-line bg-linen px-3 py-1.5 text-sm"
            >
              {labelFor ? labelFor(name) : name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
