import Link from "next/link";

import { DishVisual } from "@/components/DishVisual";
import { SaveButton } from "@/components/SaveButton";
import { formatDollars, formatItemPctVsMedian, formatPrice, prettyCategory } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

const LOW_CONFIDENCE_THRESHOLD = 0.7;

function isLowConfidence(confidence: string | null): boolean {
  if (confidence == null) return false;
  const value = Number(confidence);
  return Number.isFinite(value) && value < LOW_CONFIDENCE_THRESHOLD;
}

export function ItemCard({
  item,
  onOpen,
  compact = false,
}: {
  item: MenuItem;
  onOpen?: (item: MenuItem) => void;
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border border-line bg-card shadow-[0_1px_3px_rgba(23,27,32,0.04)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <DishVisual
          category={item.canonical_category}
          name={item.raw_name}
          className={`${compact ? "size-12" : "size-16"} rounded-lg`}
        />
        <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpen?.(item)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <h2
            className={`font-bold leading-snug text-ink ${
              compact ? "text-sm" : "text-lg"
            }`}
          >
            {item.raw_name}
          </h2>
          <p className={`shrink-0 font-bold text-primary ${compact ? "text-sm" : "pt-1 text-base"}`}>
            {formatPrice(item)}
          </p>
        </div>
        {item.raw_description ? (
          <p
            className={`mt-1 text-muted ${compact ? "line-clamp-1 text-xs" : "line-clamp-2 text-[0.95rem] leading-snug"}`}
          >
            {item.raw_description}
          </p>
        ) : null}
      </button>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-2 text-xs" : "mt-3 text-sm"}`}>
        <Link
          href={`/restaurants/${item.restaurant_id}`}
          className="rounded-full bg-linen-2 px-2.5 py-1 text-ink"
        >
          {item.restaurant_name}
        </Link>
        {item.canonical_category ? (
          <span className="text-muted capitalize">{prettyCategory(item.canonical_category)}</span>
        ) : null}
        {item.pizza_serving ? (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">
            {item.pizza_serving === "slice"
              ? "Slice"
              : item.pizza_serving === "whole"
                ? "Whole pizza"
                : "Pizza size unclear"}
          </span>
        ) : null}
        {item.open_now != null ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide ${
              item.open_now ? "bg-basil-soft text-basil" : "bg-tomato-soft text-tomato"
            }`}
            title={item.hours_summary ?? undefined}
          >
            {item.open_now ? "Open now" : "Closed"}
          </span>
        ) : null}
        {isLowConfidence(item.normalization_confidence) ? (
          <span
            className="rounded-full bg-linen-2 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted"
            title="Extraction confidence is low for this item — details may be imprecise"
          >
            Unverified
          </span>
        ) : null}
        <SaveButton kind="dish" item={item} compact />
      </div>
      {item.north_end_median_price != null && item.pct_vs_median != null ? (
        <p className={`mt-1.5 text-xs text-muted ${compact ? "" : "text-[0.8rem]"}`}>
          North End median: {formatDollars(item.north_end_median_price)}
          {" · "}
          <span className={item.pct_vs_median <= 0 ? "text-basil" : "text-tomato"}>
            {formatItemPctVsMedian(item.pct_vs_median)}
          </span>
        </p>
      ) : null}
        </div>
      </div>
    </article>
  );
}
