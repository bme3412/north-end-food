export const CATEGORY_ICONS: Record<string, string> = {
  pizza: "🍕",
  seafood: "🐟",
  pasta: "🍝",
  dessert: "🍰",
  desserts: "🍰",
  bakery: "🥐",
  antipasti: "🫒",
  sandwich: "🥪",
  steak: "🥩",
  meat: "🍖",
};

export const DEFAULT_CATEGORY_ICON = "🍴";

// Categories worth a dedicated icon/badge -- ones that say something
// distinctive about a kitchen's food. Deliberately excludes categories that
// are either too generic to differentiate a restaurant (salad, sides -- most
// menus have them, they don't say much) or redundant with a neighborhood
// that's already Italian by default (italian_american). Still fully
// filterable in "More filters"; just not surfaced as a top-level badge.
export const FEATURED_CATEGORIES = [
  "pizza",
  "seafood",
  "pasta",
  "dessert",
  "desserts",
  "antipasti",
  "bakery",
  "sandwich",
  "steak",
  "meat",
];
