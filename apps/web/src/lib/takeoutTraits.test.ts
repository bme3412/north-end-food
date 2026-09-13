import { describe, expect, it } from "vitest";

import {
  orderPath,
  pickupNowLabel,
  restaurantTakeoutFlags,
  takeoutFlagLabels,
  takeoutSuitability,
  takeoutSuitabilityLabel,
} from "./takeoutTraits";

describe("takeoutSuitability", () => {
  it("marks pizza and cannoli as good travelers", () => {
    expect(takeoutSuitability({ canonical_dish: "CHEESE_PIZZA", canonical_category: "pizza", sauce: null, preparation: null })).toBe(
      "good",
    );
    expect(takeoutSuitability({ canonical_dish: "CANNOLI", canonical_category: "dessert", sauce: null, preparation: null })).toBe(
      "good",
    );
    expect(
      takeoutSuitabilityLabel(
        takeoutSuitability({ canonical_dish: "CHEESE_PIZZA", canonical_category: "pizza", sauce: null, preparation: null }),
      ),
    ).toBe("Travels well");
  });

  it("marks cream sauces and fried seafood as better eaten here", () => {
    expect(takeoutSuitability({ canonical_dish: "CARBONARA", canonical_category: "pasta", sauce: "carbonara", preparation: null })).toBe(
      "poor",
    );
    expect(takeoutSuitability({ canonical_dish: "CALAMARI", canonical_category: "seafood", sauce: null, preparation: "fried" })).toBe(
      "poor",
    );
    expect(
      takeoutSuitabilityLabel(
        takeoutSuitability({ canonical_dish: "CALAMARI", canonical_category: "seafood", sauce: null, preparation: "fried" }),
      ),
    ).toBe("Better eaten here");
  });
});

describe("restaurant takeout flags", () => {
  it("flags Galleria Umberto as cash-only and not on apps", () => {
    const flags = restaurantTakeoutFlags("NE_0031");
    expect(takeoutFlagLabels(flags)).toEqual(["Cash only", "Not on apps", "Often sells out"]);
    expect(orderPath({ official_website: null, restaurant_id: "NE_0031" })).toEqual({
      href: null,
      label: "Walk up",
    });
  });

  it("prefers a restaurant website over walk-up", () => {
    expect(orderPath({ official_website: "https://ernestospizza.com/", restaurant_id: "NE_0017" })).toEqual({
      href: "https://ernestospizza.com/",
      label: "Order on their site",
    });
  });
});

describe("pickupNowLabel", () => {
  it("pairs open-now with quiet busyness", () => {
    expect(pickupNowLabel({ open_now: true, busyness_percent: 20, hours_summary: "11am–9pm" })).toBe(
      "Open for pickup · usually quiet now",
    );
  });

  it("uses dining hours when the counter is closed", () => {
    expect(pickupNowLabel({ open_now: false, busyness_percent: null, hours_summary: "Tue–Sat 10:45am–2:30pm" })).toBe(
      "Closed now · Tue–Sat 10:45am–2:30pm",
    );
  });
});
