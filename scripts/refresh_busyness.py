#!/usr/bin/env python3
"""Refresh BestTime wait time + weekly popularity for seeded restaurants.

Keys venues by name + address (BestTime's Live Forecast endpoint). No-ops
with a clear message if BESTTIME_API_KEY isn't set.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.integrations import besttime  # noqa: E402
from app.models import Restaurant, RestaurantBusynessStats  # noqa: E402


def main() -> None:
    if not besttime.is_configured():
        print("BESTTIME_API_KEY not set — nothing to refresh.")
        return

    db = SessionLocal()
    try:
        restaurants = list(db.scalars(select(Restaurant).where(Restaurant.active.is_(True))))
        now = datetime.now(timezone.utc)

        for restaurant in restaurants:
            forecast = besttime.fetch_live_forecast(restaurant.name, restaurant.address)
            if forecast is None:
                print(f"skip {restaurant.restaurant_id}: no result from BestTime")
                continue

            stats = db.get(RestaurantBusynessStats, restaurant.restaurant_id)
            if stats is None:
                stats = RestaurantBusynessStats(restaurant_id=restaurant.restaurant_id)
                db.add(stats)

            stats.wait_minutes = forecast.wait_minutes
            stats.weekly_pattern = forecast.weekly_pattern
            stats.retrieved_at = now
            print(f"updated {restaurant.restaurant_id}: wait={forecast.wait_minutes}min")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
