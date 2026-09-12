from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingredients import record_menu_item_ingredients
from app.models import (
    CanonicalDish,
    Ingredient,
    MenuItem,
    MenuItemIngredient,
    MenuSnapshot,
    MenuSource,
    PriceObservation,
    Restaurant,
)
from app.pricing import record_price_observations
from app.seed_data import CANONICAL_DISHES, RESTAURANTS
from app.seed_wave2 import WAVE2_RESTAURANTS


def _stable_uuid(*parts: str) -> str:
    return str(uuid5(NAMESPACE_URL, "|".join(parts)))


def _hash_items(items: list[dict]) -> str:
    payload = json.dumps(items, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def add_restaurants(
    db: Session, rows: list[dict], *, skip_existing: bool = False, menu_only: bool = False
) -> dict[str, int]:
    """Create Restaurant + MenuSource + MenuSnapshot + MenuItem rows (plus
    derived ingredients/price observations) for each row in `rows`, using
    the same shape as RESTAURANTS entries in seed_data.py.

    With skip_existing=True, a row whose restaurant_id already exists is
    left untouched rather than raising a duplicate-key error -- this is
    what lets a data migration add new restaurants to an already-seeded
    database (dev or production) without needing seed(reset=True)'s full
    wipe-and-recreate, which would also blow away every other
    restaurant's menu history. See migration 015 for that use.

    With menu_only=True, an existing restaurant is reused and a new
    snapshot is written so a captured menu can replace the live catalog
    without deleting other venues.
    """
    now = datetime.now(timezone.utc)
    restaurant_count = 0
    item_count = 0

    for row in rows:
        existing = db.get(Restaurant, row["restaurant_id"])
        if skip_existing and existing is not None:
            continue

        sources = row["sources"]
        items = row["items"]
        extractor_model = row["extractor_model"]
        rest_payload = {k: v for k, v in row.items() if k not in {"sources", "items", "extractor_model"}}

        if menu_only and existing is not None:
            restaurant = existing
        else:
            restaurant = Restaurant(**rest_payload, last_verified_at=now)
            db.add(restaurant)
            db.flush()
            restaurant_count += 1

        source_row = sources[0]
        source_id = _stable_uuid(restaurant.restaurant_id, source_row["source_url"])
        source = db.get(MenuSource, source_id)
        if source is None:
            source = MenuSource(
                menu_source_id=source_id,
                restaurant_id=restaurant.restaurant_id,
                menu_type=source_row["menu_type"],
                source_url=source_row["source_url"],
                source_format=source_row["source_format"],
                active=True,
                last_checked_at=now,
            )
            db.add(source)
            db.flush()
        else:
            source.last_checked_at = now
            db.flush()

        snapshot_id = _stable_uuid(restaurant.restaurant_id, "snapshot", _hash_items(items))
        existing_snap = db.get(MenuSnapshot, snapshot_id)
        if existing_snap is not None:
            continue
        snapshot = MenuSnapshot(
            menu_snapshot_id=snapshot_id,
            restaurant_id=restaurant.restaurant_id,
            menu_source_id=source.menu_source_id,
            retrieved_at=now,
            content_hash=_hash_items(items),
            raw_content_location=None,
            extraction_status="manual_seed",
            extractor_model=extractor_model,
            schema_version="v1",
        )
        db.add(snapshot)
        db.flush()

        for item in items:
            db.add(
                MenuItem(
                    # Section + price disambiguate real menus where the same
                    # dish name recurs (lunch/dinner variants, size options,
                    # e.g. Panza's small/large Fried Calamari) -- raw_name
                    # alone isn't a unique key within a restaurant's items.
                    menu_item_id=_stable_uuid(
                        restaurant.restaurant_id,
                        snapshot.menu_snapshot_id,
                        item["raw_name"],
                        str(item.get("menu_section")),
                        str(item.get("raw_price_text")),
                    ),
                    menu_snapshot_id=snapshot.menu_snapshot_id,
                    restaurant_id=restaurant.restaurant_id,
                    **item,
                )
            )
            item_count += 1

        db.flush()
        record_price_observations(db, snapshot)
        record_menu_item_ingredients(db, snapshot)

    db.commit()
    return {"restaurants": restaurant_count, "items": item_count}


def refresh_restaurant_menus(db: Session, restaurant_ids: list[str] | None = None) -> dict[str, int]:
    """Write a new manual_seed snapshot for restaurants whose items changed
    in seed data, without wiping the rest of the catalog.
    """
    rows = RESTAURANTS + WAVE2_RESTAURANTS
    if restaurant_ids is not None:
        wanted = set(restaurant_ids)
        rows = [row for row in rows if row["restaurant_id"] in wanted]
    return add_restaurants(db, rows, skip_existing=False, menu_only=True)


def seed(db: Session, *, reset: bool = True) -> dict[str, int]:
    if reset:
        db.query(MenuItemIngredient).delete()
        db.query(Ingredient).delete()
        db.query(PriceObservation).delete()
        db.query(MenuItem).delete()
        db.query(MenuSnapshot).delete()
        db.query(MenuSource).delete()
        db.query(Restaurant).delete()
        db.query(CanonicalDish).delete()
        db.flush()

    for dish in CANONICAL_DISHES:
        db.merge(CanonicalDish(**dish))
    db.flush()

    stats = add_restaurants(db, RESTAURANTS + WAVE2_RESTAURANTS, skip_existing=not reset)
    return {**stats, "dishes": len(CANONICAL_DISHES)}


def main() -> None:
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        stats = seed(db)
        print(f"Seeded {stats['restaurants']} restaurants, {stats['items']} items, {stats['dishes']} canonical dishes.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
