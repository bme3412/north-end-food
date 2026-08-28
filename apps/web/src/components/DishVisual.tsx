import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from "@/lib/categoryIcons";

const TONES: Record<string, string> = {
  pasta: "from-amber-100 to-orange-200 text-amber-900",
  pizza: "from-red-100 to-orange-200 text-red-900",
  seafood: "from-sky-100 to-cyan-200 text-sky-900",
  antipasti: "from-emerald-100 to-lime-200 text-emerald-900",
  dessert: "from-pink-100 to-rose-200 text-rose-900",
  desserts: "from-pink-100 to-rose-200 text-rose-900",
  bakery: "from-yellow-100 to-amber-200 text-amber-900",
  sandwich: "from-lime-100 to-yellow-200 text-lime-900",
  steak: "from-stone-200 to-red-200 text-stone-900",
  meat: "from-stone-200 to-red-200 text-stone-900",
};

export function DishVisual({
  category,
  name,
  className = "",
  showLabel = false,
}: {
  category: string | null;
  name: string;
  className?: string;
  showLabel?: boolean;
}) {
  const key = category?.toLowerCase() ?? "";
  const icon = CATEGORY_ICONS[key] ?? DEFAULT_CATEGORY_ICON;
  const tone = TONES[key] ?? "from-slate-100 to-slate-200 text-slate-700";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ${tone} ${className}`}
      role="img"
      aria-label={`${name} category illustration`}
    >
      <span className="select-none text-[length:2em] drop-shadow-sm" aria-hidden="true">
        {icon}
      </span>
      {showLabel ? (
        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-white/75 px-1 py-0.5 text-center text-[8px] font-bold uppercase tracking-wide backdrop-blur-sm">
          {category?.replaceAll("_", " ") ?? "Dish"}
        </span>
      ) : null}
    </div>
  );
}
