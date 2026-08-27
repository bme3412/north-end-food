export type PriceBucket = { start: number; count: number };

// Fixed $5 buckets -- matches the granularity of typical North End dish
// pricing (see seed_data.py's price spread) without needing a
// data-dependent bucket-width calculation. Shared by PriceDistributionPanel
// (the visual bars) and dishInsights.ts (the "most dishes are $X-$Y"
// sentence) so the two never disagree about which range is "most common".
export const BUCKET_SIZE = 5;

export function buildPriceHistogram(prices: number[], bucketSize: number = BUCKET_SIZE): PriceBucket[] {
  if (prices.length === 0) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const bucketStart = Math.floor(min / bucketSize) * bucketSize;
  const bucketCount = Math.floor((max - bucketStart) / bucketSize) + 1;
  const buckets: PriceBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    start: bucketStart + index * bucketSize,
    count: 0,
  }));
  for (const price of prices) {
    const index = Math.min(buckets.length - 1, Math.floor((price - bucketStart) / bucketSize));
    buckets[index].count += 1;
  }
  return buckets;
}

/** The contiguous run of buckets tied for the highest count, as a
 * {low, high} price span for a sentence like "most dishes are $20-$30". */
export function densestBucketSpan(buckets: PriceBucket[]): { low: number; high: number } | null {
  if (buckets.length === 0) return null;
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count));
  if (maxCount === 0) return null;
  const peakIndexes = buckets.map((bucket, index) => (bucket.count === maxCount ? index : -1)).filter((i) => i >= 0);
  const first = buckets[peakIndexes[0]];
  const last = buckets[peakIndexes[peakIndexes.length - 1]];
  return { low: first.start, high: last.start + BUCKET_SIZE };
}
