import type { MenuItem, MenuItemList, PlaceMatch } from "./types";

export const MENU_ITEM_PAGE_SIZE = 500;
const MAX_PAGES = 20;

function priceValue(price: string | null): number | null {
  if (price == null || price === "") return null;
  const parsed = Number(price);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Rebuild map pins from a full item list. Mirrors API `_places`. */
export function placesFromItems(items: MenuItem[]): PlaceMatch[] {
  const grouped = new Map<string, MenuItem[]>();
  for (const item of items) {
    const group = grouped.get(item.restaurant_id);
    if (group) group.push(item);
    else grouped.set(item.restaurant_id, [item]);
  }

  const places: PlaceMatch[] = [];
  for (const [restaurantId, group] of grouped) {
    const first = group[0];
    const priced = group
      .map((item) => priceValue(item.price))
      .filter((price): price is number => price != null);
    const cheapest = group.reduce((best, item) => {
      const itemPrice = priceValue(item.price);
      const bestPrice = priceValue(best.price);
      if (itemPrice == null) return best;
      if (bestPrice == null) return item;
      return itemPrice < bestPrice ? item : best;
    });
    const cheapestPrice = priceValue(cheapest.price);
    places.push({
      restaurant_id: restaurantId,
      name: first.restaurant_name,
      address: first.address ?? "",
      latitude: first.latitude,
      longitude: first.longitude,
      establishment_type: first.establishment_type ?? "",
      primary_cuisine: first.primary_cuisine,
      match_count: group.length,
      lowest_price: cheapestPrice == null ? null : cheapest.price,
      lowest_price_pct_vs_median: cheapest.pct_vs_median,
      sample_name: cheapest.raw_name,
      photo_url: first.photo_url,
      open_now: first.open_now,
      hours_summary: first.hours_summary,
      rating: first.rating,
      review_count: first.review_count,
      price_level: first.price_level,
      takeout: first.takeout,
      dine_in: first.dine_in,
      delivery: first.delivery,
    });
  }
  return places;
}

export function emptyMenuItemList(): MenuItemList {
  return {
    total: 0,
    items: [],
    places: [],
    parsed_tokens: [],
    parsed_pizza_serving: null,
    resolved_category: null,
    resolved_dish: null,
    resolved_restaurant_id: null,
    resolved_restaurant_name: null,
  };
}

export function mergeMenuItemPages(pages: MenuItemList[]): MenuItemList {
  if (pages.length === 0) return emptyMenuItemList();
  const items = pages.flatMap((page) => page.items);
  return {
    ...pages[0],
    items,
    places: placesFromItems(items),
  };
}

export function shouldFetchNextPage(
  loaded: number,
  pageItemCount: number,
  total: number,
  pageSize = MENU_ITEM_PAGE_SIZE,
): boolean {
  if (pageItemCount === 0) return false;
  if (loaded >= total) return false;
  if (pageItemCount < pageSize) return false;
  return true;
}

export async function collectAllMenuItemPages(
  fetchPage: (offset: number, limit: number) => Promise<MenuItemList>,
  pageSize = MENU_ITEM_PAGE_SIZE,
): Promise<MenuItemList> {
  const pages: MenuItemList[] = [];
  let offset = 0;
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await fetchPage(offset, pageSize);
    pages.push(page);
    const loaded = pages.reduce((sum, entry) => sum + entry.items.length, 0);
    if (!shouldFetchNextPage(loaded, page.items.length, page.total, pageSize)) {
      break;
    }
    offset += page.items.length;
    if (page.items.length === 0) break;
  }
  return mergeMenuItemPages(pages);
}
