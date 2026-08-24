from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CanonicalDish, MenuItem, MenuSnapshot, MenuSource, PriceObservation, Restaurant
from app.pricing import record_price_observations
from app.seed_data import CANONICAL_DISHES, RESTAURANTS


def _stable_uuid(*parts: str) -> str:
    return str(uuid5(NAMESPACE_URL, "|".join(parts)))


def _hash_items(items: list[dict]) -> str:
    payload = json.dumps(items, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def seed(db: Session, *, reset: bool = True) -> dict[str, int]:
    if reset:
        db.query(PriceObservation).delete()
        db.query(MenuItem).delete()
        db.query(MenuSnapshot).delete()
        db.query(MenuSource).delete()
        db.query(Restaurant).delete()
        db.query(CanonicalDish).delete()
        db.flush()

    for dish in CANONICAL_DISHES:
        db.merge(CanonicalDish(**dish))

    now = datetime.now(timezone.utc)
    restaurant_count = 0
    item_count = 0

    for row in RESTAURANTS:
        sources = row["sources"]
        items = row["items"]
        extractor_model = row["extractor_model"]
        rest_payload = {k: v for k, v in row.items() if k not in {"sources", "items", "extractor_model"}}
        restaurant = Restaurant(**rest_payload, last_verified_at=now)
        db.add(restaurant)
        db.flush()
        restaurant_count += 1

        source_row = sources[0]
        source = MenuSource(
            menu_source_id=_stable_uuid(restaurant.restaurant_id, source_row["source_url"]),
            restaurant_id=restaurant.restaurant_id,
            menu_type=source_row["menu_type"],
            source_url=source_row["source_url"],
            source_format=source_row["source_format"],
            active=True,
            last_checked_at=now,
        )
        db.add(source)
        db.flush()

        snapshot = MenuSnapshot(
            menu_snapshot_id=_stable_uuid(restaurant.restaurant_id, "snapshot", _hash_items(items)),
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
                    menu_item_id=_stable_uuid(restaurant.restaurant_id, snapshot.menu_snapshot_id, item["raw_name"]),
                    menu_snapshot_id=snapshot.menu_snapshot_id,
                    restaurant_id=restaurant.restaurant_id,
                    **item,
                )
            )
            item_count += 1

        db.flush()
        record_price_observations(db, snapshot)

    db.commit()
    return {"restaurants": restaurant_count, "items": item_count, "dishes": len(CANONICAL_DISHES)}


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
