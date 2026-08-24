import Link from "next/link";

import { formatPrice, prettyCategory } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

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
      className={`rounded-2xl border border-line bg-card shadow-[0_1px_0_rgba(42,35,28,0.04)] ${
        compact ? "p-3" : "rounded-3xl p-4"
      }`}
    >
      <button type="button" onClick={() => onOpen?.(item)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <h2
            className={`font-[family-name:var(--font-fraunces)] font-medium leading-snug text-ink ${
              compact ? "text-base" : "text-[1.35rem]"
            }`}
          >
            {item.raw_name}
          </h2>
          <p className={`shrink-0 font-bold text-tomato ${compact ? "text-sm" : "pt-1 text-base"}`}>
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
      </div>
    </article>
  );
}
