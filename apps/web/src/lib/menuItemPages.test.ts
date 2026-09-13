import { describe, expect, it, vi } from "vitest";

import {
  collectAllMenuItemPages,
  mergeMenuItemPages,
  placesFromItems,
  shouldFetchNextPage,
} from "./menuItemPages";
import type { MenuItem, MenuItemList } from "./types";

function item(partial: Partial<MenuItem> & Pick<MenuItem, "menu_item_id" | "restaurant_id" | "restaurant_name" | "raw_name">): MenuItem {
  return {
    restaurant_slug: partial.restaurant_id,
    raw_description: null,
    raw_price_text: null,
    price: null,
    currency: "USD",
    menu_section: null,
    canonical_category: "pasta",
    canonical_dish: null,
    protein: null,
    pasta_type: null,
    sauce: null,
    preparation: null,
    ingredients: null,
    dietary_tags: null,
    portion: null,
    size: null,
    pizza_serving: null,
    seasonal: false,
    market_price: false,
    available: true,
    normalization_confidence: null,
    north_end_median_price: null,
    pct_vs_median: null,
    open_now: true,
    hours_summary: null,
    rating: null,
    review_count: null,
    price_level: null,
    takeout: null,
    dine_in: null,
    delivery: null,
    official_website: null,
    busyness_percent: null,
    menu_snapshot_id: "snap",
    retrieved_at: null,
    source_url: null,
    source_badge: "manual_seed",
    latitude: 42.36,
    longitude: -71.05,
    establishment_type: "restaurant",
    primary_cuisine: "italian",
    address: "North End",
    photo_url: null,
    ...partial,
  };
}

function page(items: MenuItem[], total: number, extra: Partial<MenuItemList> = {}): MenuItemList {
  return {
    total,
    items,
    places: [],
    parsed_tokens: ["gnocchi"],
    parsed_pizza_serving: null,
    resolved_category: "pasta",
    resolved_dish: null,
    resolved_restaurant_id: null,
    resolved_restaurant_name: null,
    ...extra,
  };
}

describe("placesFromItems", () => {
  it("groups by restaurant and uses the cheapest priced dish for the pin", () => {
    const aryaCheap = item({
      menu_item_id: "a1",
      restaurant_id: "NE_0035",
      restaurant_name: "Arya Trattoria",
      raw_name: "Cacio e Pepe",
      price: "26.00",
      pct_vs_median: -10,
    });
    const aryaExpensive = item({
      menu_item_id: "a2",
      restaurant_id: "NE_0035",
      restaurant_name: "Arya Trattoria",
      raw_name: "Gnocchi con Aragosta",
      price: "42.00",
      pct_vs_median: 20,
    });
    const tresca = item({
      menu_item_id: "t1",
      restaurant_id: "NE_0034",
      restaurant_name: "Tresca",
      raw_name: "Black Truffle Ricotta Gnocchi",
      price: "31.00",
      pct_vs_median: 5,
    });

    const places = placesFromItems([aryaExpensive, aryaCheap, tresca]);
    expect(places).toHaveLength(2);

    const arya = places.find((place) => place.restaurant_id === "NE_0035");
    expect(arya?.match_count).toBe(2);
    expect(arya?.sample_name).toBe("Cacio e Pepe");
    expect(arya?.lowest_price).toBe("26.00");
    expect(arya?.lowest_price_pct_vs_median).toBe(-10);

    const trescaPlace = places.find((place) => place.restaurant_id === "NE_0034");
    expect(trescaPlace?.match_count).toBe(1);
    expect(trescaPlace?.sample_name).toBe("Black Truffle Ricotta Gnocchi");
  });

  it("ignores unpriced rows when picking the cheapest sample", () => {
    const unpriced = item({
      menu_item_id: "u1",
      restaurant_id: "NE_0038",
      restaurant_name: "Table",
      raw_name: "Gnocchi di Ricotta",
      price: null,
    });
    const priced = item({
      menu_item_id: "u2",
      restaurant_id: "NE_0038",
      restaurant_name: "Table",
      raw_name: "Tagliatelle",
      price: "28.00",
      pct_vs_median: 0,
    });

    const [place] = placesFromItems([unpriced, priced]);
    expect(place.sample_name).toBe("Tagliatelle");
    expect(place.lowest_price).toBe("28.00");
    expect(place.match_count).toBe(2);
  });
});

describe("mergeMenuItemPages", () => {
  it("concatenates items and rebuilds places across pages", () => {
    const cheap = item({
      menu_item_id: "p1",
      restaurant_id: "NE_0001",
      restaurant_name: "Giacomo's Ristorante",
      raw_name: "Penne",
      price: "18.00",
    });
    const expensive = item({
      menu_item_id: "p2",
      restaurant_id: "NE_0035",
      restaurant_name: "Arya Trattoria",
      raw_name: "Gnocchi con Aragosta",
      price: "42.00",
    });

    const merged = mergeMenuItemPages([
      page([cheap], 2, { resolved_category: "pasta" }),
      page([expensive], 2),
    ]);

    expect(merged.items.map((row) => row.menu_item_id)).toEqual(["p1", "p2"]);
    expect(merged.total).toBe(2);
    expect(merged.resolved_category).toBe("pasta");
    expect(merged.parsed_tokens).toEqual(["gnocchi"]);
    expect(merged.places.map((place) => place.restaurant_id).sort()).toEqual(["NE_0001", "NE_0035"]);
    expect(merged.places.find((place) => place.restaurant_id === "NE_0001")?.match_count).toBe(1);
  });

  it("sums match_count when the same restaurant appears on two pages", () => {
    const first = item({
      menu_item_id: "s1",
      restaurant_id: "NE_0033",
      restaurant_name: "Strega by Nick Varano",
      raw_name: "Spaghetti",
      price: "22.00",
    });
    const second = item({
      menu_item_id: "s2",
      restaurant_id: "NE_0033",
      restaurant_name: "Strega by Nick Varano",
      raw_name: "Gnocchi Sorrentina",
      price: "29.00",
    });

    const merged = mergeMenuItemPages([page([first], 2), page([second], 2)]);
    expect(merged.places).toHaveLength(1);
    expect(merged.places[0].match_count).toBe(2);
    expect(merged.places[0].sample_name).toBe("Spaghetti");
  });
});

describe("shouldFetchNextPage", () => {
  it("stops on an empty or short page and when the full total is loaded", () => {
    expect(shouldFetchNextPage(0, 0, 421, 500)).toBe(false);
    expect(shouldFetchNextPage(421, 421, 421, 500)).toBe(false);
    expect(shouldFetchNextPage(200, 200, 421, 500)).toBe(false);
    expect(shouldFetchNextPage(500, 500, 900, 500)).toBe(true);
  });
});

describe("collectAllMenuItemPages", () => {
  it("requests a second page and merges when the first page is full", async () => {
    const firstItems = Array.from({ length: 3 }, (_, index) =>
      item({
        menu_item_id: `a${index}`,
        restaurant_id: "NE_0001",
        restaurant_name: "Giacomo's",
        raw_name: `Cheap ${index}`,
        price: "10.00",
      }),
    );
    const secondItems = [
      item({
        menu_item_id: "arya",
        restaurant_id: "NE_0035",
        restaurant_name: "Arya Trattoria",
        raw_name: "Gnocchi con Aragosta",
        price: "42.00",
      }),
    ];
    const fetchPage = vi.fn(async (offset: number) => {
      if (offset === 0) return page(firstItems, 4);
      return page(secondItems, 4);
    });

    const result = await collectAllMenuItemPages(fetchPage, 3);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 3);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 3, 3);
    expect(result.items).toHaveLength(4);
    expect(result.places.map((place) => place.restaurant_id)).toEqual(["NE_0001", "NE_0035"]);
  });

  it("does not loop on an empty page", async () => {
    const fetchPage = vi.fn(async () => page([], 0));
    const result = await collectAllMenuItemPages(fetchPage, 500);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([]);
  });

  it("does not loop when a page is shorter than the page size", async () => {
    const fetchPage = vi.fn(async () =>
      page(
        [
          item({
            menu_item_id: "one",
            restaurant_id: "NE_0039",
            restaurant_name: "Little Sage",
            raw_name: "Ricotta Gnocchi, Maine Lobster",
            price: "34.00",
          }),
        ],
        1,
      ),
    );
    const result = await collectAllMenuItemPages(fetchPage, 500);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
  });

  it("stops after the safety cap if a fetcher keeps returning full pages", async () => {
    const fullPage = Array.from({ length: 2 }, (_, index) =>
      item({
        menu_item_id: `loop-${index}`,
        restaurant_id: "NE_0001",
        restaurant_name: "Loop",
        raw_name: `Item ${index}`,
        price: "12.00",
      }),
    );
    const fetchPage = vi.fn(async () => page(fullPage, 10_000));
    const result = await collectAllMenuItemPages(fetchPage, 2);
    expect(fetchPage).toHaveBeenCalledTimes(20);
    expect(result.items.length).toBe(40);
  });
});
