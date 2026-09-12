import { formatDollars } from "@/lib/format";
import { rangePositionPercent } from "@/lib/priceScale";

export function PriceRangeStrip({
  minPrice,
  maxPrice,
  medianPrice,
}: {
  minPrice: number | null;
  maxPrice: number | null;
  medianPrice: number | null;
}) {
  if (minPrice == null || maxPrice == null) return null;
  const tick = rangePositionPercent(medianPrice, minPrice, maxPrice);
  const label =
    medianPrice != null
      ? `Prices ${formatDollars(minPrice)} to ${formatDollars(maxPrice)}, North End median ${formatDollars(medianPrice)}`
      : `Prices ${formatDollars(minPrice)} to ${formatDollars(maxPrice)}`;

  return (
    <div className="mt-2" title={label}>
      <span className="sr-only">{label}</span>
      <div className="relative h-1 rounded-full bg-linen-2" aria-hidden="true">
        {tick != null ? (
          <span
            className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-ink"
            style={{ left: `${tick}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
