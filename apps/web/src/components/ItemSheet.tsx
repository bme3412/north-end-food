"use client";

import { useEffect } from "react";
import Link from "next/link";

import { formatDollars, formatItemPctVsMedian, formatPrice, prettyCategory, prettyDish } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export function ItemSheet({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    document.body.classList.add("sheet-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("sheet-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close dish details"
        className="absolute inset-0 bg-ink/35"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(23,27,32,0.18)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-linen-2" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold leading-tight">
            {item.raw_name}
          </h2>
          <p className="shrink-0 text-xl font-bold text-tomato">{formatPrice(item)}</p>
        </div>
        {item.north_end_median_price != null && item.pct_vs_median != null ? (
          <p className="mt-1 text-sm text-muted">
            North End median: {formatDollars(item.north_end_median_price)}
            {" · "}
            <span className={item.pct_vs_median <= 0 ? "text-basil" : "text-tomato"}>
              {formatItemPctVsMedian(item.pct_vs_median)}
            </span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={`/restaurants/${item.restaurant_id}`}
            className="text-primary underline decoration-primary/30 underline-offset-4"
          >
            {item.restaurant_name}
          </Link>
          {item.open_now != null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide ${
                item.open_now ? "bg-basil-soft text-basil" : "bg-tomato-soft text-tomato"
              }`}
            >
              {item.open_now ? "Open now" : "Closed"}
            </span>
          ) : null}
        </div>
        {item.raw_description ? (
          <p className="mt-4 text-[1.05rem] leading-relaxed text-ink">{item.raw_description}</p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Fact label="On the menu as" value={item.raw_name} />
          <Fact label="Compared as" value={prettyDish(item.canonical_dish) || "Not mapped yet"} />
          <Fact label="Section" value={item.menu_section ?? "—"} />
          <Fact label="Category" value={prettyCategory(item.canonical_category) || "—"} />
          <Fact label="Protein" value={item.protein?.join(", ") ?? "—"} />
          <Fact label="Pasta" value={item.pasta_type ?? "—"} />
          <Fact label="Sauce" value={item.sauce ?? "—"} />
          <Fact label="Source" value={item.source_badge} />
          <Fact label="Hours" value={item.hours_summary ?? "—"} />
          <Fact
            label="Extraction confidence"
            value={item.normalization_confidence != null ? `${Math.round(Number(item.normalization_confidence) * 100)}%` : "—"}
          />
        </dl>
        {item.ingredients?.length ? (
          <p className="mt-4 text-sm text-muted">
            <span className="text-ink">Ingredients. </span>
            {item.ingredients.join(", ")}
          </p>
        ) : null}
        <div className="mt-6 flex gap-3">
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
            className="flex-1 rounded-lg bg-primary px-4 py-3 text-center text-sm font-bold text-white"
            >
              Official menu
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-line px-4 py-3 text-sm font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-linen px-3 py-2.5">
      <dt className="text-[0.7rem] text-muted">{label}</dt>
      <dd className="mt-0.5 capitalize">{value}</dd>
    </div>
  );
}
