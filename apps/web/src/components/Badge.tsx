import type { ReactNode } from "react";

export type BadgeTone = "basil" | "tomato" | "ink" | "muted" | "info" | "quality";

const TONE_CLASSES: Record<BadgeTone, string> = {
  basil: "bg-basil-soft text-basil",
  tomato: "bg-tomato-soft text-tomato",
  ink: "bg-ink text-linen",
  muted: "bg-linen-2 text-muted",
  info: "bg-info-soft text-info",
  // "Best value" / "Great option" / "Top rated" -- the mockup's yellow
  // quality-callout pills, distinct from the solid gold/silver/bronze used
  // on the rank-medal circle itself (see lib/rank.ts's MEDAL_TONE_CLASSES,
  // applied directly where the medal circle renders, not through Badge).
  quality: "bg-gold-soft text-gold",
};

// The one shared pill primitive for this redesign -- quality badges (Best
// value/Top rated), open-now/dine-in/takeout tags, the price-vs-median
// badge, "Popular", and filter chips all render through this rather than
// each component repeating its own rounded-full/px/py/text-size Tailwind
// string. Deliberately narrow: just tone + size + optional icon, no
// variant explosion -- see plan notes on why a shared <Card> wasn't worth
// it at this scale but a Badge was.
export function Badge({
  tone = "muted",
  size = "sm",
  icon,
  children,
  title,
}: {
  tone?: BadgeTone;
  size?: "sm" | "xs";
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium ${TONE_CLASSES[tone]} ${
        size === "xs" ? "px-2 py-0.5 text-[0.7rem] uppercase tracking-wide" : "px-2.5 py-1 text-xs"
      }`}
    >
      {icon ? (
        <span aria-hidden="true" className="leading-none">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
