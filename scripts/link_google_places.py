#!/usr/bin/env python3
"""Resolve each seeded restaurant's Google Places id via Text Search (New)
and store it as a restaurant_external_ids row (provider="google_places").

Run this before scripts/refresh_place_stats.py — that script needs the
external id this one writes. No-ops with a clear message if
GOOGLE_MAPS_API_KEY isn't set. Safe to rerun: skips restaurants that
already have a google_places external id.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.integrations import places  # noqa: E402
from app.models import Restaurant, RestaurantExternalId  # noqa: E402


def main() -> None:
    if not places.is_configured():
        print("GOOGLE_MAPS_API_KEY not set — nothing to link.")
        return

    db = SessionLocal()
    try:
        already_linked = {
            row.restaurant_id
            for row in db.scalars(select(RestaurantExternalId).where(RestaurantExternalId.provider == "google_places"))
        }

        restaurants = list(db.scalars(select(Restaurant).where(Restaurant.active.is_(True))))
        now = datetime.now(timezone.utc)

        for restaurant in restaurants:
            if restaurant.restaurant_id in already_linked:
                print(f"skip {restaurant.restaurant_id}: already linked")
                continue

            place_id = places.find_place_id(restaurant.name, restaurant.address)
            if place_id is None:
                print(f"no match for {restaurant.restaurant_id} ({restaurant.name})")
                continue

            db.add(
                RestaurantExternalId(
                    restaurant_id=restaurant.restaurant_id,
                    provider="google_places",
                    external_id=place_id,
                    verified_at=now,
                )
            )
            print(f"linked {restaurant.restaurant_id} -> {place_id}")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
