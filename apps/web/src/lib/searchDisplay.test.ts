import { describe, expect, it } from "vitest";

import { pickSearchView } from "./searchDisplay";

const base = {
  q: "carbonara",
  selectedPlaceId: null,
  pizzaServing: "",
  parsedPizzaServing: null as string | null,
  resolvedCategory: null as string | null,
  resolvedDish: null as string | null,
  resolvedRestaurantId: null as string | null,
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
        groupKeys: ["CARBONARA", "CARBONARA"],
      }),
    ).toEqual({ kind: "dish", groupKey: "CARBONARA" });
  });

  it("opens lobster ravioli even when the same group is listed twice", () => {
    expect(
      pickSearchView({
        ...base,
        q: "lobster ravioli",
        resolvedDish: "LOBSTER_RAVIOLI",
        groupKeys: ["LOBSTER_RAVIOLI", "RAVIOLI", "LOBSTER_RAVIOLI", "GNOCCHI_LOBSTER"],
      }),
    ).toEqual({ kind: "dish", groupKey: "LOBSTER_RAVIOLI" });
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

  it("switches to the restaurants tab when the query uniquely names a place", () => {
    expect(
      pickSearchView({
        ...base,
        q: "Neptune Oyster",
        resolvedRestaurantId: "NE_0002",
        groupKeys: ["RAW_OYSTERS", "LOBSTER_RAVIOLI", "CALAMARI"],
      }),
    ).toEqual({ kind: "restaurant" });
  });

  it("keeps a dish match on the dish view even if a restaurant id is also present", () => {
    expect(
      pickSearchView({
        ...base,
        resolvedDish: "CARBONARA",
        resolvedRestaurantId: "NE_0002",
      }),
    ).toEqual({ kind: "dish", groupKey: "CARBONARA" });
  });

  it("opens the pie compare when a pizza query has slice and whole groups", () => {
    expect(
      pickSearchView({
        ...base,
        q: "margherita pizza",
        resolvedDish: "MARGHERITA",
        groupKeys: ["MARGHERITA::slice", "MARGHERITA::whole"],
      }),
    ).toEqual({ kind: "dish", groupKey: "MARGHERITA::whole" });
  });

  it("opens cheese pizza compare across unmarked and whole pies", () => {
    expect(
      pickSearchView({
        ...base,
        q: "cheese pizza",
        resolvedDish: "CHEESE_PIZZA",
        groupKeys: ["CHEESE_PIZZA::whole", "CHEESE_PIZZA::slice", "CHEESE_PIZZA::whole::kids"],
      }),
    ).toEqual({ kind: "dish", groupKey: "CHEESE_PIZZA::whole" });
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

  it("opens a compare card even when the query is empty", () => {
    expect(
      pickSearchView({
        ...base,
        q: "",
        resolvedCategory: "pasta",
        groupKeys: ["BOLOGNESE", "kids-cat-pasta"],
        compareGroupKey: "kids-cat-pasta",
      }),
    ).toEqual({ kind: "dish", groupKey: "kids-cat-pasta" });
  });
});
