from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.hours import compute_open_status, format_hours_summary
from app.models import CanonicalDish, Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot, MenuSource, Restaurant
from app.queries import (
    DishCategoryMedians,
    dish_and_category_medians,
    dish_match_clause,
    ingredient_match_clause,
    item_with_source_query,
    latest_snapshot_ids,
    sibling_dishes,
)
from app.ranking import balanced_secondary_score, fuzzy_token_clause, relevance_expressions
from app.schemas import MenuItemList, MenuItemOut
from app.schemas.menu import PlaceMatch, SimilarDishesOut, SimilarDishOut
from app.search import parse_query

router = APIRouter(prefix="/menu-items", tags=["menu-items"])


def _split(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip().lower() for part in value.split(",") if part.strip()]


def _to_out(
    item: MenuItem,
    snapshot: MenuSnapshot,
    source: MenuSource,
    restaurant: Restaurant,
    medians: DishCategoryMedians,
    at_day: int | None = None,
    at_time: str | None = None,
    at_until: str | None = None,
) -> MenuItemOut:
    median = medians.median_for(canonical_dish=item.canonical_dish, canonical_category=item.canonical_category)
    pct_vs_median: float | None = None
    if median and item.price is not None and not item.market_price:
        pct_vs_median = float((item.price / median - 1) * 100)

    place_stats = restaurant.place_stats

    return MenuItemOut(
        menu_item_id=item.menu_item_id,
        restaurant_id=item.restaurant_id,
        restaurant_name=restaurant.name,
        restaurant_slug=restaurant.slug,
        raw_name=item.raw_name,
        raw_description=item.raw_description,
        raw_price_text=item.raw_price_text,
        price=item.price,
        currency=item.currency,
        menu_section=item.menu_section,
        canonical_category=item.canonical_category,
        canonical_dish=item.canonical_dish,
        protein=item.protein,
        pasta_type=item.pasta_type,
        sauce=item.sauce,
        preparation=item.preparation,
        ingredients=item.ingredients,
        dietary_tags=item.dietary_tags,
        portion=item.portion,
        size=item.size,
        seasonal=item.seasonal,
        market_price=item.market_price,
        available=item.available,
        normalization_confidence=item.normalization_confidence,
        north_end_median_price=median,
        pct_vs_median=pct_vs_median,
        open_now=compute_open_status(restaurant.hours, at_day, at_time, at_until),
        hours_summary=format_hours_summary(restaurant.hours),
        rating=place_stats.rating if place_stats else None,
        review_count=place_stats.review_count if place_stats else None,
        price_level=place_stats.price_level if place_stats else None,
        takeout=place_stats.takeout if place_stats else None,
        dine_in=place_stats.dine_in if place_stats else None,
        delivery=place_stats.delivery if place_stats else None,
        menu_snapshot_id=item.menu_snapshot_id,
        retrieved_at=snapshot.retrieved_at,
        source_url=source.source_url,
        source_badge="OFFICIAL MENU",
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        establishment_type=restaurant.establishment_type,
        primary_cuisine=restaurant.primary_cuisine,
        address=restaurant.address,
        photo_url=restaurant.photo_url,
    )


def _token_clause(token: str):
    like = f"%{token}%"
    return or_(
        fuzzy_token_clause(token),
        MenuItem.canonical_dish.ilike(like),
        MenuItem.canonical_category.ilike(like),
        MenuItem.pasta_type.ilike(like),
        MenuItem.sauce.ilike(like),
        Restaurant.name.ilike(like),
        func.array_to_string(MenuItem.protein, " ").ilike(like),
        func.array_to_string(MenuItem.dietary_tags, " ").ilike(like),
        ingredient_match_clause(token),
        dish_match_clause(token),
    )


def _apply_filters(
    stmt: Select,
    *,
    q: str | None,
    category: str | None,
    subcategory: str | None,
    canonical_dish: str | None,
    protein: str | None,
    protein_mode: str,
    ingredient: str | None,
    ingredient_mode: str,
    dietary: str | None,
    restaurant_id: str | None,
    min_price: Decimal | None,
    max_price: Decimal | None,
    priced_only: bool,
    parsed_tokens: list[str],
    parsed_min: Decimal | None,
    parsed_max: Decimal | None,
    parsed_dietary: tuple[str, ...],
) -> Select:
    for token in parsed_tokens:
        stmt = stmt.where(_token_clause(token))

    categories = _split(category)
    if categories:
        stmt = stmt.where(MenuItem.canonical_category.in_(categories))

    subcategories = _split(subcategory)
    if subcategories:
        stmt = stmt.where(
            MenuItem.canonical_dish.in_(
                select(CanonicalDish.canonical_dish_id).where(CanonicalDish.subcategory.in_(subcategories))
            )
        )

    if canonical_dish:
        stmt = stmt.where(MenuItem.canonical_dish == canonical_dish.upper())

    proteins = _split(protein)
    if proteins:
        if protein_mode == "all":
            for value in proteins:
                stmt = stmt.where(MenuItem.protein.contains([value]))
        else:
            stmt = stmt.where(MenuItem.protein.overlap(proteins))

    ingredient_terms = _split(ingredient)
    if ingredient_terms:
        clauses = [ingredient_match_clause(term) for term in ingredient_terms]
        if ingredient_mode == "all":
            for clause in clauses:
                stmt = stmt.where(clause)
        else:
            stmt = stmt.where(or_(*clauses))

    diet_tags = list(dict.fromkeys(_split(dietary) + list(parsed_dietary)))
    for tag in diet_tags:
        stmt = stmt.where(MenuItem.dietary_tags.contains([tag]))

    if restaurant_id:
        stmt = stmt.where(MenuItem.restaurant_id == restaurant_id)

    low = min_price if min_price is not None else parsed_min
    high = max_price if max_price is not None else parsed_max
    if low is not None:
        stmt = stmt.where(MenuItem.price >= low)
    if high is not None:
        stmt = stmt.where(MenuItem.price <= high)
    if priced_only:
        stmt = stmt.where(MenuItem.price.is_not(None), MenuItem.market_price.is_(False))
    return stmt


def _places(items: list[MenuItemOut]) -> list[PlaceMatch]:
    grouped: dict[str, list[MenuItemOut]] = defaultdict(list)
    for item in items:
        grouped[item.restaurant_id].append(item)
    places: list[PlaceMatch] = []
    for restaurant_id, group in grouped.items():
        first = group[0]
        priced = [item.price for item in group if item.price is not None]
        # Cheapest item drives both `sample_name` and the vs-median badge --
        # same item, so the two never point at different dishes.
        cheapest = min(group, key=lambda item: (item.price is None, item.price or 0))
        places.append(
            PlaceMatch(
                restaurant_id=restaurant_id,
                name=first.restaurant_name,
                address=first.address or "",
                latitude=first.latitude,
                longitude=first.longitude,
                establishment_type=first.establishment_type or "",
                primary_cuisine=first.primary_cuisine,
                match_count=len(group),
                lowest_price=min(priced) if priced else None,
                lowest_price_pct_vs_median=cheapest.pct_vs_median,
                sample_name=cheapest.raw_name,
                photo_url=first.photo_url,
                open_now=first.open_now,
                hours_summary=first.hours_summary,
                rating=first.rating,
                review_count=first.review_count,
                price_level=first.price_level,
                takeout=first.takeout,
                dine_in=first.dine_in,
                delivery=first.delivery,
            )
        )
    return places


@router.get("/meta")
def filter_meta(db: Session = Depends(get_db)) -> dict:
    latest = latest_snapshot_ids(db).subquery()
    rows = db.execute(
        select(MenuItem).where(MenuItem.menu_snapshot_id.in_(select(latest)))
    ).scalars()
    categories: set[str] = set()
    proteins: set[str] = set()
    dietary: set[str] = set()
    prices: list[Decimal] = []
    for item in rows:
        if item.canonical_category:
            categories.add(item.canonical_category)
        for value in item.protein or []:
            proteins.add(value)
        for value in item.dietary_tags or []:
            dietary.add(value)
        if item.price is not None:
            prices.append(item.price)
    ingredients = db.scalars(
        select(Ingredient.canonical_name)
        .join(MenuItemIngredient, MenuItemIngredient.ingredient_id == Ingredient.ingredient_id)
        .join(MenuItem, MenuItem.menu_item_id == MenuItemIngredient.menu_item_id)
        .where(MenuItem.menu_snapshot_id.in_(select(latest)))
        .distinct()
    ).all()
    ingredient_categories = db.scalars(
        select(Ingredient.ingredient_category)
        .join(MenuItemIngredient, MenuItemIngredient.ingredient_id == Ingredient.ingredient_id)
        .join(MenuItem, MenuItem.menu_item_id == MenuItemIngredient.menu_item_id)
        .where(MenuItem.menu_snapshot_id.in_(select(latest)), Ingredient.ingredient_category.is_not(None))
        .distinct()
    ).all()
    subcategories = db.scalars(
        select(CanonicalDish.subcategory)
        .join(MenuItem, MenuItem.canonical_dish == CanonicalDish.canonical_dish_id)
        .where(MenuItem.menu_snapshot_id.in_(select(latest)), CanonicalDish.subcategory.is_not(None))
        .distinct()
    ).all()
    return {
        "categories": sorted(categories),
        "subcategories": sorted(subcategories),
        "proteins": sorted(proteins),
        "dietary": sorted(dietary),
        "ingredients": sorted(ingredients),
        "ingredient_categories": sorted(ingredient_categories),
        "min_price": float(min(prices)) if prices else None,
        "max_price": float(max(prices)) if prices else None,
    }


@router.get("/similar-dishes", response_model=SimilarDishesOut)
def similar_dishes(
    canonical_dish: str = Query(..., description="Canonical dish ID to find category-mates for, e.g. CALAMARI"),
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
) -> SimilarDishesOut:
    siblings = sibling_dishes(db, canonical_dish.upper(), limit=limit)
    return SimilarDishesOut(
        dishes=[
            SimilarDishOut(
                canonical_dish=sibling.canonical_dish_id,
                canonical_name=sibling.canonical_name,
                restaurant_count=sibling.restaurant_count,
                median_price=sibling.median_price,
            )
            for sibling in siblings
        ]
    )


@router.get("", response_model=MenuItemList)
def list_menu_items(
    q: str | None = Query(None, description="Free text. Tokens are AND'd. Understands 'under $30'."),
    category: str | None = Query(None, description="Comma-separated canonical categories"),
    subcategory: str | None = Query(None, description="Comma-separated canonical dish subcategories (e.g. 'stuffed', 'parm')"),
    canonical_dish: str | None = None,
    protein: str | None = Query(None, description="Comma-separated proteins"),
    protein_mode: str = Query("any", description="any = overlap, all = must include every protein"),
    ingredient: str | None = Query(None, description="Comma-separated ingredients, matched against canonical names/aliases"),
    ingredient_mode: str = Query("any", description="any = contains at least one, all = must contain every ingredient"),
    dietary: str | None = Query(None, description="Comma-separated dietary tags"),
    restaurant_id: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    priced_only: bool = False,
    open_now: bool | None = Query(None, description="If true, only items at restaurants open right now (America/New_York)"),
    service_mode: str | None = Query(
        None,
        pattern=r"^(dine_in|takeout)$",
        description="'dine_in' or 'takeout' -- excludes only restaurants Google has explicitly confirmed do NOT offer that mode; restaurants with no data yet (null) are kept, not excluded.",
    ),
    at_day: int | None = Query(None, ge=0, le=6, description="Preview day, 0=Mon..6=Sun, instead of today. Pairs with at_time."),
    at_time: str | None = Query(None, pattern=r"^\d{2}:\d{2}$", description="Preview time 'HH:MM' (24h, America/New_York), instead of right now. Pairs with at_day."),
    at_until: str | None = Query(None, pattern=r"^\d{2}:\d{2}$", description="Optional end of a preview range 'HH:MM' -- requires being open for the whole [at_time, at_until) window, not just at_time."),
    sort: str = Query(
        "relevance",
        description="relevance (default; ranked by text match when q is set, else price) | price | name",
    ),
    db: Session = Depends(get_db),
) -> MenuItemList:
    parsed = parse_query(q)
    medians = dish_and_category_medians(db)
    stmt = item_with_source_query(db)
    stmt = _apply_filters(
        stmt,
        q=q,
        category=category,
        subcategory=subcategory,
        canonical_dish=canonical_dish,
        protein=protein,
        protein_mode=protein_mode,
        ingredient=ingredient,
        ingredient_mode=ingredient_mode,
        dietary=dietary,
        restaurant_id=restaurant_id,
        min_price=min_price,
        max_price=max_price,
        priced_only=priced_only,
        parsed_tokens=parsed.tokens,
        parsed_min=parsed.min_price,
        parsed_max=parsed.max_price,
        parsed_dietary=parsed.dietary,
    )
    intent_ranked = sort == "relevance" and bool(parsed.tokens)
    if sort == "name":
        stmt = stmt.order_by(MenuItem.raw_name)
    elif sort == "price":
        stmt = stmt.order_by(MenuItem.price.nulls_last(), MenuItem.raw_name)
    elif intent_ranked:
        intent_tier, match_quality = relevance_expressions(parsed.tokens)
        stmt = stmt.add_columns(
            intent_tier.label("intent_tier"),
            match_quality.label("match_quality"),
        ).order_by(
            intent_tier,
            match_quality.desc(),
            MenuItem.raw_name,
            MenuItem.menu_item_id,
        )
    else:
        stmt = stmt.order_by(MenuItem.price.nulls_last(), MenuItem.raw_name)
    rows = db.execute(stmt).all()

    ranked_items: list[tuple[MenuItemOut, int, float]] = []
    if intent_ranked:
        for item, snapshot, source, restaurant, intent_tier, match_quality in rows:
            ranked_items.append(
                (
                    _to_out(
                        item,
                        snapshot,
                        source,
                        restaurant,
                        medians,
                        at_day=at_day,
                        at_time=at_time,
                        at_until=at_until,
                    ),
                    int(intent_tier),
                    float(match_quality or 0),
                )
            )
        items = [record[0] for record in ranked_items]
    else:
        items = [
            _to_out(item, snapshot, source, restaurant, medians, at_day=at_day, at_time=at_time, at_until=at_until)
            for item, snapshot, source, restaurant in rows
        ]

    def include_item(item: MenuItemOut) -> bool:
        if open_now is not None and item.open_now != open_now:
            return False
        if service_mode is not None:
            # Unknown service-mode data is retained; only a confirmed false
            # excludes a restaurant.
            flag = "takeout" if service_mode == "takeout" else "dine_in"
            if getattr(item, flag) is False:
                return False
        return True

    if intent_ranked:
        ranked_items = [record for record in ranked_items if include_item(record[0])]

        def rank_key(record: tuple[MenuItemOut, int, float]):
            item, intent_tier, match_quality = record
            secondary = balanced_secondary_score(
                available=item.available,
                open_now=item.open_now,
                match_quality=match_quality,
                rating=item.rating,
                review_count=item.review_count,
                pct_vs_median=item.pct_vs_median,
                latitude=item.latitude,
                longitude=item.longitude,
            )
            return (
                intent_tier,
                -secondary,
                item.raw_name.lower(),
                item.restaurant_name.lower(),
                item.menu_item_id,
            )

        ranked_items.sort(key=rank_key)
        items = [record[0] for record in ranked_items]
    else:
        items = [item for item in items if include_item(item)]

    return MenuItemList(
        total=len(items),
        items=items,
        places=_places(items),
        parsed_tokens=parsed.tokens,
    )


@router.get("/{menu_item_id}", response_model=MenuItemOut)
def get_menu_item(menu_item_id: str, db: Session = Depends(get_db)) -> MenuItemOut:
    latest = latest_snapshot_ids(db).subquery()
    row = db.execute(
        select(MenuItem, MenuSnapshot, MenuSource, Restaurant)
        .join(MenuSnapshot, MenuItem.menu_snapshot_id == MenuSnapshot.menu_snapshot_id)
        .join(MenuSource, MenuSnapshot.menu_source_id == MenuSource.menu_source_id)
        .join(Restaurant, MenuItem.restaurant_id == Restaurant.restaurant_id)
        .where(MenuItem.menu_item_id == menu_item_id, MenuItem.menu_snapshot_id.in_(select(latest)))
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item, snapshot, source, restaurant = row
    return _to_out(item, snapshot, source, restaurant, dish_and_category_medians(db))
