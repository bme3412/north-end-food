from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CanonicalDish, Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot, MenuSource, Restaurant
from app.queries import (
    DishCategoryMedians,
    dish_and_category_medians,
    dish_match_clause,
    ingredient_match_clause,
    item_with_source_query,
    latest_snapshot_ids,
)
from app.ranking import fuzzy_token_clause, relevance_order_by
from app.schemas import MenuItemList, MenuItemOut
from app.schemas.menu import PlaceMatch
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
) -> MenuItemOut:
    median = medians.median_for(canonical_dish=item.canonical_dish, canonical_category=item.canonical_category)
    pct_vs_median: float | None = None
    if median and item.price is not None and not item.market_price:
        pct_vs_median = float((item.price / median - 1) * 100)

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
        menu_snapshot_id=item.menu_snapshot_id,
        retrieved_at=snapshot.retrieved_at,
        source_url=source.source_url,
        source_badge="OFFICIAL MENU",
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        establishment_type=restaurant.establishment_type,
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
        places.append(
            PlaceMatch(
                restaurant_id=restaurant_id,
                name=first.restaurant_name,
                address=first.address or "",
                latitude=first.latitude,
                longitude=first.longitude,
                establishment_type=first.establishment_type or "",
                match_count=len(group),
                lowest_price=min(priced) if priced else None,
                sample_name=min(group, key=lambda item: (item.price is None, item.price or 0)).raw_name,
                photo_url=first.photo_url,
            )
        )
    places.sort(key=lambda place: (-place.match_count, place.name))
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
    if sort == "name":
        stmt = stmt.order_by(MenuItem.raw_name)
    elif sort == "price":
        stmt = stmt.order_by(MenuItem.price.nulls_last(), MenuItem.raw_name)
    elif parsed.tokens:
        stmt = stmt.order_by(relevance_order_by(parsed.tokens, medians), MenuItem.price.nulls_last())
    else:
        stmt = stmt.order_by(MenuItem.price.nulls_last(), MenuItem.raw_name)
    rows = db.execute(stmt).all()
    items = [_to_out(item, snapshot, source, restaurant, medians) for item, snapshot, source, restaurant in rows]
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
