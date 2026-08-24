from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot

# Merges for raw variants confirmed, by inspecting the actual seeded corpus,
# to name the same ingredient — plural/singular pairs and spelling variants
# only. Deliberately NOT merged: named varieties of a base ingredient
# ("ipswich clams", "san marzano tomato") stay distinct from the generic
# form, since collapsing those would throw away real information the
# extraction captured. Grows as new variants are confirmed; anything not
# listed here canonicalizes to itself.
_ALIAS_MERGES = {
    "mushrooms": "mushroom",
    "onions": "onion",
    "roasted red peppers": "roasted red pepper",
    "fava beans": "fava bean",
    "clams": "clam",
    "bufala mozzarella": "buffalo mozzarella",
    "parmigiano": "parmesan",
}

_SLUG_RE = re.compile(r"[^A-Z0-9]+")


def _normalize(raw: str) -> str:
    return " ".join(raw.strip().lower().split())


def _canonical_form(raw: str) -> str:
    normalized = _normalize(raw)
    return _ALIAS_MERGES.get(normalized, normalized)


def _slug(canonical_form: str) -> str:
    return _SLUG_RE.sub("_", canonical_form.upper()).strip("_")


def _resolve_ingredient(db: Session, raw: str) -> Ingredient | None:
    normalized = _normalize(raw)
    if not normalized:
        return None

    canonical_form = _canonical_form(raw)
    ingredient_id = _slug(canonical_form)
    if not ingredient_id:
        return None

    ingredient = db.get(Ingredient, ingredient_id)
    if ingredient is None:
        ingredient = Ingredient(
            ingredient_id=ingredient_id,
            canonical_name=canonical_form.title(),
            aliases=[normalized],
        )
        db.add(ingredient)
        db.flush()
    elif normalized not in (ingredient.aliases or []):
        ingredient.aliases = [*(ingredient.aliases or []), normalized]

    return ingredient


def record_menu_item_ingredients(db: Session, snapshot: MenuSnapshot) -> int:
    """Resolve each priced-or-not item's raw `ingredients` array in `snapshot`
    into canonical Ingredient rows and CONTAINS join rows.

    Idempotent — skips (menu_item, ingredient) pairs that already exist, so
    it's safe to call from seed/backfill scripts and from the review-approval
    path without double-writing. Only call once a snapshot is trusted
    (extraction_status "complete" or "manual_seed"), matching
    record_price_observations — an unreviewed extraction shouldn't be able
    to add ingredients to the live search graph.
    """
    items = list(
        db.scalars(
            select(MenuItem).where(
                MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id,
                MenuItem.ingredients.is_not(None),
            )
        )
    )
    if not items:
        return 0

    existing_pairs = set(
        db.execute(
            select(MenuItemIngredient.menu_item_id, MenuItemIngredient.ingredient_id).where(
                MenuItemIngredient.menu_item_id.in_([item.menu_item_id for item in items])
            )
        ).all()
    )

    written = 0
    for item in items:
        if not item.ingredients:
            continue
        seen_for_item: set[str] = set()
        for raw in item.ingredients:
            ingredient = _resolve_ingredient(db, raw)
            if ingredient is None or ingredient.ingredient_id in seen_for_item:
                continue
            seen_for_item.add(ingredient.ingredient_id)
            pair = (item.menu_item_id, ingredient.ingredient_id)
            if pair in existing_pairs:
                continue
            db.add(MenuItemIngredient(menu_item_id=item.menu_item_id, ingredient_id=ingredient.ingredient_id))
            existing_pairs.add(pair)
            written += 1
    return written
