import { describe, expect, it } from "vitest";

import { DEFAULT_FILTERS, filtersFromSearchParams, filtersToSearchParams } from "./filters";

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
