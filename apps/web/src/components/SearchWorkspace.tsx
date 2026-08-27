"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { DishFocusPage } from "@/components/DishFocusPage";
import { DishGroupCard } from "@/components/DishGroupCard";
import { FilterPanel } from "@/components/FilterPanel";
import { ItemCard } from "@/components/ItemCard";
import { ItemSheet } from "@/components/ItemSheet";
import { RestaurantRow } from "@/components/RestaurantRow";
import { getFilterMeta, listMenuItems } from "@/lib/api";
import { asOfTimeToParams, useAsOfTime } from "@/lib/asOfTime";
import { groupItemsByDish } from "@/lib/dishGroups";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersToParams,
  type FilterState,
} from "@/lib/filters";
import { NORTH_END_CENTER, haversineMiles } from "@/lib/geo";
import { serviceModeToParams, useServiceMode } from "@/lib/serviceMode";
import type { FilterMeta, MenuItem, PlaceMatch } from "@/lib/types";

type RestaurantSort = "matched" | "rating" | "price" | "distance";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[280px] animate-pulse bg-linen-2" />,
});

export function SearchWorkspace() {
  const { asOf, openNowEnabled } = useAsOfTime();
  const { mode: serviceMode } = useServiceMode();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [restaurantSort, setRestaurantSort] = useState<RestaurantSort>("matched");
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [places, setPlaces] = useState<PlaceMatch[]>([]);
  const [parsedTokens, setParsedTokens] = useState<string[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [groupByDish, setGroupByDish] = useState(true);
  const [mobileTab, setMobileTab] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFilterMeta().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      listMenuItems({
        ...filtersToParams(filters),
        ...asOfTimeToParams(asOf),
        ...serviceModeToParams(serviceMode),
        open_now: openNowEnabled ? "true" : undefined,
      })
        .then((data) => {
          setItems(data.items);
          setPlaces(data.places);
          setParsedTokens(data.parsed_tokens);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [filters, asOf, openNowEnabled, serviceMode]);

  function selectPlace(id: string | null) {
    setSelectedPlaceId(id);
    setFilters((current) =>
      current.restaurantId === (id ?? "") ? current : { ...current, restaurantId: id ?? "" },
    );
  }

  const visibleItems = useMemo(() => {
    if (!selectedPlaceId) return items;
    return items.filter((item) => item.restaurant_id === selectedPlaceId);
  }, [items, selectedPlaceId]);

  const filterCount = activeFilterCount(filters);
  const hasActiveSearch = filters.q.trim() !== "" || filterCount > 0;
  const grouped = useMemo(() => groupItemsByDish(visibleItems), [visibleItems]);

  // A search that clearly resolves to one dish across multiple restaurants
  // (e.g. "calamari") gets the dish-comparison layout instead of the
  // general browse shell below -- see DishFocusPage. Anything broader
  // (no search, or results spanning multiple dishes) keeps the existing,
  // unmodified fixed sidebar+map shell; this branch is additive, not a
  // replacement.
  const dominantGroup =
    hasActiveSearch && !selectedPlaceId && grouped.length === 1 && grouped[0].restaurantCount >= 2
      ? grouped[0]
      : null;

  const sortedPlaces = useMemo(() => {
    if (restaurantSort === "matched") return places;
    const withMetric = places.map((place) => {
      if (restaurantSort === "rating") return { place, metric: place.rating != null ? Number(place.rating) : null };
      if (restaurantSort === "price") return { place, metric: place.price_level };
      const metric =
        place.latitude != null && place.longitude != null
          ? haversineMiles(place.latitude, place.longitude, NORTH_END_CENTER.latitude, NORTH_END_CENTER.longitude)
          : null;
      return { place, metric };
    });
    const ascending = restaurantSort === "price" || restaurantSort === "distance";
    withMetric.sort((a, b) => {
      if (a.metric == null && b.metric == null) return 0;
      if (a.metric == null) return 1;
      if (b.metric == null) return -1;
      return ascending ? a.metric - b.metric : b.metric - a.metric;
    });
    return withMetric.map((entry) => entry.place);
  }, [places, restaurantSort]);

  if (dominantGroup) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)]">
        <div className="border-b border-line">
          <FilterPanel
            filters={filters}
            meta={meta}
            parsedTokens={parsedTokens}
            onChange={setFilters}
            expanded={filtersExpanded}
            onToggleExpanded={() => setFiltersExpanded((open) => !open)}
          />
        </div>
        {error ? (
          <p className="mx-auto mt-6 max-w-7xl rounded-2xl bg-tomato-soft px-4 py-3 text-sm">
            Can’t reach the API. {error}
          </p>
        ) : (
          <DishFocusPage group={dominantGroup} />
        )}
        <ItemSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 flex flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(340px,400px)_1fr]">
      {/* Sidebar: filters + results */}
      <aside
        className={`flex min-h-0 flex-col overflow-y-auto bg-linen pb-14 lg:pb-0 lg:border-r lg:border-line ${
          mobileTab === "list" ? "flex-1" : "hidden lg:flex"
        }`}
      >
        <FilterPanel
          filters={filters}
          meta={meta}
          parsedTokens={parsedTokens}
          onChange={(next) => {
            setFilters(next);
            if (!next.restaurantId) {
              setSelectedPlaceId(null);
            } else if (next.restaurantId !== selectedPlaceId) {
              setSelectedPlaceId(next.restaurantId);
            }
          }}
          expanded={filtersExpanded}
          onToggleExpanded={() => setFiltersExpanded((open) => !open)}
        />

        <div className="flex flex-col gap-3 border-t border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex w-fit gap-1 rounded-full bg-linen-2 p-1">
              <ViewModeButton active={groupByDish} onClick={() => setGroupByDish(true)} label="Dishes" />
              <ViewModeButton active={!groupByDish} onClick={() => setGroupByDish(false)} label="Restaurants" />
            </div>
            {!groupByDish ? (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Sort
                <select
                  value={restaurantSort}
                  onChange={(event) => setRestaurantSort(event.target.value as RestaurantSort)}
                  className="rounded-lg border border-line bg-linen px-2 py-1 text-xs text-ink"
                >
                  <option value="matched">Most matched dishes</option>
                  <option value="rating">Rating</option>
                  <option value="price">Price</option>
                  <option value="distance">Distance</option>
                </select>
              </label>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {loading
                ? "Searching menus…"
                : groupByDish
                  ? `${visibleItems.length} dish${visibleItems.length === 1 ? "" : "es"} · ${places.length} place${places.length === 1 ? "" : "s"}`
                  : `${places.length} place${places.length === 1 ? "" : "s"}`}
            </span>
            {filterCount ? (
              <span className="rounded-full bg-basil-soft px-2 py-0.5 text-xs text-basil">
                {filterCount} filter{filterCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {selectedPlaceId ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-basil-soft/40 px-3 py-2 text-sm">
              <span>Showing one restaurant</span>
              <button
                type="button"
                onClick={() => selectPlace(null)}
                className="font-medium text-basil underline underline-offset-2"
              >
                Show all
              </button>
            </div>
          ) : null}
        </div>

        <div className="p-5">
          {error ? (
            <p className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm">Can’t reach the API. {error}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <SectionHeader
                icon={groupByDish ? "🍴" : "🏪"}
                label={
                  groupByDish
                    ? hasActiveSearch
                      ? "Matched Dishes"
                      : "All Dishes"
                    : hasActiveSearch
                      ? "Matched Restaurants"
                      : "All Restaurants"
                }
              />
              {groupByDish ? (
                <>
                  {grouped.map((group) =>
                    group.restaurantCount >= 2 ? (
                      <DishGroupCard key={group.key} group={group} onOpen={setSelectedItem} />
                    ) : (
                      <ItemCard
                        key={group.items[0].menu_item_id}
                        item={group.items[0]}
                        onOpen={setSelectedItem}
                        compact
                      />
                    ),
                  )}
                  {!loading && visibleItems.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                      No dishes matched. Widen the search or clear filters.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {sortedPlaces.map((place) => (
                    <RestaurantRow key={place.restaurant_id} place={place} />
                  ))}
                  {!loading && places.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                      No restaurants matched. Widen the search or clear filters.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Map column */}
      <section
        className={`relative min-h-0 bg-linen-2 lg:h-full ${
          mobileTab === "map" ? "flex flex-1 flex-col" : "hidden lg:flex"
        }`}
      >
        <div className="relative min-h-[42vh] flex-1 lg:min-h-0">
          <MapView
            places={places}
            selectedId={selectedPlaceId}
            selectedItems={visibleItems}
            onSelect={(place) => selectPlace(place?.restaurant_id ?? null)}
            onOpenItem={setSelectedItem}
          />
        </div>
      </section>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-card/95 backdrop-blur-md lg:hidden">
        <MobileTab active={mobileTab === "map"} onClick={() => setMobileTab("map")} label="Map" />
        <MobileTab
          active={mobileTab === "list"}
          onClick={() => setMobileTab("list")}
          label={`Dishes${visibleItems.length ? ` (${visibleItems.length})` : ""}`}
        />
      </nav>

      <ItemSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{label}</h2>
    </div>
  );
}

function ViewModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${
        active ? "bg-ink text-linen" : "text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function MobileTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-bold ${
        active ? "bg-linen text-ink" : "text-muted"
      }`}
    >
      {label}
    </button>
  );
}
