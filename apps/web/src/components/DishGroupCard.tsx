import { formatDollars, formatPrice } from "@/lib/format";
import type { DishGroup } from "@/lib/dishGroups";
import type { MenuItem } from "@/lib/types";

export function DishGroupCard({
  group,
  onOpen,
}: {
  group: DishGroup;
  onOpen: (item: MenuItem) => void;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-3 shadow-[0_1px_0_rgba(42,35,28,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-fraunces)] text-base font-medium leading-snug text-ink">
          {group.displayName}
        </h2>
        <p className="shrink-0 text-xs text-muted">
          {group.restaurantCount} restaurant{group.restaurantCount === 1 ? "" : "s"}
        </p>
      </div>
      {group.minPrice != null && group.maxPrice != null ? (
        <p className="mt-0.5 text-xs text-muted">
          {group.minPrice === group.maxPrice
            ? `${formatDollars(group.minPrice)} everywhere`
            : `${formatDollars(group.minPrice)}–${formatDollars(group.maxPrice)}`}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col divide-y divide-line/60">
        {group.items.map((item) => (
          <button
            key={item.menu_item_id}
            type="button"
            onClick={() => onOpen(item)}
            className="flex items-center justify-between gap-3 py-1.5 text-left text-sm"
          >
            <span className="truncate text-ink">{item.restaurant_name}</span>
            <span className="shrink-0 font-bold text-tomato">{formatPrice(item)}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
