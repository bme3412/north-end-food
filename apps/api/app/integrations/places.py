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
PHOTO_MEDIA_URL = "https://places.googleapis.com/v1/{photo_name}/media"

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
SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.googleMapsUri"

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
    place_summary_flag_uri: str | None
    review_summary: str | None
    review_summary_disclosure: str | None
    review_summary_flag_uri: str | None
    reviews_uri: str | None
    takeout: bool | None
    dine_in: bool | None
    delivery: bool | None


@dataclass(frozen=True)
class PlaceCandidate:
    place_id: str
    display_name: str | None
    formatted_address: str | None
    google_maps_uri: str | None


@dataclass(frozen=True)
class PhotoAuthor:
    display_name: str | None
    profile_uri: str | None
    avatar_uri: str | None


@dataclass(frozen=True)
class PlacePhoto:
    image_url: str
    width_px: int | None
    height_px: int | None
    google_maps_uri: str
    flag_content_uri: str | None
    authors: tuple[PhotoAuthor, ...]


def is_configured() -> bool:
    return bool(settings.google_maps_api_key)


def photos_are_configured() -> bool:
    return settings.google_place_photos_enabled and is_configured()


def _headers(field_mask: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_maps_api_key or "",
        "X-Goog-FieldMask": field_mask,
    }


def find_place_candidates(name: str, address: str, max_results: int = 5) -> list[PlaceCandidate]:
    """Text Search (New) — resolve a restaurant's Google Places id from its
    name + address, for populating restaurant_external_ids."""
    if not is_configured():
        return []

    with httpx.Client(timeout=10.0) as client:
        response = client.post(
            TEXT_SEARCH_URL,
            headers=_headers(SEARCH_FIELD_MASK),
            json={"textQuery": f"{name}, {address}", "maxResultCount": max_results},
        )
        response.raise_for_status()
        payload = response.json()

    candidates = []
    for place in payload.get("places") or []:
        if not place.get("id"):
            continue
        display_name = place.get("displayName") or {}
        candidates.append(PlaceCandidate(place["id"], display_name.get("text"), place.get("formattedAddress"), place.get("googleMapsUri")))
    return candidates


def find_place_id(name: str, address: str) -> str | None:
    """Compatibility helper. Linking must use reviewed candidates."""
    candidates = find_place_candidates(name, address, max_results=1)
    return candidates[0].place_id if candidates else None


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
        place_summary_flag_uri=generative_summary.get("flagContentUri"),
        review_summary=review_summary,
        review_summary_disclosure=review_summary_disclosure,
        review_summary_flag_uri=review_summary_block.get("flagContentUri"),
        reviews_uri=review_summary_block.get("reviewsUri"),
        takeout=result.get("takeout"),
        dine_in=result.get("dineIn"),
        delivery=result.get("delivery"),
    )


def fetch_place_photo(place_id: str, *, max_width_px: int, max_height_px: int) -> PlacePhoto | None:
    """Return Google's first-ranked photo without caching its resource name or URI."""
    if not photos_are_configured():
        return None
    with httpx.Client(timeout=10.0) as client:
        details_response = client.get(PLACE_DETAILS_URL.format(place_id=place_id), headers=_headers("photos"))
        details_response.raise_for_status()
        photos = details_response.json().get("photos") or []
        if not photos:
            return None
        photo = photos[0]
        if not photo.get("name") or not photo.get("googleMapsUri"):
            return None
        media_response = client.get(
            PHOTO_MEDIA_URL.format(photo_name=photo["name"]),
            headers={"X-Goog-Api-Key": settings.google_maps_api_key or ""},
            params={"maxWidthPx": max_width_px, "maxHeightPx": max_height_px, "skipHttpRedirect": "true"},
        )
        media_response.raise_for_status()
        image_url = media_response.json().get("photoUri")
        if not image_url:
            return None
    authors = tuple(
        PhotoAuthor(author.get("displayName"), author.get("uri"), author.get("photoUri"))
        for author in photo.get("authorAttributions") or []
    )
    return PlacePhoto(image_url, photo.get("widthPx"), photo.get("heightPx"), photo["googleMapsUri"], photo.get("flagContentUri"), authors)
