import Link from "next/link";

import { Badge } from "@/components/Badge";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { formatDistanceMiles, formatPctBadge, formatPrice } from "@/lib/format";
import { MEDAL_TONE_CLASSES, medalTone } from "@/lib/rank";
import type { MenuItem } from "@/lib/types";

export function RankedDishRow({
  item,
  rank,
  qualityBadge,
  distanceMiles,
}: {
  item: MenuItem;
  rank: number;
  qualityBadge: string | null;
  distanceMiles: number | null;
}) {
  const pctBadge = formatPctBadge(item.pct_vs_median);
  const distanceLabel = formatDistanceMiles(distanceMiles);

  return (
    <Link
      href={`/restaurants/${item.restaurant_id}`}
      className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(42,35,28,0.04)]"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${MEDAL_TONE_CLASSES[medalTone(rank)]}`}
      >
        {rank}
      </span>

      <RestaurantPhoto src={item.photo_url} alt={item.restaurant_name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />

      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-fraunces)] text-base font-medium leading-snug text-ink">
          {item.restaurant_name}
        </p>
        {item.raw_description ? (
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">{item.raw_description}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {qualityBadge ? <Badge tone="quality">{qualityBadge}</Badge> : null}
          {item.open_now != null ? (
            <Badge tone={item.open_now ? "basil" : "tomato"} title={item.hours_summary ?? undefined}>
              {item.open_now ? "Open now" : "Closed"}
            </Badge>
          ) : null}
          {item.dine_in && item.takeout ? (
            <Badge tone="muted">🍴 Dine-in · Takeout</Badge>
          ) : item.dine_in ? (
            <Badge tone="muted">🍴 Dine-in</Badge>
          ) : item.takeout ? (
            <Badge tone="muted">🥡 Takeout</Badge>
          ) : null}
        </div>

        {item.rating != null ? (
          <p className="mt-1.5 text-xs text-muted">
            ★ {item.rating}
            {item.review_count != null ? ` (${item.review_count})` : ""}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="font-bold text-tomato">{formatPrice(item)}</p>
        {pctBadge ? (
          <div className="mt-1">
            <Badge tone={pctBadge.tone} size="xs" icon={pctBadge.icon}>
              {pctBadge.label}
            </Badge>
          </div>
        ) : null}
        {distanceLabel ? (
          <p className="mt-1.5 text-xs text-muted">
            <span aria-hidden="true">🚶</span> {distanceLabel}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
