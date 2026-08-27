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
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">🍴</span>
        <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-medium text-ink">
          Dish price comparison
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted">How North End {group.displayName.toLowerCase()} prices compare</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Median price" value={medianPrice != null ? formatDollars(medianPrice) : "—"} />
        <Stat label="Lowest price" value={group.minPrice != null ? formatDollars(group.minPrice) : "—"} tone="basil" />
        <Stat label="Highest price" value={group.maxPrice != null ? formatDollars(group.maxPrice) : "—"} tone="tomato" />
      </div>

      {savePct != null && savePct > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-basil-soft px-3 py-2 text-sm text-basil">
          <span aria-hidden="true">📶</span>
          You can save {savePct}% by choosing the lowest-priced option.
        </p>
      ) : null}

      {buckets.length ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Price distribution</p>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex h-28 flex-col justify-between text-right text-[0.65rem] text-muted">
              <span>{maxCount}</span>
              <span>{Math.round(maxCount / 2)}</span>
              <span>0</span>
            </div>
            <div className="flex flex-1 items-end gap-1.5 border-l border-line pl-2">
              {buckets.map((bucket) => {
                const heightPct = maxCount ? Math.max(6, Math.round((bucket.count / maxCount) * 100)) : 0;
                return (
                  <div key={bucket.start} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full items-end">
                      <div
                        className="w-full rounded-t-md"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor:
                            bucket.count === 0
                              ? "var(--linen-2)"
                              : `color-mix(in srgb, var(--tomato) ${20 + (bucket.count / maxCount) * 60}%, var(--card))`,
                        }}
                        title={`${formatDollars(bucket.start)}: ${bucket.count} dish${bucket.count === 1 ? "" : "es"}`}
                      />
                    </div>
                    <span className="text-[0.65rem] text-muted">${bucket.start}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {insights.length ? (
        <div className="mt-5 rounded-2xl bg-info-soft p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-info">Insights</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {insights.map((insight) => (
              <li key={insight.id} className="flex items-start gap-2 text-sm text-ink">
                <span aria-hidden="true" className="mt-0.5 text-info">
                  ✓
                </span>
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "basil" | "tomato" }) {
  return (
    <div className="rounded-xl bg-linen px-3 py-2.5 text-center">
      <p className={`text-lg font-bold ${tone === "basil" ? "text-basil" : tone === "tomato" ? "text-tomato" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.7rem] text-muted">{label}</p>
    </div>
  );
}
