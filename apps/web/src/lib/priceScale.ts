/** Bar length on a $0 → group-max axis. Unpriced / invalid values have no bar. */
export function priceBarPercent(price: number | null | undefined, max: number | null | undefined): number | null {
  if (price == null || max == null || !Number.isFinite(price) || !Number.isFinite(max) || max <= 0 || price < 0) {
    return null;
  }
  return Math.min(100, (price / max) * 100);
}

/** Median (or any dollar mark) on the same $0 → max axis as the bars. */
export function priceAxisPercent(value: number | null | undefined, max: number | null | undefined): number | null {
  return priceBarPercent(value, max);
}

const AXIS_STEPS = [15, 20, 30, 40, 50, 60, 80, 100, 150, 200];

/** Percent above/below a median price. */
export function pctVsMedian(price: number | null | undefined, median: number | null | undefined): number | null {
  if (price == null || median == null || !Number.isFinite(price) || !Number.isFinite(median) || median <= 0) {
    return null;
  }
  return ((price - median) / median) * 100;
}

/** Symmetric axis that fits the largest swing vs median. */
export function divergingAxisMax(pcts: number[]): number {
  const peak = Math.max(10, ...pcts.map((pct) => Math.abs(pct)));
  return AXIS_STEPS.find((step) => step >= peak) ?? Math.ceil(peak / 10) * 10;
}

/** Half-track width (0–50) for a diverging bar. */
export function divergingBarWidthPercent(pct: number, axisMax: number): number {
  if (!Number.isFinite(pct) || !Number.isFinite(axisMax) || axisMax <= 0) return 0;
  return Math.min(50, (Math.abs(pct) / axisMax) * 50);
}

export function joinRestaurantNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Position on a min → max strip. Equal min/max sits in the middle. */
export function rangePositionPercent(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): number | null {
  if (value == null || min == null || max == null) return null;
  if (![value, min, max].every(Number.isFinite)) return null;
  if (max < min) return null;
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}
