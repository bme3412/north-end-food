export type MedalTone = "gold" | "silver" | "bronze" | "default";

/** Rank 1-3 get a medal tone (matches the ranked list's badge color and the
 * map's ranked-pin color so the two stay visually tied to the same order).
 * Tomato is deliberately not used here -- MapView already reserves tomato
 * for the selected/hovered pin state. */
export function medalTone(rank: number): MedalTone {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "default";
}

export const MEDAL_TONE_CLASSES: Record<MedalTone, string> = {
  gold: "bg-gold text-linen",
  silver: "bg-silver text-linen",
  bronze: "bg-bronze text-linen",
  default: "bg-linen-2 text-ink",
};
