import { PriceRangeStrip } from "@/components/PriceRangeStrip";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { formatDollars, formatPrice, prettyCategory } from "@/lib/format";
import { oneItemPerRestaurant, type DishGroup } from "@/lib/dishGroups";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from "@/lib/categoryIcons";
import type { MenuItem } from "@/lib/types";

const PREVIEW_ROWS = 5;

export function DishGroupCard({
  group,
  onOpen,
  onCompare,
}: {
  group: DishGroup;
  onOpen: (item: MenuItem) => void;
  onCompare?: () => void;
}) {
  const comparable = group.key.startsWith("kids-cat-") ? group.items : oneItemPerRestaurant(group.items);
  const ranked = [...comparable].sort((a, b) => {
    if (a.price == null && b.price == null) return a.restaurant_name.localeCompare(b.restaurant_name);
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return Number(a.price) - Number(b.price);
  });
  const preview = ranked.slice(0, PREVIEW_ROWS);
  const hidden = ranked.length - preview.length;
  const category = group.items[0]?.canonical_category;
  const medianPrice =
    group.items[0]?.north_end_median_price != null ? Number(group.items[0].north_end_median_price) : null;
  const range =
    group.minPrice != null && group.maxPrice != null
      ? group.minPrice === group.maxPrice
        ? formatDollars(group.minPrice)
        : `${formatDollars(group.minPrice)}–${formatDollars(group.maxPrice)}`
      : null;

  return (
    <article className="flex flex-col rounded-xl border border-line bg-card p-3 shadow-[0_1px_3px_rgba(23,27,32,0.04)]">
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linen-2 text-lg"
          aria-hidden="true"
        >
          {CATEGORY_ICONS[category ?? ""] ?? DEFAULT_CATEGORY_ICON}
        </span>
        <div className="min-w-0 flex-1">
          {onCompare ? (
            <button type="button" onClick={onCompare} className="min-w-0 text-left">
              <span className="block text-sm font-bold leading-snug text-ink">{group.displayName}</span>
            </button>
          ) : (
            <h2 className="text-sm font-bold leading-snug text-ink">{group.displayName}</h2>
          )}
          <p className="mt-0.5 text-[11px] text-muted">
            {category ? <span className="capitalize">{prettyCategory(category)}</span> : null}
            {category ? " · " : null}
            {group.restaurantCount} place{group.restaurantCount === 1 ? "" : "s"}
            {range ? ` · ${range}` : null}
          </p>
          <PriceRangeStrip minPrice={group.minPrice} maxPrice={group.maxPrice} medianPrice={medianPrice} />
        </div>
      </div>

      <ul className="mt-3 divide-y divide-line/70">
        {preview.map((item, index) => {
          const pct = item.pct_vs_median;
          const priced = item.price != null && pct != null && Math.abs(pct) > 5;
          const cheapest = index === 0 && item.price != null && ranked.some((row) => row.price != null);
          return (
            <li key={item.menu_item_id} className={cheapest ? "-mx-1 rounded-md bg-basil-soft/50 px-1" : undefined}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-2 py-1.5 text-left"
              >
                <PlaceMark item={item} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{item.restaurant_name}</span>
                  {item.raw_name !== group.displayName ? (
                    <span className="block truncate text-[10px] text-muted">{item.raw_name}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-[13px] font-bold tabular-nums ${cheapest ? "text-basil" : "text-ink"}`}>
                    {formatPrice(item)}
                  </span>
                  {priced ? (
                    <span className={`block text-[10px] tabular-nums ${pct < 0 ? "text-basil" : "text-tomato"}`}>
                      {pct < 0 ? "−" : "+"}
                      {Math.round(Math.abs(pct))}%
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hidden > 0 || onCompare ? (
        <button
          type="button"
          onClick={onCompare}
          className="mt-2 self-start text-[11px] font-semibold text-primary underline underline-offset-2"
        >
          {hidden > 0 ? `Compare all ${ranked.length} prices` : "Open price comparison"}
        </button>
      ) : null}
    </article>
  );
}

function PlaceMark({ item }: { item: MenuItem }) {
  if (item.photo_url) {
    return (
      <RestaurantPhoto
        restaurantId={item.restaurant_id}
        localSrc={item.photo_url}
        alt=""
        variant="thumbnail"
        allowGoogle={false}
        showSourceLink={false}
        className="size-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linen-2 text-[10px] font-bold text-muted"
      aria-hidden="true"
    >
      {item.restaurant_name.slice(0, 1)}
    </span>
  );
}
