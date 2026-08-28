import { describe, expect, it } from "vitest";

import { groupItemsByDish } from "./dishGroups";
import type { MenuItem } from "./types";

function pizza(id: string, serving: MenuItem["pizza_serving"], price: string): MenuItem {
  return {
    menu_item_id: id,
    restaurant_id: `restaurant-${id}`,
    restaurant_name: `Restaurant ${id}`,
    raw_name: "Margherita Pizza",
    canonical_category: "pizza",
    canonical_dish: "MARGHERITA",
    pizza_serving: serving,
    price,
  } as MenuItem;
}

describe("pizza dish grouping", () => {
  it("never compares slices and whole pizzas in one price group", () => {
    const groups = groupItemsByDish([
      pizza("slice", "slice", "5"),
      pizza("whole", "whole", "25"),
      pizza("unknown", "unknown", "18"),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "MARGHERITA::slice",
      "MARGHERITA::whole",
      "MARGHERITA::unknown",
    ]);
    expect(groups.map((group) => group.displayName)).toEqual([
      "Margherita — Slice",
      "Margherita — Whole pizza",
      "Margherita — Serving size unclear",
    ]);
  });
});
