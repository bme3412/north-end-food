#!/usr/bin/env python3
"""Refresh BestTime crowd data for seeded restaurants: current busyness
(Live Forecast, hourly-fresh) and the typical weekly pattern (New Forecast,
a heavier call refreshed far less often — each has its own staleness clock).

Keys venues by name + address. No-ops with a clear message if
BESTTIME_API_KEY isn't set.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.integrations import besttime  # noqa: E402
from app.integrations.cache import is_fresh  # noqa: E402
from app.models import Restaurant, RestaurantBusynessStats  # noqa: E402

REQUEST_SLEEP_SECONDS = 0.5


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-age-hours", type=float, default=1.0, help="skip current-busyness refresh within this many hours (default 1h)"
    )
    parser.add_argument(
        "--weekly-max-age-hours",
        type=float,
        default=24 * 7,
        help="skip weekly-pattern refresh within this many hours (default 168h/7d — it's a heavier call and changes far less)",
    )
    parser.add_argument("--force", action="store_true", help="refresh everything regardless of freshness")
    args = parser.parse_args()

    if not besttime.is_configured():
        print("BESTTIME_API_KEY not set — nothing to refresh.")
        return

    db = SessionLocal()
    try:
        restaurants = list(db.scalars(select(Restaurant).where(Restaurant.active.is_(True))))
        now = datetime.now(timezone.utc)
        live_refreshed = live_skipped = weekly_refreshed = weekly_skipped = 0

        for restaurant in restaurants:
            stats = db.get(RestaurantBusynessStats, restaurant.restaurant_id)
            if stats is None:
                stats = RestaurantBusynessStats(restaurant_id=restaurant.restaurant_id)
                db.add(stats)
                db.flush()

            # Current busyness — cheap, refreshed hourly.
            if not args.force and is_fresh(stats.retrieved_at, args.max_age_hours):
                age_min = int((now - stats.retrieved_at).total_seconds() / 60)
                print(f"skip {restaurant.restaurant_id} (live): fresh (refreshed {age_min}m ago)")
                live_skipped += 1
            else:
                forecast = besttime.fetch_live_forecast(restaurant.name, restaurant.address)
                if forecast is None:
                    print(f"skip {restaurant.restaurant_id} (live): no result from BestTime")
                else:
                    stats.busyness_percent = forecast.busyness_percent
                    stats.retrieved_at = now
                    db.commit()
                    live_refreshed += 1
                    print(f"updated {restaurant.restaurant_id} (live): busyness={forecast.busyness_percent}%")
                    time.sleep(REQUEST_SLEEP_SECONDS)

            # Weekly pattern — heavier call, refreshed weekly by default.
            if not args.force and is_fresh(stats.weekly_pattern_retrieved_at, args.weekly_max_age_hours):
                age_days = round((now - stats.weekly_pattern_retrieved_at).total_seconds() / 86400, 1)
                print(f"skip {restaurant.restaurant_id} (weekly): fresh (refreshed {age_days}d ago)")
                weekly_skipped += 1
            else:
                weekly = besttime.fetch_week_forecast(restaurant.name, restaurant.address)
                if weekly is None:
                    print(f"skip {restaurant.restaurant_id} (weekly): no result from BestTime")
                else:
                    stats.weekly_pattern = weekly
                    stats.weekly_pattern_retrieved_at = now
                    db.commit()
                    weekly_refreshed += 1
                    print(f"updated {restaurant.restaurant_id} (weekly): {weekly}")
                    time.sleep(REQUEST_SLEEP_SECONDS)

        print(
            f"\nlive: {live_refreshed} refreshed, {live_skipped} skipped (fresh) | "
            f"weekly: {weekly_refreshed} refreshed, {weekly_skipped} skipped (fresh)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
