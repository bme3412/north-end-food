export type FilterState = {
  q: string;
  categories: string[];
  subcategories: string[];
  protein: string[];
  proteinMode: "any" | "all";
  ingredients: string[];
  ingredientMode: "any" | "all";
  dietary: string[];
  minPrice: string;
  maxPrice: string;
  pricedOnly: boolean;
  sort: "relevance" | "price" | "name";
  restaurantId: string;
};

export const DEFAULT_FILTERS: FilterState = {
  q: "",
  categories: [],
  subcategories: [],
  protein: [],
  proteinMode: "any",
  ingredients: [],
  ingredientMode: "any",
  dietary: [],
  minPrice: "",
  maxPrice: "",
  pricedOnly: false,
  sort: "relevance",
  restaurantId: "",
};

function listParam(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

export function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    categories: listParam(params, "category"),
    subcategories: listParam(params, "subcategory"),
    protein: listParam(params, "protein"),
    proteinMode: params.get("protein_mode") === "all" ? "all" : "any",
    ingredients: listParam(params, "ingredient"),
    ingredientMode: params.get("ingredient_mode") === "all" ? "all" : "any",
    dietary: listParam(params, "dietary"),
    minPrice: params.get("min_price") ?? "",
    maxPrice: params.get("max_price") ?? "",
    pricedOnly: params.get("priced_only") === "true",
    sort: sort === "price" || sort === "name" ? sort : "relevance",
    restaurantId: params.get("restaurant_id") ?? "",
  };
}

export function filtersToSearchParams(filters: FilterState, view?: "map" | "list"): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtersToParams(filters))) {
    if (value && !(key === "sort" && value === "relevance")) params.set(key, value);
  }
  if (view && view !== "list") params.set("view", view);
  return params;
}

export function filtersToParams(filters: FilterState): Record<string, string | undefined> {
  return {
    q: filters.q || undefined,
    category: filters.categories.length ? filters.categories.join(",") : undefined,
    subcategory: filters.subcategories.length ? filters.subcategories.join(",") : undefined,
    protein: filters.protein.length ? filters.protein.join(",") : undefined,
    protein_mode: filters.protein.length ? filters.proteinMode : undefined,
    ingredient: filters.ingredients.length ? filters.ingredients.join(",") : undefined,
    ingredient_mode: filters.ingredients.length ? filters.ingredientMode : undefined,
    dietary: filters.dietary.length ? filters.dietary.join(",") : undefined,
    min_price: filters.minPrice || undefined,
    max_price: filters.maxPrice || undefined,
    priced_only: filters.pricedOnly ? "true" : undefined,
    sort: filters.sort,
    restaurant_id: filters.restaurantId || undefined,
  };
}

export function activeFilterCount(filters: FilterState): number {
  let count = 0;
  if (filters.q.trim()) count += 1;
  if (filters.categories.length) count += 1;
  if (filters.subcategories.length) count += 1;
  if (filters.protein.length) count += 1;
  if (filters.ingredients.length) count += 1;
  if (filters.dietary.length) count += 1;
  if (filters.minPrice || filters.maxPrice) count += 1;
  if (filters.pricedOnly) count += 1;
  if (filters.restaurantId) count += 1;
  return count;
}
