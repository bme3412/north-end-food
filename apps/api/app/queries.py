import statistics
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import CanonicalDish, Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot, MenuSource, Restaurant


def dish_match_clause(term: str) -> ColumnElement[bool]:
    """True for a MenuItem whose canonical dish's display name or alias
    list contains `term`. Closes a real gap: searching "four cheese pizza"
    previously returned nothing for the White Pizza dish, because neither
    its raw_name text nor its ID (WHITE_PIZZA) contains "four" or "cheese"
    -- only its alias list does, and aliases were never queried. This is
    the same pattern as ingredient_match_clause below, one level up the
    ontology (Dish rather than Ingredient).
    """
    like = f"%{term.strip().lower()}%"
    matching_dish_ids = select(CanonicalDish.canonical_dish_id).where(
        or_(
            CanonicalDish.canonical_name.ilike(like),
            func.array_to_string(CanonicalDish.aliases, " ").ilike(like),
        )
    )
    return MenuItem.canonical_dish.in_(matching_dish_ids)


def ingredient_match_clause(term: str) -> ColumnElement[bool]:
    """True for a MenuItem linked to any canonical Ingredient whose name or
    aliases contain `term`. Matches across spelling variants sharing one
    canonical row ("buffalo" matches an item recorded as "bufala
    mozzarella"), which a raw-array ILIKE on the item's own text never
    could — the alias lives on the Ingredient, not on that item.
    """
    like = f"%{term.strip().lower()}%"
    matching_ingredient_ids = select(Ingredient.ingredient_id).where(
        or_(
            Ingredient.canonical_name.ilike(like),
            func.array_to_string(Ingredient.aliases, " ").ilike(like),
        )
    )
    return MenuItem.menu_item_id.in_(
        select(MenuItemIngredient.menu_item_id).where(MenuItemIngredient.ingredient_id.in_(matching_ingredient_ids))
    )


def latest_snapshot_ids(db: Session) -> Select[tuple[str]]:
    ranked = (
        select(
            MenuSnapshot.menu_snapshot_id,
            func.row_number()
            .over(
                partition_by=MenuSnapshot.restaurant_id,
                order_by=MenuSnapshot.retrieved_at.desc(),
            )
            .label("rn"),
        )
        .where(MenuSnapshot.extraction_status.in_(("complete", "manual_seed")))
        .subquery()
    )
    return select(ranked.c.menu_snapshot_id).where(ranked.c.rn == 1)


def item_with_source_query(db: Session) -> Select:
    latest = latest_snapshot_ids(db).subquery()
    return (
        select(MenuItem, MenuSnapshot, MenuSource, Restaurant)
        .join(MenuSnapshot, MenuItem.menu_snapshot_id == MenuSnapshot.menu_snapshot_id)
        .join(MenuSource, MenuSnapshot.menu_source_id == MenuSource.menu_source_id)
        .join(Restaurant, MenuItem.restaurant_id == Restaurant.restaurant_id)
        .where(MenuItem.menu_snapshot_id.in_(select(latest)))
        .options(selectinload(Restaurant.place_stats))
    )


@dataclass(frozen=True)
class CategoryMedian:
    category: str
    restaurant_median: Decimal | None
    north_end_median: Decimal | None


@dataclass(frozen=True)
class PriceProfile:
    restaurant_median: Decimal | None
    north_end_median: Decimal | None
    pct_vs_median: float | None
    categories: list[CategoryMedian]


def _median(values: list[Decimal]) -> Decimal | None:
    if not values:
        return None
    return statistics.median(values)


@dataclass(frozen=True)
class DishCategoryMedians:
    """Stable North End price benchmarks, independent of any search filter —
    used to show '$21 · 7% below median' on individual result cards, per
    intent-build-plan.md's own Phase 0 example. Keyed by canonical_dish
    first (most precise comparison), falling back to canonical_category for
    items without a dish match.
    """

    by_dish: dict[str, Decimal]
    by_category: dict[str, Decimal]

    def median_for(self, *, canonical_dish: str | None, canonical_category: str | None) -> Decimal | None:
        if canonical_dish and canonical_dish in self.by_dish:
            return self.by_dish[canonical_dish]
        if canonical_category:
            return self.by_category.get(canonical_category)
        return None


def dish_and_category_medians(db: Session) -> DishCategoryMedians:
    latest = latest_snapshot_ids(db).subquery()
    rows = db.execute(
        select(MenuItem.canonical_dish, MenuItem.canonical_category, MenuItem.price).where(
            MenuItem.menu_snapshot_id.in_(select(latest)),
            MenuItem.price.is_not(None),
            MenuItem.market_price.is_(False),
        )
    ).all()

    by_dish_prices: dict[str, list[Decimal]] = {}
    by_category_prices: dict[str, list[Decimal]] = {}
    for dish, category, price in rows:
        if dish:
            by_dish_prices.setdefault(dish, []).append(price)
        if category:
            by_category_prices.setdefault(category, []).append(price)

    return DishCategoryMedians(
        by_dish={key: _median(prices) for key, prices in by_dish_prices.items()},
        by_category={key: _median(prices) for key, prices in by_category_prices.items()},
    )


@dataclass(frozen=True)
class SiblingDish:
    canonical_dish_id: str
    canonical_name: str
    restaurant_count: int
    median_price: Decimal | None


def sibling_dishes(db: Session, canonical_dish: str, *, limit: int = 8) -> list[SiblingDish]:
    """Other dishes in the same broad category as `canonical_dish` (e.g.
    Calamari -> Octopus, Cioppino, Lobster Roll, Oysters, all `category:
    seafood`) -- powers the "similar dishes you might like" carousel.
    Grouped by `category`, not the narrower `subcategory`: several
    subcategories in seed_data.py have exactly one dish each, which would
    make the carousel empty for those far more often than category-level
    grouping does. Same aggregation shape as dish_and_category_medians()
    above (latest snapshot, priced non-market-price rows, Python-side
    statistics.median) rather than a second, divergent way of computing a
    median -- see that function's docstring.
    """
    dish = db.get(CanonicalDish, canonical_dish)
    if dish is None or not dish.category:
        return []

    latest = latest_snapshot_ids(db).subquery()
    rows = db.execute(
        select(MenuItem.canonical_dish, MenuItem.restaurant_id, MenuItem.price, CanonicalDish.canonical_name)
        .join(CanonicalDish, MenuItem.canonical_dish == CanonicalDish.canonical_dish_id)
        .where(
            CanonicalDish.category == dish.category,
            MenuItem.canonical_dish != canonical_dish,
            MenuItem.menu_snapshot_id.in_(select(latest)),
            MenuItem.price.is_not(None),
            MenuItem.market_price.is_(False),
        )
    ).all()

    by_sibling: dict[str, dict] = {}
    for sibling_id, restaurant_id, price, canonical_name in rows:
        entry = by_sibling.setdefault(
            sibling_id, {"canonical_name": canonical_name, "restaurant_ids": set(), "prices": []}
        )
        entry["restaurant_ids"].add(restaurant_id)
        entry["prices"].append(price)

    siblings = [
        SiblingDish(
            canonical_dish_id=sibling_id,
            canonical_name=entry["canonical_name"],
            restaurant_count=len(entry["restaurant_ids"]),
            median_price=_median(entry["prices"]),
        )
        for sibling_id, entry in by_sibling.items()
    ]
    siblings.sort(key=lambda sibling: (-sibling.restaurant_count, sibling.canonical_name))
    return siblings[:limit]


def price_profile(db: Session, restaurant_id: str, *, top_categories: int = 3) -> PriceProfile:
    """Median item price for a restaurant vs. the North End as a whole, priced items only."""
    latest = latest_snapshot_ids(db).subquery()
    rows = db.execute(
        select(MenuItem.restaurant_id, MenuItem.canonical_category, MenuItem.price).where(
            MenuItem.menu_snapshot_id.in_(select(latest)),
            MenuItem.price.is_not(None),
            MenuItem.market_price.is_(False),
        )
    ).all()

    restaurant_prices = [price for rid, _cat, price in rows if rid == restaurant_id]
    north_end_prices = [price for _rid, _cat, price in rows]

    restaurant_median = _median(restaurant_prices)
    north_end_median = _median(north_end_prices)

    pct_vs_median: float | None = None
    if restaurant_median is not None and north_end_median:
        pct_vs_median = float((restaurant_median / north_end_median - 1) * 100)

    restaurant_categories: dict[str, list[Decimal]] = {}
    north_end_by_category: dict[str, list[Decimal]] = {}
    for rid, category, price in rows:
        if not category:
            continue
        north_end_by_category.setdefault(category, []).append(price)
        if rid == restaurant_id:
            restaurant_categories.setdefault(category, []).append(price)

    ranked = sorted(restaurant_categories.items(), key=lambda pair: len(pair[1]), reverse=True)
    categories = [
        CategoryMedian(
            category=category,
            restaurant_median=_median(prices),
            north_end_median=_median(north_end_by_category.get(category, [])),
        )
        for category, prices in ranked[:top_categories]
    ]

    return PriceProfile(
        restaurant_median=restaurant_median,
        north_end_median=north_end_median,
        pct_vs_median=pct_vs_median,
        categories=categories,
    )
