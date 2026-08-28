import { describe, expect, it } from "vitest";

import { pickSearchView } from "./searchDisplay";

const base = {
  q: "carbonara",
  selectedPlaceId: null,
  pizzaServing: "",
  parsedPizzaServing: null as string | null,
  resolvedCategory: null as string | null,
  resolvedDish: null as string | null,
  groupKeys: ["CARBONARA"],
  compareGroupKey: null as string | null,
};

describe("pickSearchView", () => {
  it("opens category browse only for an exact category name", () => {
    expect(
      pickSearchView({
        ...base,
        q: "pizza",
        resolvedCategory: "pizza",
        groupKeys: ["MARGHERITA::whole", "CHEESE_PIZZA::slice"],
      }),
    ).toEqual({ kind: "category", category: "pizza" });
  });

  it("keeps pizza under a price cap on the grouped list", () => {
    expect(
      pickSearchView({
        ...base,
        q: "pizza under $20",
        resolvedCategory: null,
        groupKeys: ["MARGHERITA::whole", "CHEESE_PIZZA::slice"],
      }),
    ).toEqual({ kind: "list" });
  });

  it("opens dish comparison only when the query names one dish", () => {
    expect(
      pickSearchView({
        ...base,
        resolvedDish: "CARBONARA",
      }),
    ).toEqual({ kind: "dish", groupKey: "CARBONARA" });
  });

  it("does not collapse a restaurant-name search onto the first dish", () => {
    expect(
      pickSearchView({
        ...base,
        q: "Neptune Oyster",
        groupKeys: ["RAW_OYSTERS", "LOBSTER_RAVIOLI", "CALAMARI"],
      }),
    ).toEqual({ kind: "list" });
  });

  it("stays on the list when one pizza has multiple serving groups", () => {
    expect(
      pickSearchView({
        ...base,
        q: "margherita pizza",
        resolvedDish: "MARGHERITA",
        groupKeys: ["MARGHERITA::slice", "MARGHERITA::whole"],
      }),
    ).toEqual({ kind: "list" });
  });

  it("stays on the list when a pizza serving is parsed from the query", () => {
    expect(
      pickSearchView({
        ...base,
        q: "slice of pizza",
        parsedPizzaServing: "slice",
        resolvedCategory: "pizza",
        groupKeys: ["MARGHERITA::slice", "CHEESE_PIZZA::slice"],
      }),
    ).toEqual({ kind: "list" });
  });

  it("opens the group the user picked from the list", () => {
    expect(
      pickSearchView({
        ...base,
        q: "pizza under $20",
        groupKeys: ["MARGHERITA::whole", "CHEESE_PIZZA::slice"],
        compareGroupKey: "CHEESE_PIZZA::slice",
      }),
    ).toEqual({ kind: "dish", groupKey: "CHEESE_PIZZA::slice" });
  });
});
