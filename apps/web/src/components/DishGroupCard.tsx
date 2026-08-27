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
  const representativeItems = group.items.filter(
    (item, index, items) => items.findIndex((candidate) => candidate.restaurant_id === item.restaurant_id) === index,
  );

  return (
    <article className="rounded-xl border border-line bg-card p-3 shadow-[0_1px_3px_rgba(23,27,32,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold leading-snug text-ink">
          {group.displayName}
        </h2>
        <p className="shrink-0 rounded-md bg-primary-soft px-2 py-1 text-[9px] font-semibold text-primary">
          {group.restaurantCount} place{group.restaurantCount === 1 ? "" : "s"}
        </p>
      </div>
      {group.avgPrice != null ? (
        <p className="mt-1 text-xs text-muted">Avg {formatDollars(group.avgPrice)}</p>
      ) : null}
      <div className="mt-3 flex flex-col divide-y divide-line/60">
        {representativeItems.map((item) => (
          <button
            key={item.menu_item_id}
            type="button"
            onClick={() => onOpen(item)}
            className="flex items-center justify-between gap-3 py-2 text-left text-sm"
          >
            <span className="min-w-0 truncate text-ink">{item.restaurant_name}</span>
            <span className="shrink-0 font-bold text-tomato">{formatPrice(item)}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
