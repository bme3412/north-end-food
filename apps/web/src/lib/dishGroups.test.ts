import { describe, expect, it } from "vitest";

import { compareVariant, groupItemsByDish, isKidsItem, organizeDishGroups } from "./dishGroups";
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
    ]);
    expect(groups.map((group) => group.displayName)).toEqual([
      "Margherita — Slice",
      "Margherita — Whole pizza",
    ]);
    expect(groups[1].restaurantCount).toBe(2);
  });

  it("folds margherita pies onto the cheese pizza compare", () => {
    const cheese = {
      ...pizza("regina", "whole", "17.5"),
      canonical_dish: "CHEESE_PIZZA",
      restaurant_id: "regina",
      raw_name: "Cheese Pizza",
    };
    const margheritaSameKitchen = {
      ...pizza("regina-m", "whole", "27"),
      restaurant_id: "regina",
      raw_name: "Margherita",
    };
    const margheritaOnly = {
      ...pizza("tresca", "whole", "21"),
      restaurant_id: "tresca",
      raw_name: "Margherita",
    };
    const groups = groupItemsByDish([cheese, margheritaSameKitchen, margheritaOnly]);
    const cheeseGroup = groups.find((group) => group.key === "CHEESE_PIZZA::whole");
    const margheritaGroup = groups.find((group) => group.key === "MARGHERITA::whole");

    expect(cheeseGroup?.restaurantCount).toBe(2);
    expect(cheeseGroup?.items.map((item) => item.raw_name)).toEqual([
      "Cheese Pizza",
      "Margherita",
      "Margherita",
    ]);
    expect(margheritaGroup?.restaurantCount).toBe(2);
  });
});

describe("organizeDishGroups", () => {
  it("puts comparable dishes first, then slices, pies, and calzones", () => {
    const sharedWhole = pizza("shared-a", "whole", "20");
    const sharedWholeB = { ...pizza("shared-b", "whole", "22"), canonical_dish: "MARGHERITA" };
    const slice = pizza("slice-1", "slice", "5");
    const calzone = {
      ...pizza("calzone-1", "whole", "16"),
      canonical_dish: "CALZONE",
      raw_name: "Chicken Parm Calzone",
    };
    const toppings = {
      ...pizza("top-1", "whole", "4"),
      canonical_dish: null,
      raw_name: "Pizza Toppings",
    } as MenuItem;

    const sections = organizeDishGroups(
      groupItemsByDish([sharedWhole, sharedWholeB, slice, calzone, toppings]),
    );

    expect(sections.map((section) => section.key)).toEqual(["compare", "slice", "calzone", "build"]);
    expect(sections[0].groups[0].restaurantCount).toBe(2);
  });

  it("keeps kids portions out of adult like-for-like groups", () => {
    const adult = {
      ...pizza("adult", "whole", "20"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      raw_name: "Penne Pomodoro",
    };
    const kid = {
      ...pizza("kid", "whole", "10"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      portion: "kids",
      menu_section: "Children's Menu",
      raw_name: "Kids Ziti",
    };
    expect(isKidsItem(kid)).toBe(true);
    const groups = groupItemsByDish([adult, kid]);
    expect(groups.map((group) => group.key)).toEqual(["POMODORO", "POMODORO::kids"]);
    const sections = organizeDishGroups(groups);
    expect(sections.map((section) => section.key)).toEqual(["kids", "cat-pasta"]);
    expect(sections[0].title).toBe("Kids menu");
    expect(sections[0].groups[0].key).toBe("kids-cat-pasta");
    expect(sections[0].groups[0].displayName).toBe("Kids Pasta");
  });

  it("puts adult comparisons and kids in separate sections", () => {
    const adultA = {
      ...pizza("adult-a", "whole", "20"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      raw_name: "Penne Pomodoro",
    };
    const adultB = {
      ...pizza("adult-b", "whole", "22"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      raw_name: "Ziti Pomodoro",
    };
    const kid = {
      ...pizza("kid", "whole", "10"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      portion: "kids",
      raw_name: "Kids Ziti",
    };
    const sections = organizeDishGroups(groupItemsByDish([adultA, adultB, kid]));
    expect(sections.map((section) => section.key)).toEqual(["compare", "kids"]);
    expect(sections[0].title).toBe("Compare like-for-like");
    expect(sections[0].groups[0].restaurantCount).toBe(2);
    expect(sections[1].groups[0].displayName).toBe("Kids Pasta");
    expect(sections[1].groups[0].items).toHaveLength(1);
  });

  it("does not split adult pomodoro by a generic meat token", () => {
    const adultA = {
      ...pizza("adult-a", "whole", "20"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      raw_name: "Penne Pomodoro",
    };
    const adultB = {
      ...pizza("adult-b", "whole", "22"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      raw_name: "Ziti Pomodoro",
    };
    const groups = groupItemsByDish([adultA, adultB]);
    expect(groups.map((group) => group.key)).toEqual(["POMODORO"]);
    expect(groups[0].useLocalMedian).toBe(false);
  });
});

describe("compare variants", () => {
  function pasta(
    id: string,
    dish: string,
    name: string,
    extras: Partial<MenuItem> = {},
  ): MenuItem {
    return {
      ...pizza(id, "whole", extras.price ?? "20"),
      canonical_category: "pasta",
      canonical_dish: dish,
      pizza_serving: null,
      raw_name: name,
      ...extras,
    };
  }

  it("keeps lobster gnocchi out of the sorrentina group", () => {
    const lobster = pasta("arya", "GNOCCHI", "Gnocchi con Aragosta", {
      price: "42",
      protein: ["lobster"],
      raw_description: "Maine lobster, tomato lobster broth",
    });
    const sorrentina = pasta("roccos", "GNOCCHI", "Gnocchi Sorrentina", {
      price: "19.95",
      sauce: "plum tomato sauce",
    });
    const groups = groupItemsByDish([lobster, sorrentina]);
    expect(groups.map((group) => group.key).sort()).toEqual([
      "GNOCCHI::lobster",
      "GNOCCHI::sorrentina",
    ]);
    expect(groups.map((group) => group.displayName).sort()).toEqual([
      "Gnocchi — Lobster",
      "Gnocchi — Sorrentina",
    ]);
    expect(groups.every((group) => group.useLocalMedian)).toBe(true);
  });

  it("does not re-split a promoted lobster gnocchi id", () => {
    const item = pasta("sage", "GNOCCHI_LOBSTER", "Ricotta Gnocchi, Maine Lobster", {
      protein: ["lobster"],
    });
    expect(compareVariant(item)).toBeNull();
    const groups = groupItemsByDish([item]);
    expect(groups[0].key).toBe("GNOCCHI_LOBSTER");
    expect(groups[0].displayName).toBe("Gnocchi Lobster");
    expect(groups[0].useLocalMedian).toBe(false);
  });

  it("does not split lobster ravioli by lobster again", () => {
    const ravioli = pasta("rav", "LOBSTER_RAVIOLI", "Lobster Ravioli", {
      protein: ["lobster"],
    });
    expect(groupItemsByDish([ravioli])[0].key).toBe("LOBSTER_RAVIOLI");
  });

  it("does not split bolognese by beef", () => {
    const bolognese = pasta("bolo", "BOLOGNESE", "Tagliatelle Bolognese", {
      protein: ["beef"],
      raw_description: "beef ragu",
    });
    expect(compareVariant(bolognese)).toBeNull();
    expect(groupItemsByDish([bolognese])[0].key).toBe("BOLOGNESE");
  });

  it("compares kids dishes by category when they do not share a name", () => {
    const butter = {
      ...pizza("butter", "whole", "16"),
      canonical_dish: null,
      canonical_category: "pasta",
      pizza_serving: null,
      portion: "kids",
      raw_name: "Pasta and Butter",
    } as MenuItem;
    const ziti = {
      ...pizza("ziti", "whole", "10"),
      canonical_dish: "POMODORO",
      canonical_category: "pasta",
      pizza_serving: null,
      portion: "kids",
      raw_name: "Kids Ziti",
    };
    const chicken = {
      ...pizza("chicken", "whole", "16"),
      canonical_dish: null,
      canonical_category: "meat",
      pizza_serving: null,
      portion: "kids",
      raw_name: "Chicken Tenders",
    } as MenuItem;
    const sections = organizeDishGroups(groupItemsByDish([butter, ziti, chicken]));
    expect(sections.map((section) => section.key)).toEqual(["kids"]);
    expect(sections[0].groups.map((group) => group.displayName)).toEqual(["Kids Pasta", "Kids Meat"]);
    expect(sections[0].groups[0].restaurantCount).toBe(2);
  });
});
