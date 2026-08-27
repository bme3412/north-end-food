import Link from "next/link";
import { PersonStanding, ShoppingBag, Star, Utensils } from "lucide-react";

import { Badge } from "@/components/Badge";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { formatPctBadge, formatPrice, formatWalkTimeEstimate } from "@/lib/format";
import { MEDAL_TONE_CLASSES, medalTone } from "@/lib/rank";
import type { MenuItem } from "@/lib/types";

export function RankedDishRow({
  item,
  rank,
  qualityBadge,
  distanceMiles,
  onHover,
}: {
  item: MenuItem;
  rank: number;
  qualityBadge: string | null;
  distanceMiles: number | null;
  onHover?: (restaurantId: string | null) => void;
}) {
  const pctBadge = formatPctBadge(item.pct_vs_median);
  const distanceLabel = formatWalkTimeEstimate(distanceMiles);

  return (
    <Link
      href={`/restaurants/${item.restaurant_id}`}
      onMouseEnter={() => onHover?.(item.restaurant_id)}
      onMouseLeave={() => onHover?.(null)}
      className="group flex min-h-[72px] items-center gap-2.5 rounded-xl border border-line bg-card px-2.5 py-2 shadow-[0_1px_3px_rgba(23,27,32,0.04)] transition-colors hover:border-primary/30 hover:bg-primary-soft/20"
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${MEDAL_TONE_CLASSES[medalTone(rank)]}`}
      >
        {rank}
      </span>

      <RestaurantPhoto src={item.photo_url} alt={item.restaurant_name} className="h-[52px] w-[52px] shrink-0 rounded-lg object-cover" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold leading-4 text-ink">
          {item.restaurant_name}
        </p>
        {item.raw_description ? (
          <p className="line-clamp-1 text-[9px] leading-3.5 text-muted">{item.raw_description}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {qualityBadge ? <Badge tone="quality">{qualityBadge}</Badge> : null}
          {item.open_now != null ? (
            <Badge tone={item.open_now ? "basil" : "tomato"} title={item.hours_summary ?? undefined}>
              {item.open_now ? "Open now" : "Closed"}
            </Badge>
          ) : null}
          {item.dine_in && item.takeout ? (
            <Badge tone="muted" icon={<Utensils className="size-2.5" />}>Dine-in · Takeout</Badge>
          ) : item.dine_in ? (
            <Badge tone="muted" icon={<Utensils className="size-2.5" />}>Dine-in</Badge>
          ) : item.takeout ? (
            <Badge tone="muted" icon={<ShoppingBag className="size-2.5" />}>Takeout</Badge>
          ) : null}
        </div>

        {item.rating != null ? (
          <p className="mt-1 flex items-center gap-1 text-[9px] text-muted">
            <Star className="size-2.5 fill-amber-400 text-amber-400" aria-hidden="true" /> {item.rating}
            {item.review_count != null ? ` (${item.review_count})` : ""}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[14px] font-bold leading-4 text-ink">{formatPrice(item)}</p>
        {pctBadge ? (
          <div className="mt-1">
            <Badge tone={pctBadge.tone} size="xs" icon={pctBadge.icon}>
              {pctBadge.label}
            </Badge>
          </div>
        ) : null}
        {distanceLabel ? (
          <p className="mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-[9px] text-muted" title="Estimated from straight-line distance">
            <PersonStanding className="size-3" aria-hidden="true" /> {distanceLabel}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
