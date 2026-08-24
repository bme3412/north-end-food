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
