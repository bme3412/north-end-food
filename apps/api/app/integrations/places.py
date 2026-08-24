"""Google Places client for restaurant hero data (rating, price level, hours).

Inert without GOOGLE_MAPS_API_KEY: fetch_place_details returns None immediately
so callers (scripts/refresh_place_stats.py) can no-op cleanly until a key is set.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import settings

PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACE_DETAILS_FIELDS = "rating,user_ratings_total,price_level,opening_hours,url"


@dataclass(frozen=True)
class PlaceDetails:
    rating: float | None
    review_count: int | None
    price_level: int | None
    open_now: bool | None
    hours_summary: str | None


def is_configured() -> bool:
    return bool(settings.google_maps_api_key)


def fetch_place_details(place_id: str) -> PlaceDetails | None:
    if not is_configured():
        return None

    with httpx.Client(timeout=10.0) as client:
        response = client.get(
            PLACE_DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": PLACE_DETAILS_FIELDS,
                "key": settings.google_maps_api_key,
            },
        )
        response.raise_for_status()
        payload = response.json()

    if payload.get("status") != "OK":
        return None

    result = payload["result"]
    hours = result.get("opening_hours") or {}
    weekday_text = hours.get("weekday_text") or []

    return PlaceDetails(
        rating=result.get("rating"),
        review_count=result.get("user_ratings_total"),
        price_level=result.get("price_level"),
        open_now=hours.get("open_now"),
        hours_summary="; ".join(weekday_text) if weekday_text else None,
    )
