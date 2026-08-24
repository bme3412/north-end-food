from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import MenuItem, MenuSnapshot, MenuSource, Restaurant
from app.queries import latest_snapshot_ids, price_profile
from app.schemas import RestaurantDetail, RestaurantExternalIdOut, RestaurantSummary
from app.schemas.menu import CategoryMedianOut, PriceProfileOut, ProvenanceEntry

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


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
def list_restaurants(db: Session = Depends(get_db)) -> list[Restaurant]:
    return list(db.scalars(select(Restaurant).where(Restaurant.active.is_(True)).order_by(Restaurant.name)))


@router.get("/{restaurant_id}", response_model=RestaurantDetail)
def get_restaurant(restaurant_id: str, db: Session = Depends(get_db)) -> RestaurantDetail:
    restaurant = db.scalar(
        select(Restaurant)
        .options(selectinload(Restaurant.external_ids), selectinload(Restaurant.place_stats), selectinload(Restaurant.busyness_stats))
        .where(Restaurant.restaurant_id == restaurant_id)
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
            source="BestTime",
            status="connected" if busyness_stats and busyness_stats.retrieved_at else "not_connected",
            detail=_time_ago(busyness_stats.retrieved_at)
            if busyness_stats and busyness_stats.retrieved_at
            else "Add BESTTIME_API_KEY and run scripts/refresh_busyness.py",
        )
    )

    profile = price_profile(db, restaurant_id)

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
        open_now=place_stats.open_now if place_stats else None,
        hours_summary=place_stats.hours_summary if place_stats else None,
        ratings_updated_at=place_stats.retrieved_at if place_stats else None,
        wait_minutes=busyness_stats.wait_minutes if busyness_stats else None,
        weekly_popularity=[float(v) for v in busyness_stats.weekly_pattern] if busyness_stats and busyness_stats.weekly_pattern else None,
        crowd_updated_at=busyness_stats.retrieved_at if busyness_stats else None,
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
