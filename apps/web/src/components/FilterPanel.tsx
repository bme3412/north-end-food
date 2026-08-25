"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
