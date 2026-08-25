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
