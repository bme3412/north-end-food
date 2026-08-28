export type SearchView =
  | { kind: "category"; category: string }
  | { kind: "dish"; groupKey: string }
  | { kind: "list" };

export function pickSearchView({
  q,
  selectedPlaceId,
  pizzaServing,
  parsedPizzaServing,
  resolvedCategory,
  resolvedDish,
  groupKeys,
  compareGroupKey,
}: {
  q: string;
  selectedPlaceId: string | null;
  pizzaServing: string;
  parsedPizzaServing: string | null;
  resolvedCategory: string | null;
  resolvedDish: string | null;
  groupKeys: string[];
  compareGroupKey: string | null;
}): SearchView {
  const query = q.trim();
  if (!query || selectedPlaceId) return { kind: "list" };

  const servingInPlay = Boolean(pizzaServing || parsedPizzaServing);
  if (!servingInPlay && resolvedCategory) {
    return { kind: "category", category: resolvedCategory };
  }

  if (resolvedDish) {
    const exactDishGroups = groupKeys.filter(
      (key) => key === resolvedDish || key.startsWith(`${resolvedDish}::`),
    );
    if (exactDishGroups.length === 1) {
      return { kind: "dish", groupKey: exactDishGroups[0] };
    }
  }

  if (compareGroupKey && groupKeys.includes(compareGroupKey)) {
    return { kind: "dish", groupKey: compareGroupKey };
  }

  return { kind: "list" };
}
