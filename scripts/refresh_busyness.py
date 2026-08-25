#!/usr/bin/env python3
"""Refresh crowd data (Google Popular Times, via SerpApi's Google Maps Place
Results API) for seeded restaurants: current busyness, the typical weekly
pattern, hour-by-hour breakdown, and a typical-time-spent estimate -- all
from a single call per restaurant (unlike the old BestTime integration,
which split this across a cheap live call and a heavier weekly one; SerpApi
has no such split, one call returns everything).

Requires a `restaurant_external_ids` row with provider="google_places" per
restaurant -- run scripts/link_google_places.py first to populate those.
No-ops with a clear message if SERPAPI_KEY isn't set.

Skips restaurants refreshed within --max-age-hours (default 168h/7d, chosen
to stay comfortably inside SerpApi's 250-searches/month free tier at 30
restaurants: ~130 calls/month) so accidentally running this twice in a row
doesn't burn quota for nothing. Pass --force to refresh regardless.
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
from app.integrations import serpapi  # noqa: E402
from app.integrations.cache import is_fresh  # noqa: E402
from app.models import Restaurant, RestaurantBusynessStats, RestaurantExternalId  # noqa: E402

REQUEST_SLEEP_SECONDS = 0.5


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-age-hours", type=float, default=24 * 7, help="skip restaurants refreshed more recently than this (default 168h/7d)"
    )
    parser.add_argument("--force", action="store_true", help="refresh every restaurant regardless of freshness")
    args = parser.parse_args()

    if not serpapi.is_configured():
        print("SERPAPI_KEY not set — nothing to refresh.")
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
        refreshed = skipped = 0

        for restaurant, external_id in rows:
            stats = db.get(RestaurantBusynessStats, restaurant.restaurant_id)

            if not args.force and stats is not None and is_fresh(stats.retrieved_at, args.max_age_hours):
                age_hr = round((now - stats.retrieved_at).total_seconds() / 3600, 1)
                print(f"skip {restaurant.restaurant_id}: fresh (refreshed {age_hr}h ago, use --force to refetch)")
                skipped += 1
                continue

            result = serpapi.fetch_popular_times(external_id.external_id)
            if result is None:
                print(f"skip {restaurant.restaurant_id}: no result from SerpApi")
                continue

            if stats is None:
                stats = RestaurantBusynessStats(restaurant_id=restaurant.restaurant_id)
                db.add(stats)

            stats.busyness_percent = result.live_busyness_percent
            stats.weekly_pattern = result.daily_pattern
            stats.hourly_pattern = result.hourly_pattern
            stats.typical_time_spent = result.typical_time_spent
            stats.busiest_day = result.busiest_day
            stats.quietest_day = result.quietest_day
            stats.peak_hours_text = result.peak_hours_text
            stats.retrieved_at = now
            stats.weekly_pattern_retrieved_at = now
            db.commit()
            refreshed += 1
            print(
                f"updated {restaurant.restaurant_id}: live={result.live_busyness_percent}% "
                f"busiest={result.busiest_day} quietest={result.quietest_day} peak={result.peak_hours_text}"
            )
            time.sleep(REQUEST_SLEEP_SECONDS)

        print(f"\n{refreshed} refreshed, {skipped} skipped (fresh)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
