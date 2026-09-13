"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Store, Utensils } from "lucide-react";
import type { ReactNode } from "react";

import { CategoryFocusPage } from "@/components/CategoryFocusPage";
import { DishFocusPage } from "@/components/DishFocusPage";
import { DishGroupCard } from "@/components/DishGroupCard";
import { FilterPanel } from "@/components/FilterPanel";
import { ItemCard } from "@/components/ItemCard";
import { ItemSheet } from "@/components/ItemSheet";
import { RestaurantRow } from "@/components/RestaurantRow";
import { SearchBrowse } from "@/components/SearchBrowse";
import { getFilterMeta, listAllMenuItems } from "@/lib/api";
import { asOfTimeToParams, useAsOfTime } from "@/lib/asOfTime";
import { groupItemsByDish, organizeDishGroups } from "@/lib/dishGroups";
import {
  activeFilterCount,
  applyCategoryBrowse,
  applySearchQuery,
  filtersFromSearchParams,
  filtersToParams,
  filtersToSearchParams,
  type FilterState,
} from "@/lib/filters";
import { pickSearchView } from "@/lib/searchDisplay";
import { NORTH_END_CENTER, haversineMiles } from "@/lib/geo";
import { serviceModeToParams, useServiceMode } from "@/lib/serviceMode";
import type { FilterMeta, MenuItem, PlaceMatch } from "@/lib/types";

type RestaurantSort = "matched" | "rating" | "price" | "distance";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[280px] animate-pulse bg-linen-2" />,
});

export function SearchWorkspace() {
  const searchParams = useSearchParams();
  const { asOf, openNowEnabled } = useAsOfTime();
  const { mode: serviceMode } = useServiceMode();
  const [filters, setFilters] = useState<FilterState>(() =>
    filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
  );
  const [restaurantSort, setRestaurantSort] = useState<RestaurantSort>("matched");
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [places, setPlaces] = useState<PlaceMatch[]>([]);
  const [parsedTokens, setParsedTokens] = useState<string[]>([]);
  const [parsedPizzaServing, setParsedPizzaServing] = useState<"slice" | "whole" | null>(null);
  const [resolvedCategory, setResolvedCategory] = useState<string | null>(null);
  const [resolvedDish, setResolvedDish] = useState<string | null>(null);
  const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [groupByDish, setGroupByDish] = useState(true);
  const [comparison, setComparison] = useState<{ context: string; groupKey: string } | null>(null);
  const [showMap, setShowMap] = useState(() => searchParams.get("view") === "map");
  const [loading, setLoading] = useState(() => activeFilterCount(filtersFromSearchParams(new URLSearchParams(searchParams.toString()))) > 0);
  const [error, setError] = useState<string | null>(null);
  const urlReady = useRef(false);
  const routeIntent = useRef({ q: "", categories: "" });
  const filterCount = activeFilterCount(filters);
  const hasActiveSearch = filterCount > 0;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const parsed = filtersFromSearchParams(params);
      setFilters(parsed);
      setShowMap(params.get("view") === "map");
      routeIntent.current = { q: parsed.q.trim(), categories: parsed.categories.join(",") };
      urlReady.current = true;
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!urlReady.current) return;
    const params = filtersToSearchParams(filters, showMap ? "map" : "list");
    const next = `/search${params.toString() ? `?${params.toString()}` : ""}`;
    const nextQ = filters.q.trim();
    const nextCategories = filters.categories.join(",");
    const prevQ = routeIntent.current.q;
    const prevCategories = routeIntent.current.categories;
    const swappedIntent =
      (Boolean(prevCategories) && Boolean(nextQ) && nextCategories !== prevCategories) ||
      (Boolean(prevQ) && Boolean(nextCategories) && nextQ !== prevQ);
    routeIntent.current = { q: nextQ, categories: nextCategories };
    if (swappedIntent) {
      window.history.pushState(null, "", next);
    } else {
      window.history.replaceState(null, "", next);
    }
  }, [filters, showMap]);

  useEffect(() => {
    getFilterMeta().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hasActiveSearch) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setLoading(true);
      listAllMenuItems({
        ...filtersToParams(filters),
        ...asOfTimeToParams(asOf),
        ...serviceModeToParams(serviceMode),
        open_now: openNowEnabled ? "true" : undefined,
      }, controller.signal)
        .then((data) => {
          setItems(data.items);
          setPlaces(data.places);
          setParsedTokens(data.parsed_tokens);
          setParsedPizzaServing(data.parsed_pizza_serving);
          setResolvedCategory(data.resolved_category);
          setResolvedDish(data.resolved_dish);
          setResolvedRestaurantId(data.resolved_restaurant_id);
          setError(null);
        })
        .catch((err: Error) => {
          if (err.name !== "AbortError") setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [filters, hasActiveSearch, asOf, openNowEnabled, serviceMode]);

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

  const grouped = useMemo(() => groupItemsByDish(visibleItems), [visibleItems]);
  const dishSections = useMemo(() => organizeDishGroups(grouped), [grouped]);
  const compareContext = `${filters.q}|${filters.pizzaServing}|${filters.restaurantId}`;
  const compareGroupKey = comparison?.context === compareContext ? comparison.groupKey : null;

  const searchView = useMemo(
    () =>
      pickSearchView({
        q: filters.q,
        selectedPlaceId,
        pizzaServing: filters.pizzaServing,
        parsedPizzaServing,
        resolvedCategory,
        resolvedDish,
        resolvedRestaurantId,
        groupKeys: [
          ...grouped.map((group) => group.key),
          ...dishSections.flatMap((section) => section.groups.map((group) => group.key)),
        ],
        compareGroupKey,
      }),
    [
      filters.q,
      filters.pizzaServing,
      selectedPlaceId,
      parsedPizzaServing,
      resolvedCategory,
      resolvedDish,
      resolvedRestaurantId,
      grouped,
      dishSections,
      compareGroupKey,
    ],
  );

  const showDishGroups = searchView.kind === "restaurant" ? false : groupByDish;
  const filterPanelMap = {
    mapVisible: showMap,
    onToggleMap: () => setShowMap((open) => !open),
  };

  const categoryFocus = searchView.kind === "category" ? searchView.category : null;
  const organizedGroups = useMemo(
    () => dishSections.flatMap((section) => section.groups),
    [dishSections],
  );
  const focusGroup =
    searchView.kind === "dish"
      ? (organizedGroups.find((group) => group.key === searchView.groupKey)
          ?? grouped.find((group) => group.key === searchView.groupKey)
          ?? null)
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

  if (categoryFocus) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)]">
        <div className="relative z-30 border-b border-line">
          <FilterPanel
            filters={filters}
            meta={meta}
            parsedTokens={parsedTokens}
            onChange={setFilters}
            expanded={filtersExpanded}
            onToggleExpanded={() => setFiltersExpanded((open) => !open)}
            compact
            {...filterPanelMap}
          />
        </div>
        {error ? (
          <p className="mx-auto mt-6 max-w-7xl rounded-2xl bg-tomato-soft px-4 py-3 text-sm">
            Can’t reach the API. {error}
          </p>
        ) : (
          <CategoryFocusPage
            key={categoryFocus}
            category={categoryFocus}
            places={places}
            items={visibleItems}
            showMap={showMap}
            onSelectDish={(dishName) => setFilters((current) => applySearchQuery(current, dishName))}
            onOpenItem={setSelectedItem}
            onBrowseAll={() => setFilters((current) => applyCategoryBrowse(current, categoryFocus))}
          />
        )}
        <ItemSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      </div>
    );
  }

  if (focusGroup) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)]">
        <div className="relative z-30 border-b border-line">
          <FilterPanel
            filters={filters}
            meta={meta}
            parsedTokens={parsedTokens}
            onChange={setFilters}
            expanded={filtersExpanded}
            onToggleExpanded={() => setFiltersExpanded((open) => !open)}
            compact
            {...filterPanelMap}
          />
        </div>
        {error ? (
          <p className="mx-auto mt-6 max-w-7xl rounded-2xl bg-tomato-soft px-4 py-3 text-sm">
            Can’t reach the API. {error}
          </p>
        ) : (
          <DishFocusPage
            group={focusGroup}
            showMap={showMap}
            onBack={compareGroupKey ? () => setComparison(null) : undefined}
            onOpen={setSelectedItem}
          />
        )}
        <ItemSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] top-[50px] flex flex-col md:bottom-0">
      <div className="relative z-30 shrink-0 border-b border-line">
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
          compact
          autoFocusSearch={!filters.q.trim()}
          {...filterPanelMap}
        />
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          showMap ? "lg:grid lg:grid-cols-[clamp(420px,40vw,560px)_1fr]" : ""
        }`}
      >
        <aside
          className={`min-h-0 flex-col overflow-y-auto bg-linen ${
            showMap ? "hidden lg:flex lg:border-r lg:border-line" : "flex flex-1"
          }`}
        >
        {!hasActiveSearch ? (
          <SearchBrowse
            meta={meta}
            onSelectCategory={(category) => setFilters((current) => applyCategoryBrowse(current, category))}
            onSelectDish={(query) => setFilters((current) => applySearchQuery(current, query))}
          />
        ) : (
          <>
        <div className="flex flex-col gap-3 border-t border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex w-fit gap-1 rounded-full bg-linen-2 p-1">
              <ViewModeButton active={showDishGroups} onClick={() => setGroupByDish(true)} label="Dishes" />
              <ViewModeButton active={!showDishGroups} onClick={() => setGroupByDish(false)} label="Restaurants" />
            </div>
            {!showDishGroups ? (
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
                : showDishGroups
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

        <div className={`p-5 ${showMap ? "" : "mx-auto w-full max-w-7xl"}`}>
          {error ? (
            <p className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm">Can’t reach the API. {error}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <SectionHeader
                icon={showDishGroups ? <Utensils className="size-4" /> : <Store className="size-4" />}
                label={showDishGroups ? "Matched Dishes" : "Matched Restaurants"}
              />
              {showDishGroups ? (
                <>
                  {dishSections.map((section) => {
                    const compare = section.key === "compare" || section.key === "kids";
                    return (
                      <section key={section.key} className="flex flex-col gap-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-ink">{section.title}</h3>
                            {section.key === "kids" ? (
                              <p className="mt-0.5 text-xs text-muted">
                                Kids portions stay out of adult price comparisons.
                              </p>
                            ) : section.key === "compare" ? (
                              <p className="mt-0.5 text-xs text-muted">
                                Same dish, sorted cheapest to most expensive.
                              </p>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted">
                            {section.groups.length} {section.groups.length === 1 ? "dish" : "dishes"}
                          </span>
                        </div>
                        <div
                          className={
                            showMap
                              ? "flex flex-col gap-3"
                              : compare
                                ? "grid gap-3 md:grid-cols-2"
                                : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                          }
                        >
                          {section.groups.map((group) =>
                            group.restaurantCount >= 2 ? (
                              <DishGroupCard
                                key={group.key}
                                group={group}
                                onOpen={setSelectedItem}
                                onCompare={() => setComparison({ context: compareContext, groupKey: group.key })}
                              />
                            ) : (
                              <ItemCard
                                key={group.items[0].menu_item_id}
                                item={group.items[0]}
                                onOpen={setSelectedItem}
                                compact
                              />
                            ),
                          )}
                        </div>
                      </section>
                    );
                  })}
                  {!loading && visibleItems.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                      No dishes matched. Widen the search or clear filters.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className={showMap ? "flex flex-col gap-4" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
                  {sortedPlaces.map((place) => (
                    <RestaurantRow key={place.restaurant_id} place={place} />
                  ))}
                  </div>
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
          </>
        )}
        </aside>

        {showMap ? (
          <section className="relative min-h-0 flex-1 bg-linen-2 lg:h-full">
            <div className="absolute inset-0">
              <MapView
                places={places}
                selectedId={selectedPlaceId}
                selectedItems={visibleItems}
                onSelect={(place) => selectPlace(place?.restaurant_id ?? null)}
                onOpenItem={setSelectedItem}
              />
            </div>
          </section>
        ) : null}
      </div>

      <ItemSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
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

