import type { CategorySummary, FilterMeta, GooglePhoto, MenuItemList, RestaurantDetail, RestaurantSummary, SearchSuggestions, SimilarDishesResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function apiUrl(): string {
  return API_URL;
}

export function listRestaurants(): Promise<RestaurantSummary[]> {
  return getJson("/restaurants");
}

export function getRestaurant(id: string, params: Record<string, string | undefined> = {}): Promise<RestaurantDetail> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return getJson(`/restaurants/${id}${qs ? `?${qs}` : ""}`);
}

export function getGooglePhoto(id: string, variant: "thumbnail" | "card" | "hero", signal?: AbortSignal): Promise<GooglePhoto> {
  return getJson(`/restaurants/${id}/google-photo?variant=${variant}`, signal);
}

export function getFilterMeta(): Promise<FilterMeta> {
  return getJson("/menu-items/meta");
}

export function listMenuItems(params: Record<string, string | undefined>, signal?: AbortSignal): Promise<MenuItemList> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return getJson(`/menu-items${qs ? `?${qs}` : ""}`, signal);
}

export function listSimilarDishes(canonicalDish: string, limit = 8): Promise<SimilarDishesResponse> {
  const search = new URLSearchParams({ canonical_dish: canonicalDish, limit: String(limit) });
  return getJson(`/menu-items/similar-dishes?${search.toString()}`);
}

export function getCategorySummary(category: string, limit = 20): Promise<CategorySummary> {
  const search = new URLSearchParams({ category, limit: String(limit) });
  return getJson(`/menu-items/category-summary?${search.toString()}`);
}

export function suggestSearch(q: string, signal?: AbortSignal): Promise<SearchSuggestions> {
  const search = new URLSearchParams({ q });
  return getJson(`/search/suggest?${search.toString()}`, signal);
}
