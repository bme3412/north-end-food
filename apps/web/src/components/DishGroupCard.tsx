import { formatDollars, formatPrice } from "@/lib/format";
import { NORTH_END_CENTER, haversineMiles } from "@/lib/geo";
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
    <article className="rounded-2xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(42,35,28,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-fraunces)] text-base font-medium leading-snug text-ink">
          {group.displayName}
        </h2>
        <p className="shrink-0 rounded-full bg-tomato-soft px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-tomato">
          {group.restaurantCount} place{group.restaurantCount === 1 ? "" : "s"}
        </p>
      </div>
      {group.avgPrice != null ? (
        <p className="mt-1 text-xs text-muted">Avg {formatDollars(group.avgPrice)}</p>
      ) : null}
      <div className="mt-3 flex flex-col divide-y divide-line/60">
        {group.items.map((item) => {
          const distance =
            item.latitude != null && item.longitude != null
              ? haversineMiles(item.latitude, item.longitude, NORTH_END_CENTER.latitude, NORTH_END_CENTER.longitude)
              : null;
          return (
            <button
              key={item.menu_item_id}
              type="button"
              onClick={() => onOpen(item)}
              className="flex items-center justify-between gap-3 py-2 text-left text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate text-ink">{item.restaurant_name}</span>
                {distance != null ? (
                  <span className="block text-xs text-muted">{distance.toFixed(1)} mi</span>
                ) : null}
              </span>
              <span className="shrink-0 font-bold text-tomato">{formatPrice(item)}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
