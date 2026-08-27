import { BarChart3, TrendingDown, Utensils } from "lucide-react";

import type { DishGroup } from "@/lib/dishGroups";
import { formatDollars } from "@/lib/format";
import { buildPriceHistogram } from "@/lib/histogram";

export function PriceDistributionPanel({ group }: { group: DishGroup }) {
  const prices = group.items.map((item) => (item.price != null ? Number(item.price) : null)).filter(
    (price): price is number => price != null,
  );
  const medianPrice = group.items[0]?.north_end_median_price ?? null;
  const savePct =
    medianPrice != null && group.minPrice != null && Number(medianPrice) > 0
      ? Math.round((1 - group.minPrice / Number(medianPrice)) * 100)
      : null;
  const buckets = prices.length >= 2 ? buildPriceHistogram(prices) : [];
  const maxCount = buckets.length ? Math.max(...buckets.map((bucket) => bucket.count)) : 0;

  return (
    <section className="rounded-xl border border-line bg-card p-4 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
      <div className="flex items-center gap-2">
        <Utensils className="size-4 text-muted" aria-hidden="true" />
        <h2 className="text-[13px] font-bold text-ink">
          Dish price comparison
        </h2>
      </div>
      <p className="ml-6 mt-0.5 text-[10px] text-muted">How North End {group.displayName.toLowerCase()} prices compare</p>

      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat label="Median price" value={medianPrice != null ? formatDollars(medianPrice) : "—"} />
        <Stat label="Lowest price" value={group.minPrice != null ? formatDollars(group.minPrice) : "—"} tone="basil" />
        <Stat label="Highest price" value={group.maxPrice != null ? formatDollars(group.maxPrice) : "—"} tone="tomato" />
        {savePct != null && savePct > 0 ? (
          <p className="col-span-3 flex items-center gap-2 rounded-lg border border-basil/10 bg-basil-soft px-3 py-2.5 text-[10px] text-ink sm:col-span-2">
            <TrendingDown className="size-5 shrink-0 text-basil" aria-hidden="true" />
            <span>You can save <strong>{savePct}%</strong> by choosing the lowest-priced option.</span>
          </p>
        ) : null}
      </div>

      {buckets.length ? (
        <div className="mt-3 rounded-lg border border-line p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink">
            <BarChart3 className="size-3.5 text-muted" aria-hidden="true" /> Price distribution
          </p>
          <div className="mt-2 flex items-end gap-2">
            <div className="flex h-20 flex-col justify-between text-right text-[8px] text-muted">
              <span>{maxCount}</span>
              <span>{Math.round(maxCount / 2)}</span>
              <span>0</span>
            </div>
            <div className="flex flex-1 items-end gap-1.5 border-l border-b border-line pl-2">
              {buckets.map((bucket) => {
                const heightPct = maxCount ? Math.max(6, Math.round((bucket.count / maxCount) * 100)) : 0;
                return (
                  <div key={bucket.start} className="flex flex-1 flex-col items-center">
                    <div className="flex h-16 w-full items-end">
                      <div
                        className="w-full rounded-t-sm bg-sky-400/70"
                        style={{ height: `${heightPct}%`, opacity: bucket.count === 0 ? 0.15 : 1 }}
                        title={`${formatDollars(bucket.start)}: ${bucket.count} dish${bucket.count === 1 ? "" : "es"}`}
                      />
                    </div>
                    <span className="mt-1.5 text-[8px] text-muted">${bucket.start}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "basil" | "tomato" }) {
  return (
    <div className="px-1 py-2">
      <p className={`text-[15px] font-bold ${tone === "basil" ? "text-basil" : tone === "tomato" ? "text-tomato" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[9px] text-muted">{label}</p>
    </div>
  );
}
