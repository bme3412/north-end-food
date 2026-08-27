import { formatDollars } from "@/lib/format";
import { buildPriceHistogram, densestBucketSpan } from "@/lib/histogram";
import type { DishGroup } from "@/lib/dishGroups";

export type Insight = { id: string; text: string };

// Every rule reads only fields already returned by GET /menu-items -- no
// rating-based rule exists here, by design, since Google Places data isn't
// linked for any restaurant yet (see plan notes). A rule that dropped out
// during implementation: "dish is X% pricier than the median category
// item" -- north_end_median_price is already the *dish*-level median
// whenever an item has a canonical_dish (queries.py's median_for() prefers
// dish over category), so there's no separate category median available
// here to compare against without a new backend field. Rather than fake
// that comparison, it's simply not one of the rules below.
export function buildInsights(group: DishGroup): Insight[] {
  const insights: Insight[] = [];
  const pricedItems = group.items.filter((item) => item.price != null);
  const prices = pricedItems.map((item) => Number(item.price));

  if (prices.length >= 3) {
    const span = densestBucketSpan(buildPriceHistogram(prices));
    if (span) {
      insights.push({
        id: "densest-range",
        text: `Most ${group.displayName} dishes are ${formatDollars(span.low)}–${formatDollars(span.high)}`,
      });
    }
  }

  const withPctVsMedian = group.items.filter(
    (item): item is typeof item & { pct_vs_median: number } => item.pct_vs_median != null,
  );
  if (withPctVsMedian.length) {
    const cheapest = withPctVsMedian.reduce((min, item) => (item.pct_vs_median < min.pct_vs_median ? item : min));
    if (cheapest.pct_vs_median <= -10) {
      insights.push({
        id: "below-median",
        text: `${cheapest.restaurant_name} is ${Math.round(Math.abs(cheapest.pct_vs_median))}% below the North End median`,
      });
    }
  }

  if (pricedItems.length >= 2) {
    const highest = pricedItems.reduce((max, item) => (Number(item.price) > Number(max.price) ? item : max));
    insights.push({
      id: "highest",
      text: `${highest.restaurant_name} is the highest at ${formatDollars(highest.price!)}`,
    });
  }

  const byRestaurant = new Map<string, boolean | null>();
  for (const item of group.items) {
    if (!byRestaurant.has(item.restaurant_id)) byRestaurant.set(item.restaurant_id, item.open_now);
  }
  const knownOpenStatuses = Array.from(byRestaurant.values()).filter((value): value is boolean => value != null);
  if (knownOpenStatuses.length) {
    const openCount = knownOpenStatuses.filter(Boolean).length;
    insights.push({
      id: "open-now",
      text: `${openCount} of ${knownOpenStatuses.length} restaurant${knownOpenStatuses.length === 1 ? "" : "s"} ${
        knownOpenStatuses.length === 1 ? "is" : "are"
      } open right now`,
    });
  }

  return insights;
}
