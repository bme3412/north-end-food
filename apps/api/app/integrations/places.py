"""Google Places API (New) client — rating/hours/price, plus the AI-generated
place and review summaries Google now serves directly (generativeSummary /
reviewSummary), so restaurant review intelligence doesn't need a separate
scrape-reviews-then-summarize pipeline.

Docs:
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/place-summaries
- https://developers.google.com/maps/documentation/places/web-service/review-summaries

Inert without GOOGLE_MAPS_API_KEY: both public functions return None
immediately so callers (scripts/link_google_places.py,
scripts/refresh_place_stats.py) can no-op cleanly until a key is set.

Every AI-generated summary Google returns MUST be shown with its
disclosure text ("Summarized with Gemini") per their attribution
requirement — we store the exact localized disclosureText they return
rather than hardcoding it, and the review summary must link back to
reviewsUri. See RestaurantPlaceStats / the review-intelligence UI.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import settings

TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

DETAILS_FIELD_MASK = ",".join(
    [
        "rating",
        "userRatingCount",
        "priceLevel",
        "regularOpeningHours.openNow",
        "regularOpeningHours.weekdayDescriptions",
        "googleMapsUri",
        "generativeSummary",
        "reviewSummary",
        "takeout",
        "dineIn",
        "delivery",
    ]
)
SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress"

# Places API (New) returns an enum string, not the legacy 0-4 integer.
_PRICE_LEVELS = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


@dataclass(frozen=True)
class PlaceDetails:
    rating: float | None
    review_count: int | None
    price_level: int | None
    open_now: bool | None
    hours_summary: str | None
    maps_uri: str | None
    place_summary: str | None
    place_summary_disclosure: str | None
    review_summary: str | None
    review_summary_disclosure: str | None
    reviews_uri: str | None
    takeout: bool | None
    dine_in: bool | None
    delivery: bool | None


def is_configured() -> bool:
    return bool(settings.google_maps_api_key)


def _headers(field_mask: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_maps_api_key or "",
        "X-Goog-FieldMask": field_mask,
    }


def find_place_id(name: str, address: str) -> str | None:
    """Text Search (New) — resolve a restaurant's Google Places id from its
    name + address, for populating restaurant_external_ids."""
    if not is_configured():
        return None

    with httpx.Client(timeout=10.0) as client:
        response = client.post(
            TEXT_SEARCH_URL,
            headers=_headers(SEARCH_FIELD_MASK),
            json={"textQuery": f"{name}, {address}"},
        )
        response.raise_for_status()
        payload = response.json()

    places = payload.get("places") or []
    if not places:
        return None
    return places[0].get("id")


def fetch_place_details(place_id: str) -> PlaceDetails | None:
    if not is_configured():
        return None

    with httpx.Client(timeout=10.0) as client:
        response = client.get(
            PLACE_DETAILS_URL.format(place_id=place_id),
            headers=_headers(DETAILS_FIELD_MASK),
        )
        response.raise_for_status()
        result = response.json()

    hours = result.get("regularOpeningHours") or {}
    weekday_descriptions = hours.get("weekdayDescriptions") or []

    generative_summary = result.get("generativeSummary") or {}
    place_summary = (generative_summary.get("overview") or {}).get("text")
    place_summary_disclosure = (generative_summary.get("disclosureText") or {}).get("text")

    review_summary_block = result.get("reviewSummary") or {}
    review_summary = (review_summary_block.get("text") or {}).get("text")
    review_summary_disclosure = (review_summary_block.get("disclosureText") or {}).get("text")

    raw_price_level = result.get("priceLevel")

    return PlaceDetails(
        rating=result.get("rating"),
        review_count=result.get("userRatingCount"),
        price_level=_PRICE_LEVELS.get(raw_price_level),
        open_now=hours.get("openNow"),
        hours_summary="; ".join(weekday_descriptions) if weekday_descriptions else None,
        maps_uri=result.get("googleMapsUri"),
        place_summary=place_summary,
        place_summary_disclosure=place_summary_disclosure,
        review_summary=review_summary,
        review_summary_disclosure=review_summary_disclosure,
        reviews_uri=review_summary_block.get("reviewsUri"),
        takeout=result.get("takeout"),
        dine_in=result.get("dineIn"),
        delivery=result.get("delivery"),
    )
