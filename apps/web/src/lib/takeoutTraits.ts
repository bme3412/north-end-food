import type { MenuItem } from "./types";

export type TakeoutSuitability = "good" | "ok" | "poor";

export type RestaurantTakeoutFlags = {
  cashOnly: boolean;
  noDeliveryApps: boolean;
  oftenSellsOut: boolean;
  walkUpOnly: boolean;
};

const GOOD_DISHES = new Set([
  "CHEESE_PIZZA",
  "MARGHERITA",
  "WHITE_PIZZA",
  "PEPPERONI_PIZZA",
  "CALZONE",
  "CANNOLI",
  "RICOTTA_PIE",
  "TIRAMISU",
  "LASAGNA",
  "BAKED_ZITI",
  "MANICOTTI",
  "CHICKEN_PARMIGIANA",
  "EGGPLANT_PARMIGIANA",
]);

const POOR_DISHES = new Set([
  "CARBONARA",
  "CALAMARI",
  "FRUTTI_DI_MARE",
  "CIOPPINO",
  "LINGUINE_AND_CLAMS",
  "SHRIMP_SCAMPI",
]);

const GOOD_CATEGORIES = new Set(["pizza", "bakery"]);
const RESTAURANT_FLAGS: Record<string, Partial<RestaurantTakeoutFlags>> = {
  NE_0031: {
    cashOnly: true,
    noDeliveryApps: true,
    oftenSellsOut: true,
    walkUpOnly: true,
  },
};

export function restaurantTakeoutFlags(restaurantId: string): RestaurantTakeoutFlags {
  const flags = RESTAURANT_FLAGS[restaurantId] ?? {};
  return {
    cashOnly: Boolean(flags.cashOnly),
    noDeliveryApps: Boolean(flags.noDeliveryApps),
    oftenSellsOut: Boolean(flags.oftenSellsOut),
    walkUpOnly: Boolean(flags.walkUpOnly),
  };
}

export function takeoutFlagLabels(flags: RestaurantTakeoutFlags): string[] {
  const labels: string[] = [];
  if (flags.cashOnly) labels.push("Cash only");
  if (flags.noDeliveryApps) labels.push("Not on apps");
  if (flags.oftenSellsOut) labels.push("Often sells out");
  return labels;
}

export function takeoutSuitability(
  item: Pick<MenuItem, "canonical_dish" | "canonical_category" | "sauce" | "preparation">,
): TakeoutSuitability {
  const dish = item.canonical_dish ?? "";
  const category = (item.canonical_category ?? "").toLowerCase();
  const sauce = (item.sauce ?? "").toLowerCase();
  const preparation = (item.preparation ?? "").toLowerCase();
  const creamSauce = /carbonara|alfredo|cream|besciamella/.test(sauce);
  const friedSeafood = preparation.includes("fried") && (category === "seafood" || dish === "CALAMARI");

  if (POOR_DISHES.has(dish) || creamSauce || friedSeafood) return "poor";
  if (GOOD_DISHES.has(dish) || GOOD_CATEGORIES.has(category) || category === "dessert") return "good";
  return "ok";
}

export function takeoutSuitabilityLabel(suitability: TakeoutSuitability): string | null {
  if (suitability === "good") return "Travels well";
  if (suitability === "poor") return "Better eaten here";
  return null;
}

export function pickupNowLabel(
  item: Pick<MenuItem, "open_now" | "busyness_percent" | "hours_summary">,
): string | null {
  if (item.open_now === true) {
    const crowd = crowdHint(item.busyness_percent);
    return crowd ? `Open for pickup · ${crowd}` : "Open for pickup";
  }
  if (item.open_now === false) {
    return item.hours_summary ? `Closed now · ${item.hours_summary}` : "Closed now";
  }
  return null;
}

export function orderPath(
  item: Pick<MenuItem, "official_website" | "restaurant_id">,
): { href: string | null; label: string } {
  const flags = restaurantTakeoutFlags(item.restaurant_id);
  if (item.official_website) {
    return { href: item.official_website, label: "Order on their site" };
  }
  if (flags.walkUpOnly || flags.noDeliveryApps) {
    return { href: null, label: "Walk up" };
  }
  return { href: null, label: "Walk up" };
}

function crowdHint(percent: number | null | undefined): string | null {
  if (percent == null) return null;
  if (percent <= 35) return "usually quiet now";
  if (percent >= 70) return "usually busy now";
  return null;
}
