import { prettyCategory, prettyDish } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export type DishGroup = {
  key: string;
  displayName: string;
  items: MenuItem[];
  restaurantCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
};

export function isKidsItem(item: Pick<MenuItem, "portion" | "menu_section" | "raw_name">): boolean {
  const haystack = `${item.portion ?? ""} ${item.menu_section ?? ""} ${item.raw_name}`.toLowerCase();
  return /\bkids?\b|\bchild(?:ren)?\b|\bbambini\b/.test(haystack);
}

export function pizzaServingLabel(serving: MenuItem["pizza_serving"]): string | null {
  if (serving === "slice") return "Slice";
  if (serving === "whole") return "Whole pizza";
  if (serving === "unknown") return "Serving size unclear";
  return null;
}

export function oneItemPerRestaurant(items: MenuItem[]): MenuItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.restaurant_id)) return false;
    seen.add(item.restaurant_id);
    return true;
  });
}

/** Groups items sharing a canonical_dish so they can be compared across
 * restaurants (intent-build-plan.md's Phase 13 "Dish page" idea — one card
 * per dish, not per menu item). Items without a canonical_dish match get
 * their own singleton group, keyed by their own id, so they still render —
 * just never merge with anything.
 */
export function groupItemsByDish(items: MenuItem[]): DishGroup[] {
  const byKey = new Map<string, MenuItem[]>();
  for (const item of items) {
    const servingKey = item.canonical_category === "pizza" ? `::${item.pizza_serving ?? "unknown"}` : "";
    const kidsKey = isKidsItem(item) ? "::kids" : "";
    const key = item.canonical_dish ? `${item.canonical_dish}${servingKey}${kidsKey}` : `__item_${item.menu_item_id}`;
    const list = byKey.get(key);
    if (list) {
      list.push(item);
    } else {
      byKey.set(key, [item]);
    }
  }

  const groups: DishGroup[] = [];
  for (const [key, groupItems] of byKey) {
    const ranked = [...groupItems];
    const prices = ranked.map((item) => (item.price != null ? Number(item.price) : null)).filter(
      (price): price is number => price != null,
    );
    const first = ranked[0];
    const servingLabel = pizzaServingLabel(first.pizza_serving);
    const kidsLabel = isKidsItem(first) ? "Kids" : null;
    const suffix = [servingLabel, kidsLabel].filter(Boolean).join(" · ");
    groups.push({
      key,
      displayName: first.canonical_dish
        ? `${prettyDish(first.canonical_dish)}${suffix ? ` — ${suffix}` : ""}`
        : first.raw_name,
      items: ranked,
      restaurantCount: new Set(ranked.map((item) => item.restaurant_id)).size,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      avgPrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
    });
  }

  return groups;
}

export type DishSection = {
  key: string;
  title: string;
  groups: DishGroup[];
};

const SINGLETON_ORDER = ["slice", "whole", "calzone", "build", "pizza-other"];

function singletonBucket(group: DishGroup): { key: string; title: string } {
  const item = group.items[0];
  const name = `${group.displayName} ${item?.raw_name ?? ""}`.toLowerCase();
  if (/calzone|stromboli/.test(name)) return { key: "calzone", title: "Calzones" };
  if (/topping|make your own|build your own|create your own/.test(name)) {
    return { key: "build", title: "Build your own" };
  }
  if (item?.canonical_category === "pizza" || /\bpizza\b/.test(name)) {
    if (item?.pizza_serving === "slice") return { key: "slice", title: "By the slice" };
    if (item?.pizza_serving === "whole") return { key: "whole", title: "Whole pies" };
    return { key: "pizza-other", title: "Other pizza" };
  }
  const category = item?.canonical_category;
  if (category) return { key: `cat-${category}`, title: prettyCategory(category) };
  return { key: "more", title: "More dishes" };
}

function sortByName(groups: DishGroup[]): DishGroup[] {
  return [...groups].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function isKidsGroup(group: DishGroup): boolean {
  return group.key.endsWith("::kids") || group.key.startsWith("kids-cat-") || group.items.some((item) => isKidsItem(item));
}

function priceStats(items: MenuItem[]) {
  const prices = items.map((item) => (item.price != null ? Number(item.price) : null)).filter(
    (price): price is number => price != null,
  );
  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
  };
}

/** Kids menus rarely share a canonical dish, so compare them by category
 * (kids pasta vs kids pasta) instead of leaving nine singleton cards. */
function mergeKidsByCategory(groups: DishGroup[]): DishGroup[] {
  const byCategory = new Map<string, MenuItem[]>();
  for (const group of groups) {
    const category = group.items[0]?.canonical_category ?? "other";
    const list = byCategory.get(category) ?? [];
    list.push(...group.items);
    byCategory.set(category, list);
  }
  return [...byCategory.entries()]
    .map(([category, items]) => ({
      key: `kids-cat-${category}`,
      displayName: category === "other" ? "Kids dishes" : `Kids ${prettyDish(category)}`,
      items,
      restaurantCount: new Set(items.map((item) => item.restaurant_id)).size,
      ...priceStats(items),
    }))
    .sort((a, b) => b.restaurantCount - a.restaurantCount || a.displayName.localeCompare(b.displayName));
}

/** Sections a flat dish list so compare cards, slices, whole pies, and
 * one-off items are not dumped into one uneven grid. */
export function organizeDishGroups(groups: DishGroup[]): DishSection[] {
  const kids = mergeKidsByCategory(groups.filter((group) => isKidsGroup(group)));
  const adults = groups.filter((group) => !isKidsGroup(group));

  const compare = adults
    .filter((group) => group.restaurantCount >= 2)
    .sort((a, b) => b.restaurantCount - a.restaurantCount || a.displayName.localeCompare(b.displayName));

  const buckets = new Map<string, DishSection>();
  for (const group of adults.filter((entry) => entry.restaurantCount < 2)) {
    const { key, title } = singletonBucket(group);
    const section = buckets.get(key) ?? { key, title, groups: [] };
    section.groups.push(group);
    buckets.set(key, section);
  }

  const sections: DishSection[] = [];
  if (compare.length) {
    sections.push({ key: "compare", title: "Compare like-for-like", groups: compare });
  }
  if (kids.length) {
    sections.push({ key: "kids", title: "Kids menu", groups: kids });
  }
  for (const key of SINGLETON_ORDER) {
    const section = buckets.get(key);
    if (section?.groups.length) sections.push({ ...section, groups: sortByName(section.groups) });
    buckets.delete(key);
  }
  const rest = [...buckets.values()]
    .filter((section) => section.groups.length)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((section) => ({ ...section, groups: sortByName(section.groups) }));
  return [...sections, ...rest];
}
