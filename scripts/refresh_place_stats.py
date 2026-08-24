#!/usr/bin/env python3
"""Refresh Google Places stats (rating, price level, hours) for seeded restaurants.

Requires a `restaurant_external_ids` row with provider="google_places" per
restaurant (not seeded yet — add one before running). No-ops with a clear
message if GOOGLE_MAPS_API_KEY isn't set.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.integrations import places  # noqa: E402
from app.models import Restaurant, RestaurantExternalId, RestaurantPlaceStats  # noqa: E402


def main() -> None:
    if not places.is_configured():
        print("GOOGLE_MAPS_API_KEY not set — nothing to refresh.")
        return

    db = SessionLocal()
    try:
        rows = db.execute(
            select(Restaurant, RestaurantExternalId)
            .join(RestaurantExternalId, RestaurantExternalId.restaurant_id == Restaurant.restaurant_id)
            .where(RestaurantExternalId.provider == "google_places")
        ).all()

        if not rows:
            print("No restaurants have a google_places external id yet — nothing to refresh.")
            return

        now = datetime.now(timezone.utc)
        for restaurant, external_id in rows:
            details = places.fetch_place_details(external_id.external_id)
            if details is None:
                print(f"skip {restaurant.restaurant_id}: no result from Places")
                continue

            stats = db.get(RestaurantPlaceStats, restaurant.restaurant_id)
            if stats is None:
                stats = RestaurantPlaceStats(restaurant_id=restaurant.restaurant_id)
                db.add(stats)

            stats.rating = details.rating
            stats.review_count = details.review_count
            stats.price_level = details.price_level
            stats.open_now = details.open_now
            stats.hours_summary = details.hours_summary
            stats.retrieved_at = now
            print(f"updated {restaurant.restaurant_id}: rating={details.rating} reviews={details.review_count}")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
