import re
import statistics
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import CanonicalDish, Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot, MenuSource, Restaurant
from app.servings import classify_pizza_serving


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

    by_dish: dict[tuple[str, str | None], Decimal]
    by_category: dict[tuple[str, str | None], Decimal]

    def median_for(
        self,
        *,
        canonical_dish: str | None,
        canonical_category: str | None,
        pizza_serving: str | None,
    ) -> Decimal | None:
        if canonical_dish and (canonical_dish, pizza_serving) in self.by_dish:
            return self.by_dish[canonical_dish, pizza_serving]
        if canonical_category:
            return self.by_category.get((canonical_category, pizza_serving))
        return None


def dish_and_category_medians(db: Session) -> DishCategoryMedians:
    latest = latest_snapshot_ids(db).subquery()
    rows = db.execute(
        select(
            MenuItem.canonical_dish,
            MenuItem.canonical_category,
            MenuItem.price,
            MenuItem.raw_name,
            MenuItem.menu_section,
            MenuItem.portion,
            MenuItem.size,
        ).where(
            MenuItem.menu_snapshot_id.in_(select(latest)),
            MenuItem.price.is_not(None),
            MenuItem.market_price.is_(False),
        )
    ).all()

    by_dish_prices: dict[tuple[str, str | None], list[Decimal]] = {}
    by_category_prices: dict[tuple[str, str | None], list[Decimal]] = {}
    for dish, category, price, raw_name, menu_section, portion, size in rows:
        pizza_serving = classify_pizza_serving(
            canonical_category=category,
            raw_name=raw_name,
            menu_section=menu_section,
            portion=portion,
            size=size,
        )
        if dish:
            by_dish_prices.setdefault((dish, pizza_serving), []).append(price)
        if category:
            by_category_prices.setdefault((category, pizza_serving), []).append(price)

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


@dataclass(frozen=True)
class CategoryDish:
    canonical_dish_id: str
    canonical_name: str
    pizza_serving: str | None
    restaurant_count: int
    min_price: Decimal | None
    max_price: Decimal | None
    median_price: Decimal | None


@dataclass(frozen=True)
class CategorySummary:
    category: str
    total_items: int
    restaurant_count: int
    dishes: list[CategoryDish]
    uncategorized_count: int


def category_summary(db: Session, category: str, *, limit: int = 20) -> CategorySummary | None:
    """One row per canonical_dish within `category`, ranked by how many
    restaurants serve it -- powers the category-browse page ("Pasta -- 47
    dishes across 22 restaurants", one card per dish type). Mirrors
    sibling_dishes()'s aggregation shape (latest snapshot, Python-side
    statistics.median) but pivots on a whole category rather than one seed
    dish's siblings.

    `total_items`/`restaurant_count`/`uncategorized_count` count every
    item in the category regardless of price (matching groupItemsByDish's
    restaurantCount convention on the frontend); per-dish price stats only
    consider priced, non-market-price items, matching the convention
    dish_and_category_medians() and sibling_dishes() already use.
    """
    latest = latest_snapshot_ids(db).subquery()
    rows = db.execute(
        select(
            MenuItem.canonical_dish,
            MenuItem.restaurant_id,
            MenuItem.price,
            MenuItem.market_price,
            CanonicalDish.canonical_name,
            MenuItem.raw_name,
            MenuItem.menu_section,
            MenuItem.portion,
            MenuItem.size,
        )
        .outerjoin(CanonicalDish, MenuItem.canonical_dish == CanonicalDish.canonical_dish_id)
        .where(
            MenuItem.canonical_category == category,
            MenuItem.menu_snapshot_id.in_(select(latest)),
        )
    ).all()
    if not rows:
        return None

    all_restaurants: set[str] = set()
    uncategorized_count = 0
    by_dish: dict[tuple[str, str | None], dict] = {}
    for dish_id, restaurant_id, price, market_price, canonical_name, raw_name, menu_section, portion, size in rows:
        all_restaurants.add(restaurant_id)
        if not dish_id:
            uncategorized_count += 1
            continue
        pizza_serving = classify_pizza_serving(
            canonical_category=category,
            raw_name=raw_name,
            menu_section=menu_section,
            portion=portion,
            size=size,
        )
        entry = by_dish.setdefault(
            (dish_id, pizza_serving),
            {"canonical_name": canonical_name, "restaurant_ids": set(), "prices": []},
        )
        entry["restaurant_ids"].add(restaurant_id)
        if price is not None and not market_price:
            entry["prices"].append(price)

    dishes = [
        CategoryDish(
            canonical_dish_id=dish_id,
            canonical_name=entry["canonical_name"],
            pizza_serving=pizza_serving,
            restaurant_count=len(entry["restaurant_ids"]),
            min_price=min(entry["prices"]) if entry["prices"] else None,
            max_price=max(entry["prices"]) if entry["prices"] else None,
            median_price=_median(entry["prices"]),
        )
        for (dish_id, pizza_serving), entry in by_dish.items()
    ]
    dishes.sort(key=lambda dish: (-dish.restaurant_count, dish.canonical_name))

    return CategorySummary(
        category=category,
        total_items=len(rows),
        restaurant_count=len(all_restaurants),
        dishes=dishes[:limit],
        uncategorized_count=uncategorized_count,
    )


SUGGEST_LIMIT = 5
SUGGEST_MIN_CHARS = 2
SUGGEST_SIMILARITY = 0.25


@dataclass(frozen=True)
class SearchIntent:
    category: str | None = None
    dish: str | None = None
    restaurant_id: str | None = None
    restaurant_name: str | None = None


@dataclass(frozen=True)
class RestaurantSuggestion:
    restaurant_id: str
    name: str
    photo_url: str | None
    primary_cuisine: str | None


@dataclass(frozen=True)
class DishSuggestion:
    canonical_dish: str
    canonical_name: str
    category: str
    restaurant_count: int


@dataclass(frozen=True)
class SearchSuggestions:
    restaurants: list[RestaurantSuggestion]
    dishes: list[DishSuggestion]


def _normalize_search_text(raw: str) -> str:
    normalized = re.sub(r"[^a-z0-9 ]", " ", raw.strip().lower())
    return re.sub(r"\s+", " ", normalized).strip()


def _unique_restaurant_match(db: Session, normalized: str) -> tuple[str | None, str | None]:
    matches = [
        (restaurant_id, name)
        for restaurant_id, name in db.execute(
            select(Restaurant.restaurant_id, Restaurant.name).where(Restaurant.active.is_(True))
        ).all()
        if _normalize_search_text(name) == normalized
    ]
    if len(matches) != 1:
        return None, None
    return matches[0]


def suggest_search(db: Session, raw_query: str | None, *, limit: int = SUGGEST_LIMIT) -> SearchSuggestions:
    """Prefix/substring suggestions for the search combobox -- restaurants
    and canonical dishes only, not a full ranked menu-item search.
    """
    if not raw_query or len(raw_query.strip()) < SUGGEST_MIN_CHARS:
        return SearchSuggestions(restaurants=[], dishes=[])

    q = raw_query.strip()
    like = f"%{q}%"

    restaurant_rows = db.scalars(
        select(Restaurant)
        .where(
            Restaurant.active.is_(True),
            or_(
                Restaurant.name.ilike(like),
                func.similarity(Restaurant.name, q) > SUGGEST_SIMILARITY,
            ),
        )
        .order_by(func.similarity(Restaurant.name, q).desc(), Restaurant.name)
        .limit(limit)
    ).all()
    restaurants = [
        RestaurantSuggestion(
            restaurant_id=row.restaurant_id,
            name=row.name,
            photo_url=row.photo_url,
            primary_cuisine=row.primary_cuisine,
        )
        for row in restaurant_rows
    ]

    latest = latest_snapshot_ids(db).subquery()
    dish_counts = (
        select(
            MenuItem.canonical_dish,
            func.count(func.distinct(MenuItem.restaurant_id)).label("restaurant_count"),
        )
        .where(MenuItem.menu_snapshot_id.in_(select(latest)), MenuItem.canonical_dish.is_not(None))
        .group_by(MenuItem.canonical_dish)
        .subquery()
    )
    dish_rows = db.execute(
        select(CanonicalDish, func.coalesce(dish_counts.c.restaurant_count, 0))
        .outerjoin(dish_counts, dish_counts.c.canonical_dish == CanonicalDish.canonical_dish_id)
        .where(
            or_(
                CanonicalDish.canonical_name.ilike(like),
                func.array_to_string(CanonicalDish.aliases, " ").ilike(like),
                func.similarity(CanonicalDish.canonical_name, q) > SUGGEST_SIMILARITY,
            )
        )
        .order_by(
            func.similarity(CanonicalDish.canonical_name, q).desc(),
            CanonicalDish.canonical_name,
        )
        .limit(limit)
    ).all()
    dishes = [
        DishSuggestion(
            canonical_dish=dish.canonical_dish_id,
            canonical_name=dish.canonical_name,
            category=dish.category,
            restaurant_count=int(count),
        )
        for dish, count in dish_rows
    ]
    return SearchSuggestions(restaurants=restaurants, dishes=dishes)


def resolve_search_intent(db: Session, raw_query: str | None) -> SearchIntent:
    """Classify a free-text query as naming a whole food category ("pasta"),
    one specific dish ("carbonara"), a unique restaurant, or none of those.

    This is deliberately a whole-query exact match against real
    CanonicalDish/category/restaurant names, not a fuzzy per-token heuristic:
    a query that merely *contains* a category word (e.g. "pasta under $25")
    should keep behaving like keyword search, not jump to a category browse
    page. Only "pasta" itself, or "carbonara", or "Neptune Oyster", resolve.

    A dish match wins over a restaurant or category match when both apply
    (rare) since it's the more specific interpretation. Restaurant wins over
    category. Broader keyword searches stay on the grouped list -- see
    SearchWorkspace.tsx / pickSearchView().
    """
    if not raw_query or not raw_query.strip():
        return SearchIntent()
    normalized = _normalize_search_text(raw_query)
    if not normalized:
        return SearchIntent()

    for dish_id, canonical_name, aliases in db.execute(
        select(CanonicalDish.canonical_dish_id, CanonicalDish.canonical_name, CanonicalDish.aliases)
    ).all():
        candidates = {canonical_name.strip().lower()} | {alias.strip().lower() for alias in (aliases or [])}
        if normalized in candidates:
            return SearchIntent(dish=dish_id)

    restaurant_id, restaurant_name = _unique_restaurant_match(db, normalized)
    if restaurant_id:
        return SearchIntent(restaurant_id=restaurant_id, restaurant_name=restaurant_name)

    categories = {
        row[0]
        for row in db.execute(
            select(MenuItem.canonical_category).distinct().where(MenuItem.canonical_category.is_not(None))
        ).all()
    }
    # Categories are stored as snake_case IDs ("italian_american"); a typed
    # query is space-separated ("italian american"). Also try a naive
    # singular (strip a trailing "s": "pastas" -> "pasta") since a plural
    # is a natural way to type a category name.
    candidates = {normalized.replace(" ", "_")}
    if normalized.endswith("s"):
        candidates.add(normalized[:-1].replace(" ", "_"))
    for candidate in candidates:
        if candidate in categories:
            return SearchIntent(category=candidate)

    return SearchIntent()


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
