import type { MenuItem } from "@/lib/types";

export function formatPrice(item: Pick<MenuItem, "market_price" | "price">): string {
  if (item.market_price) return "Market";
  if (item.price == null) return "Ask";
  return formatDollars(item.price);
}

export function formatDollars(value: string | number): string {
  const amount = Number(value);
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function formatPriceLevel(level: number | null | undefined): string {
  if (level == null) return "";
  return "$".repeat(Math.max(1, level));
}

export function formatBusynessPercent(percent: number | null | undefined): string {
  if (percent == null) return "";
  if (percent <= 15) return "Not busy";
  return `${percent}% busy right now`;
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPctVsMedian(pct: number | null | undefined): string | null {
  if (pct == null) return null;
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return "right at the North End median overall";
  const direction = pct < 0 ? "cheaper" : "pricier";
  return `${rounded}% ${direction} than the North End median overall`;
}

export function formatItemPctVsMedian(pct: number | null | undefined): string | null {
  if (pct == null) return null;
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return "At median";
  const direction = pct < 0 ? "below" : "above";
  return `${rounded}% ${direction} median`;
}

export type PctBadge = { label: string; tone: "basil" | "tomato" | "muted"; icon: string | null };

// Threshold wider than formatItemPctVsMedian's "At median" (rounds to 0)
// because a badge needs a stable "nothing meaningful to report" band, not
// just an exact tie -- a few restaurants a couple percent apart shouldn't
// each get their own green/red badge.
const TYPICAL_PRICE_THRESHOLD = 5;

export function formatPctBadge(pct: number | null | undefined): PctBadge | null {
  if (pct == null) return null;
  if (Math.abs(pct) <= TYPICAL_PRICE_THRESHOLD) return { label: "Typical price", tone: "muted", icon: null };
  const rounded = Math.round(Math.abs(pct));
  if (pct < 0) return { label: `${rounded}% below median`, tone: "basil", icon: "↓" };
  return { label: `${rounded}% above median`, tone: "tomato", icon: "↑" };
}

// Honest distance, not walk-time -- no routing/directions integration
// exists anywhere in this codebase, only straight-line haversine. Labeling
// it as a walk-time estimate would overstate what this actually measures.
export function formatDistanceMiles(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

export function prettyCategory(value: string | null | undefined): string {
  if (!value) return "";
  return value.replaceAll("_", " ");
}

export function prettyDish(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
