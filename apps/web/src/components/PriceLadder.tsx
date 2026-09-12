import { formatDollars, formatPrice } from "@/lib/format";
import {
  divergingAxisMax,
  divergingBarWidthPercent,
  joinRestaurantNames,
  pctVsMedian,
} from "@/lib/priceScale";
import type { MenuItem } from "@/lib/types";

const AT_MEDIAN = 0.5;

export function PriceLadder({
  items,
  displayName,
  medianPrice,
  onOpen,
}: {
  items: MenuItem[];
  displayName: string;
  medianPrice: number | string | null;
  onOpen: (item: MenuItem) => void;
}) {
  const median = resolveMedian(items, medianPrice);
  const ranked = [...items].sort((a, b) => {
    if (a.price == null && b.price == null) return a.restaurant_name.localeCompare(b.restaurant_name);
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return Number(a.price) - Number(b.price);
  });
  const priced = ranked.filter((item) => item.price != null);
  const unpriced = ranked.filter((item) => item.price == null);
  const pcts = priced
    .map((item) => pctVsMedian(Number(item.price), median))
    .filter((pct): pct is number => pct != null);
  const axisMax = divergingAxisMax(pcts);

  return (
    <section className="rounded-xl border border-line bg-card px-3 py-4 shadow-[0_1px_3px_rgba(23,27,32,0.04)] sm:px-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-snug text-ink">{displayName}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {median != null ? `vs North End median of ${formatDollars(median)}` : "Prices across the North End"}
          </p>
        </div>
        <p className="shrink-0 text-[12px] text-muted">{priced.length} priced</p>
      </header>

      <div className="mt-4 flex flex-col gap-2.5">
        <div className="grid grid-cols-[minmax(5.25rem,8.5rem)_minmax(0,1fr)_minmax(5.25rem,7rem)] items-center gap-x-2 sm:gap-x-3">
          <span />
          <div className="flex justify-between text-[10px] text-muted">
            <span>−{axisMax}%</span>
            <span>median</span>
            <span>+{axisMax}%</span>
          </div>
          <span />
        </div>

        {priced.map((item) => {
          const pct = pctVsMedian(Number(item.price), median);
          const atMedian = pct == null || Math.abs(pct) < AT_MEDIAN;
          const width = pct == null || atMedian ? 0 : divergingBarWidthPercent(pct, axisMax);
          const cheaper = pct != null && pct < 0 && !atMedian;
          return (
            <button
              key={item.menu_item_id}
              type="button"
              onClick={() => onOpen(item)}
              className="grid w-full grid-cols-[minmax(5.25rem,8.5rem)_minmax(0,1fr)_minmax(5.25rem,7rem)] items-center gap-x-2 text-left sm:gap-x-3"
            >
              <span className="truncate text-[13px] font-medium text-ink">{item.restaurant_name}</span>
              <span className="relative h-2.5">
                <span className="absolute inset-y-[-6px] left-1/2 w-px -translate-x-1/2 bg-line" />
                {atMedian ? (
                  <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted" />
                ) : (
                  <span
                    className={`absolute top-0 h-2.5 rounded-full ${cheaper ? "bg-basil" : "bg-tomato"}`}
                    style={cheaper ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }}
                  />
                )}
              </span>
              <span className="text-right text-[12px] tabular-nums text-ink">
                <span className="font-semibold">{formatPrice(item)}</span>
                {pct != null ? (
                  <span className={`ml-1 ${atMedian ? "text-muted" : cheaper ? "text-basil" : "text-tomato"}`}>
                    {atMedian ? "at median" : `${pct < 0 ? "−" : "+"}${Math.round(Math.abs(pct))}%`}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {unpriced.length ? (
        <p className="mt-4 text-[12px] text-muted">
          {joinRestaurantNames(unpriced.map((item) => item.restaurant_name))} serve
          {unpriced.length === 1 ? "s" : ""} this without listing a price
        </p>
      ) : null}
    </section>
  );
}

function resolveMedian(items: MenuItem[], medianPrice: number | string | null): number | null {
  if (medianPrice != null && Number.isFinite(Number(medianPrice)) && Number(medianPrice) > 0) {
    return Number(medianPrice);
  }
  const prices = items
    .map((item) => (item.price != null ? Number(item.price) : null))
    .filter((price): price is number => price != null)
    .sort((a, b) => a - b);
  if (!prices.length) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}
