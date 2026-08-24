"use client";

import type { ReactNode } from "react";

import { prettyCategory } from "@/lib/format";
import type { FilterState } from "@/lib/filters";
import { DEFAULT_FILTERS } from "@/lib/filters";
import type { FilterMeta } from "@/lib/types";

const SUGGESTIONS = [
  "lobster ravioli under $35",
  "seafood pasta",
  "vegetarian pizza",
  "octopus",
  "cannoli",
];

type FilterPanelProps = {
  filters: FilterState;
  meta: FilterMeta | null;
  parsedTokens: string[];
  onChange: (next: FilterState) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function FilterPanel({
  filters,
  meta,
  parsedTokens,
  onChange,
  expanded,
  onToggleExpanded,
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

  return (
    <div className="border-b border-line bg-card/80 p-4 backdrop-blur-sm">
      <label className="block">
        <span className="sr-only">Search menus</span>
        <input
          value={filters.q}
          onChange={(event) => set("q", event.target.value)}
          inputMode="search"
          placeholder="lobster ravioli under $30, gluten-free…"
          className="h-12 w-full rounded-xl border border-line bg-linen px-3 text-[0.98rem] outline-none ring-tomato/25 focus:ring-4"
        />
      </label>

      {parsedTokens.length ? (
        <p className="mt-2 text-xs text-muted">
          Also matching:{" "}
          {parsedTokens.map((token) => (
            <span key={token} className="mr-1 inline-block rounded-full bg-linen-2 px-2 py-0.5 capitalize">
              {token}
            </span>
          ))}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => set("q", term)}
            className="rounded-full bg-tomato-soft px-2.5 py-1 text-xs text-ink"
          >
            {term}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleExpanded}
        className="mt-3 text-sm font-medium text-basil underline underline-offset-4"
      >
        {expanded ? "Hide filters" : "More filters"}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {meta?.categories.length ? (
            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {meta.categories.map((category) => {
                  const active = filters.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleInList("categories", category)}
                      className={`rounded-full px-3 py-1.5 text-sm capitalize ${
                        active ? "bg-ink text-linen" : "border border-line bg-linen"
                      }`}
                    >
                      {prettyCategory(category)}
                    </button>
                  );
                })}
              </div>
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

          <Field label="Protein (comma-separated)">
            <input
              value={filters.protein}
              onChange={(event) => set("protein", event.target.value)}
              placeholder="lobster, shrimp"
              className="h-10 w-full rounded-xl border border-line bg-linen px-3"
            />
            {filters.protein.trim() ? (
              <div className="mt-2 flex gap-2">
                {(["any", "all"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("proteinMode", mode)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      filters.proteinMode === mode ? "bg-basil text-linen" : "bg-linen-2"
                    }`}
                  >
                    Match {mode}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>

          <Field label="Ingredient contains">
            <input
              value={filters.ingredient}
              onChange={(event) => set("ingredient", event.target.value)}
              placeholder="truffle, basil…"
              className="h-10 w-full rounded-xl border border-line bg-linen px-3"
            />
          </Field>

          {meta?.dietary.length ? (
            <Field label="Dietary">
              <div className="flex flex-wrap gap-2">
                {meta.dietary.map((tag) => {
                  const active = filters.dietary.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInList("dietary", tag)}
                      className={`rounded-full px-3 py-1.5 text-sm capitalize ${
                        active ? "bg-basil text-linen" : "border border-line bg-linen"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
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
        </div>
      ) : null}
    </div>
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
