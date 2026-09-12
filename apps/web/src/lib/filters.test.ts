import { describe, expect, it } from "vitest";

import {
  applyCategoryBrowse,
  applySearchQuery,
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
} from "./filters";

describe("mobile search URL state", () => {
  it("round trips active filters and map view", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      q: "calamari",
      categories: ["seafood"],
      dietary: ["gluten-free"],
      maxPrice: "30",
      pricedOnly: true,
      sort: "price" as const,
    };

    const params = filtersToSearchParams(filters, "map");
    expect(filtersFromSearchParams(params)).toEqual(filters);
    expect(params.get("view")).toBe("map");
  });

  it("falls back safely for unknown sort and match modes", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("sort=popular&protein_mode=some"));
    expect(filters.sort).toBe("relevance");
    expect(filters.proteinMode).toBe("any");
  });
});

describe("search routing", () => {
  it("drops leftover category when the typed query changes", () => {
    const next = applySearchQuery(
      { ...DEFAULT_FILTERS, categories: ["pizza"], pizzaServing: "slice", restaurantId: "NE_0001" },
      "Alfredo",
    );
    expect(next.q).toBe("Alfredo");
    expect(next.categories).toEqual([]);
    expect(next.pizzaServing).toBe("");
    expect(next.restaurantId).toBe("");
  });

  it("keeps browse filters while the same query is only edited for whitespace", () => {
    const next = applySearchQuery({ ...DEFAULT_FILTERS, q: "Alfredo", categories: ["pasta"] }, "Alfredo ");
    expect(next.categories).toEqual(["pasta"]);
  });

  it("starts a category browse without the previous query", () => {
    const next = applyCategoryBrowse({ ...DEFAULT_FILTERS, q: "Alfredo", pizzaServing: "whole" }, "pasta");
    expect(next.q).toBe("");
    expect(next.categories).toEqual(["pasta"]);
    expect(next.pizzaServing).toBe("");
  });
});
