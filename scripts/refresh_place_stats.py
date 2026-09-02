#!/usr/bin/env python3
"""Refresh Google Places stats (rating, price, hours, AI-generated place
and review summaries) for seeded restaurants.

Requires a `restaurant_external_ids` row with provider="google_places" per
restaurant — run scripts/link_google_places.py first to populate those.
No-ops with a clear message if GOOGLE_MAPS_API_KEY isn't set.

Skips restaurants refreshed within --max-age-hours (default 24h — ratings
and hours don't change minute to minute) so accidentally running this
twice in a row doesn't burn Places API quota for nothing. Pass --force to
refresh regardless.
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
from app.integrations import places  # noqa: E402
from app.integrations.cache import is_fresh  # noqa: E402
from app.models import Restaurant, RestaurantExternalId, RestaurantPlaceStats  # noqa: E402

REQUEST_SLEEP_SECONDS = 0.2


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-age-hours", type=float, default=24.0, help="skip restaurants refreshed more recently than this (default 24h)"
    )
    parser.add_argument("--force", action="store_true", help="refresh every restaurant regardless of freshness")
    args = parser.parse_args()

    if not places.is_configured():
        print("GOOGLE_MAPS_API_KEY not set — nothing to refresh.")
        return

    db = SessionLocal()
    try:
        rows = db.execute(
            select(Restaurant, RestaurantExternalId)
            .join(RestaurantExternalId, RestaurantExternalId.restaurant_id == Restaurant.restaurant_id)
            .where(RestaurantExternalId.provider == "google_places", RestaurantExternalId.verification_status == "verified", RestaurantExternalId.verified_at.is_not(None))
        ).all()

        if not rows:
            print("No restaurants have a google_places external id yet — nothing to refresh.")
            return

        now = datetime.now(timezone.utc)
        refreshed = skipped = 0

        for restaurant, external_id in rows:
            stats = db.get(RestaurantPlaceStats, restaurant.restaurant_id)

            if not args.force and stats is not None and is_fresh(stats.retrieved_at, args.max_age_hours):
                age_hr = round((now - stats.retrieved_at).total_seconds() / 3600, 1)
                print(f"skip {restaurant.restaurant_id}: fresh (refreshed {age_hr}h ago, use --force to refetch)")
                skipped += 1
                continue

            details = places.fetch_place_details(external_id.external_id)
            if details is None:
                print(f"skip {restaurant.restaurant_id}: no result from Places")
                continue

            if stats is None:
                stats = RestaurantPlaceStats(restaurant_id=restaurant.restaurant_id)
                db.add(stats)

            stats.rating = details.rating
            stats.review_count = details.review_count
            stats.price_level = details.price_level
            stats.open_now = details.open_now
            stats.hours_summary = details.hours_summary
            stats.maps_uri = details.maps_uri
            stats.place_summary = details.place_summary
            stats.place_summary_disclosure = details.place_summary_disclosure
            stats.place_summary_flag_uri = details.place_summary_flag_uri
            stats.review_summary = details.review_summary
            stats.review_summary_disclosure = details.review_summary_disclosure
            stats.review_summary_flag_uri = details.review_summary_flag_uri
            stats.reviews_uri = details.reviews_uri
            stats.takeout = details.takeout
            stats.dine_in = details.dine_in
            stats.delivery = details.delivery
            stats.retrieved_at = now
            db.commit()
            refreshed += 1
            print(f"updated {restaurant.restaurant_id}: rating={details.rating} reviews={details.review_count}")
            time.sleep(REQUEST_SLEEP_SECONDS)

        print(f"\n{refreshed} refreshed, {skipped} skipped (fresh)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
