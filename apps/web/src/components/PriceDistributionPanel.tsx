import { BarChart3, Check, Lightbulb, TrendingDown, Utensils } from "lucide-react";

import { buildInsights } from "@/lib/dishInsights";
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
  const insights = buildInsights(group);

  return (
    <section className="rounded-xl border border-line bg-card p-3 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
      <div className="flex items-center gap-2">
        <Utensils className="size-4 text-muted" aria-hidden="true" />
        <h2 className="text-[12px] font-bold text-ink">
          Dish price comparison
        </h2>
      </div>
      <p className="ml-6 text-[9px] text-muted">How North End {group.displayName.toLowerCase()} prices compare</p>

      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat label="Median price" value={medianPrice != null ? formatDollars(medianPrice) : "—"} />
        <Stat label="Lowest price" value={group.minPrice != null ? formatDollars(group.minPrice) : "—"} tone="basil" />
        <Stat label="Highest price" value={group.maxPrice != null ? formatDollars(group.maxPrice) : "—"} tone="tomato" />
        {savePct != null && savePct > 0 ? (
          <p className="col-span-3 flex items-center gap-2 rounded-lg border border-basil/10 bg-basil-soft px-3 py-2 text-[9px] text-ink sm:col-span-2">
            <TrendingDown className="size-5 shrink-0 text-basil" aria-hidden="true" />
            <span>You can save <strong>{savePct}%</strong> by choosing the lowest-priced option.</span>
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {buckets.length ? (
          <div className="rounded-lg border border-line p-2.5">
            <p className="flex items-center gap-1.5 text-[9px] font-semibold text-ink">
              <BarChart3 className="size-3 text-muted" aria-hidden="true" /> Price distribution
            </p>
            <div className="mt-1.5 flex items-end gap-1.5">
              <div className="flex h-14 flex-col justify-between text-right text-[7px] text-muted">
                <span>{maxCount}</span>
                <span>{Math.round(maxCount / 2)}</span>
                <span>0</span>
              </div>
              <div className="flex flex-1 items-end gap-1 border-l border-b border-line pl-1">
                {buckets.map((bucket) => {
                  const heightPct = maxCount ? Math.max(6, Math.round((bucket.count / maxCount) * 100)) : 0;
                  return (
                    <div key={bucket.start} className="flex flex-1 flex-col items-center">
                      <div className="flex h-12 w-full items-end">
                        <div
                          className="w-full rounded-t-sm bg-sky-400/70"
                          style={{ height: `${heightPct}%`, opacity: bucket.count === 0 ? 0.15 : 1 }}
                          title={`${formatDollars(bucket.start)}: ${bucket.count} dish${bucket.count === 1 ? "" : "es"}`}
                        />
                      </div>
                      <span className="mt-1 text-[7px] text-muted">${bucket.start}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {insights.length ? (
          <div className="rounded-lg bg-info-soft p-2.5">
            <p className="flex items-center gap-1.5 text-[9px] font-semibold text-info">
              <Lightbulb className="size-3 fill-current" aria-hidden="true" /> Insights
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {insights.slice(0, 5).map((insight) => (
                <li key={insight.id} className="flex items-start gap-1.5 text-[8px] leading-3 text-ink">
                  <Check className="mt-0.5 size-2.5 shrink-0" aria-hidden="true" />
                  <span>{insight.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "basil" | "tomato" }) {
  return (
    <div className="px-1 py-1.5">
      <p className={`text-[14px] font-bold ${tone === "basil" ? "text-basil" : tone === "tomato" ? "text-tomato" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-[8px] text-muted">{label}</p>
    </div>
  );
}
