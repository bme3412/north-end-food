from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.integrations import places
from app.integrations.usage import reserve_monthly_attempt
from app.hours import compute_open_status, format_hours_summary
from app.models import MenuItem, MenuSnapshot, MenuSource, Restaurant, RestaurantExternalId
from app.queries import latest_snapshot_ids, price_profile
from app.schemas import GooglePhotoAuthorOut, GooglePhotoOut, RestaurantDetail, RestaurantExternalIdOut, RestaurantSummary
from app.schemas.menu import CategoryMedianOut, PriceProfileOut, ProvenanceEntry

router = APIRouter(prefix="/restaurants", tags=["restaurants"])
PHOTO_VARIANTS = {"thumbnail": (240, 240), "card": (720, 540), "hero": (1600, 1000)}
NO_STORE_HEADERS = {"Cache-Control": "private, no-store", "Pragma": "no-cache"}


def _to_summary(
    restaurant: Restaurant,
    at_day: int | None = None,
    at_time: str | None = None,
    at_until: str | None = None,
) -> RestaurantSummary:
    return RestaurantSummary(
        restaurant_id=restaurant.restaurant_id,
        name=restaurant.name,
        slug=restaurant.slug,
        address=restaurant.address,
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        neighborhood=restaurant.neighborhood,
        establishment_type=restaurant.establishment_type,
        primary_cuisine=restaurant.primary_cuisine,
        official_website=restaurant.official_website,
        official_menu_url=restaurant.official_menu_url,
        photo_url=restaurant.photo_url,
        active=restaurant.active,
        open_now=compute_open_status(restaurant.hours, at_day, at_time, at_until),
        hours_summary=format_hours_summary(restaurant.hours),
    )


def _time_ago(moment: datetime | None) -> str | None:
    if moment is None:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - moment
    minutes = int(delta.total_seconds() // 60)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"Updated {minutes} minute{'s' if minutes != 1 else ''} ago"
    hours = minutes // 60
    if hours < 24:
        return f"Updated {hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    return f"Updated {days} day{'s' if days != 1 else ''} ago"


@router.get("", response_model=list[RestaurantSummary])
def list_restaurants(
    open_now: bool | None = Query(None, description="If true, only restaurants open right now (America/New_York)"),
    at_day: int | None = Query(None, ge=0, le=6, description="Preview day, 0=Mon..6=Sun, instead of today. Pairs with at_time."),
    at_time: str | None = Query(None, pattern=r"^\d{2}:\d{2}$", description="Preview time 'HH:MM' (24h, America/New_York), instead of right now. Pairs with at_day."),
    at_until: str | None = Query(None, pattern=r"^\d{2}:\d{2}$", description="Optional end of a preview range 'HH:MM' -- requires being open for the whole [at_time, at_until) window."),
    db: Session = Depends(get_db),
) -> list[RestaurantSummary]:
    restaurants = list(db.scalars(select(Restaurant).where(Restaurant.active.is_(True)).order_by(Restaurant.name)))
    summaries = [_to_summary(restaurant, at_day=at_day, at_time=at_time, at_until=at_until) for restaurant in restaurants]
    if open_now is not None:
        summaries = [summary for summary in summaries if summary.open_now == open_now]
    return summaries


@router.get("/{restaurant_id}/google-photo", response_model=GooglePhotoOut)
def get_google_photo(
    restaurant_id: str,
    response: Response,
    variant: str = Query("card", pattern="^(thumbnail|card|hero)$"),
    db: Session = Depends(get_db),
) -> GooglePhotoOut:
    response.headers.update(NO_STORE_HEADERS)
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or not restaurant.active:
        raise HTTPException(404, "Restaurant not found", headers=NO_STORE_HEADERS)
    if restaurant.photo_url:
        raise HTTPException(404, "Restaurant has an owned photo", headers=NO_STORE_HEADERS)
    external_id = db.scalar(
        select(RestaurantExternalId).where(
            RestaurantExternalId.restaurant_id == restaurant_id,
            RestaurantExternalId.provider == "google_places",
            RestaurantExternalId.verification_status == "verified",
            RestaurantExternalId.verified_at.is_not(None),
        )
    )
    if external_id is None:
        raise HTTPException(404, "No verified Google Place", headers=NO_STORE_HEADERS)
    if not places.photos_are_configured():
        raise HTTPException(503, "Google photo fallback is unavailable", headers=NO_STORE_HEADERS)
    if not reserve_monthly_attempt(db, provider="google_places", metric="photo_media", cap=settings.google_place_photo_monthly_cap):
        raise HTTPException(429, "Monthly Google photo limit reached", headers=NO_STORE_HEADERS)
    width, height = PHOTO_VARIANTS[variant]
    try:
        photo = places.fetch_place_photo(external_id.external_id, max_width_px=width, max_height_px=height)
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Google photo service unavailable", headers=NO_STORE_HEADERS) from None
    if photo is None:
        raise HTTPException(404, "No Google photo available", headers=NO_STORE_HEADERS)
    return GooglePhotoOut(
        image_url=photo.image_url,
        width_px=photo.width_px,
        height_px=photo.height_px,
        google_maps_uri=photo.google_maps_uri,
        flag_content_uri=photo.flag_content_uri,
        authors=[GooglePhotoAuthorOut(display_name=a.display_name, profile_uri=a.profile_uri, avatar_uri=a.avatar_uri) for a in photo.authors],
    )


@router.get("/{restaurant_id}", response_model=RestaurantDetail)
def get_restaurant(
    restaurant_id: str,
    at_day: int | None = Query(None, ge=0, le=6, description="Preview day, 0=Mon..6=Sun, instead of today. Pairs with at_time."),
    at_time: str | None = Query(None, pattern=r"^\d{2}:\d{2}$", description="Preview time 'HH:MM' (24h, America/New_York), instead of right now. Pairs with at_day."),
    at_until: str | None = Query(None, pattern=r"^\d{2}:\d{2}$", description="Optional end of a preview range 'HH:MM' -- requires being open for the whole [at_time, at_until) window."),
    db: Session = Depends(get_db),
) -> RestaurantDetail:
    restaurant = db.scalar(
        select(Restaurant)
        .options(selectinload(Restaurant.external_ids), selectinload(Restaurant.place_stats), selectinload(Restaurant.busyness_stats))
        .where(Restaurant.restaurant_id == restaurant_id, Restaurant.active.is_(True))
    )
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    latest = latest_snapshot_ids(db).subquery()
    item_count = db.scalar(
        select(func.count(MenuItem.menu_item_id)).where(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.menu_snapshot_id.in_(select(latest)),
        )
    )

    snapshot_row = db.execute(
        select(MenuSnapshot, MenuSource)
        .join(MenuSource, MenuSnapshot.menu_source_id == MenuSource.menu_source_id)
        .where(MenuSnapshot.restaurant_id == restaurant_id, MenuSnapshot.menu_snapshot_id.in_(select(latest)))
    ).first()

    avg_confidence = db.scalar(
        select(func.avg(MenuItem.normalization_confidence)).where(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.menu_snapshot_id.in_(select(latest)),
            MenuItem.normalization_confidence.is_not(None),
        )
    )

    provenance: list[ProvenanceEntry] = []
    if snapshot_row is not None:
        snapshot, source = snapshot_row
        domain = urlparse(source.source_url).netloc or source.source_url
        provenance.append(
            ProvenanceEntry(
                label="Menu",
                source=domain,
                status="connected",
                detail=(
                    f"Retrieved {snapshot.retrieved_at:%b} {snapshot.retrieved_at.day}, {snapshot.retrieved_at.year}"
                    if snapshot.retrieved_at
                    else None
                ),
            )
        )
        provenance.append(
            ProvenanceEntry(
                label="Categories",
                source=f"Food Graph normalization ({snapshot.extractor_model or 'unlabeled'})",
                status="connected",
                confidence=float(avg_confidence) if avg_confidence is not None else None,
            )
        )
    else:
        provenance.append(ProvenanceEntry(label="Menu", source="—", status="not_connected"))

    place_stats = restaurant.place_stats
    provenance.append(
        ProvenanceEntry(
            label="Rating",
            source="Google Places",
            status="connected" if place_stats and place_stats.retrieved_at else "not_connected",
            detail=_time_ago(place_stats.retrieved_at)
            if place_stats and place_stats.retrieved_at
            else "Add GOOGLE_MAPS_API_KEY and run scripts/refresh_place_stats.py",
        )
    )

    busyness_stats = restaurant.busyness_stats
    provenance.append(
        ProvenanceEntry(
            label="Crowd",
            source="SerpApi",
            status="connected" if busyness_stats and busyness_stats.retrieved_at else "not_connected",
            detail=_time_ago(busyness_stats.retrieved_at)
            if busyness_stats and busyness_stats.retrieved_at
            else "Add SERPAPI_KEY and run scripts/refresh_busyness.py",
        )
    )

    profile = price_profile(db, restaurant_id)

    computed_open_now = compute_open_status(restaurant.hours, at_day, at_time, at_until)
    computed_hours_summary = format_hours_summary(restaurant.hours)

    return RestaurantDetail(
        restaurant_id=restaurant.restaurant_id,
        name=restaurant.name,
        slug=restaurant.slug,
        address=restaurant.address,
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        neighborhood=restaurant.neighborhood,
        establishment_type=restaurant.establishment_type,
        primary_cuisine=restaurant.primary_cuisine,
        official_website=restaurant.official_website,
        official_menu_url=restaurant.official_menu_url,
        photo_url=restaurant.photo_url,
        reservation_url=restaurant.reservation_url,
        active=restaurant.active,
        secondary_cuisines=restaurant.secondary_cuisines,
        last_verified_at=restaurant.last_verified_at,
        external_ids=[
            RestaurantExternalIdOut.model_validate(ext) for ext in restaurant.external_ids
        ],
        item_count=int(item_count or 0),
        rating=place_stats.rating if place_stats else None,
        review_count=place_stats.review_count if place_stats else None,
        price_level=place_stats.price_level if place_stats else None,
        open_now=computed_open_now if computed_open_now is not None else (place_stats.open_now if place_stats else None),
        hours_summary=computed_hours_summary or (place_stats.hours_summary if place_stats else None),
        maps_uri=place_stats.maps_uri if place_stats else None,
        ratings_updated_at=place_stats.retrieved_at if place_stats else None,
        takeout=place_stats.takeout if place_stats else None,
        dine_in=place_stats.dine_in if place_stats else None,
        delivery=place_stats.delivery if place_stats else None,
        place_summary=place_stats.place_summary if place_stats else None,
        place_summary_disclosure=place_stats.place_summary_disclosure if place_stats else None,
        place_summary_flag_uri=place_stats.place_summary_flag_uri if place_stats else None,
        review_summary=place_stats.review_summary if place_stats else None,
        review_summary_disclosure=place_stats.review_summary_disclosure if place_stats else None,
        review_summary_flag_uri=place_stats.review_summary_flag_uri if place_stats else None,
        reviews_uri=place_stats.reviews_uri if place_stats else None,
        busyness_percent=busyness_stats.busyness_percent if busyness_stats else None,
        weekly_popularity=[float(v) for v in busyness_stats.weekly_pattern] if busyness_stats and busyness_stats.weekly_pattern else None,
        hourly_popularity=busyness_stats.hourly_pattern if busyness_stats else None,
        crowd_updated_at=busyness_stats.retrieved_at if busyness_stats else None,
        weekly_popularity_updated_at=busyness_stats.weekly_pattern_retrieved_at if busyness_stats else None,
        busiest_day=busyness_stats.busiest_day if busyness_stats else None,
        quietest_day=busyness_stats.quietest_day if busyness_stats else None,
        peak_hours_text=busyness_stats.peak_hours_text if busyness_stats else None,
        price_profile=PriceProfileOut(
            restaurant_median=profile.restaurant_median,
            north_end_median=profile.north_end_median,
            pct_vs_median=profile.pct_vs_median,
            categories=[
                CategoryMedianOut(
                    category=c.category,
                    restaurant_median=c.restaurant_median,
                    north_end_median=c.north_end_median,
                )
                for c in profile.categories
            ],
        ),
        provenance=provenance,
    )
