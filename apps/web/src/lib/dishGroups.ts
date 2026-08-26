import { prettyDish } from "@/lib/format";
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

/** Groups items sharing a canonical_dish so they can be compared across
 * restaurants (intent-build-plan.md's Phase 13 "Dish page" idea — one card
 * per dish, not per menu item). Items without a canonical_dish match get
 * their own singleton group, keyed by their own id, so they still render —
 * just never merge with anything.
 */
export function groupItemsByDish(items: MenuItem[]): DishGroup[] {
  const byKey = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key = item.canonical_dish ?? `__item_${item.menu_item_id}`;
    const list = byKey.get(key);
    if (list) {
      list.push(item);
    } else {
      byKey.set(key, [item]);
    }
  }

  const groups: DishGroup[] = [];
  for (const [key, groupItems] of byKey) {
    const sorted = [...groupItems].sort((a, b) => {
      const priceA = a.price != null ? Number(a.price) : Number.POSITIVE_INFINITY;
      const priceB = b.price != null ? Number(b.price) : Number.POSITIVE_INFINITY;
      return priceA - priceB;
    });
    const prices = sorted.map((item) => (item.price != null ? Number(item.price) : null)).filter(
      (price): price is number => price != null,
    );
    const first = sorted[0];
    groups.push({
      key,
      displayName: first.canonical_dish ? prettyDish(first.canonical_dish) : first.raw_name,
      items: sorted,
      restaurantCount: new Set(sorted.map((item) => item.restaurant_id)).size,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      avgPrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
    });
  }

  groups.sort((a, b) => {
    if (a.restaurantCount !== b.restaurantCount) return b.restaurantCount - a.restaurantCount;
    return a.displayName.localeCompare(b.displayName);
  });
  return groups;
}
