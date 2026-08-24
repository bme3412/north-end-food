from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.restaurant import Restaurant


class RestaurantPlaceStats(Base):
    """Latest Google Places snapshot for a restaurant. One row per restaurant, refreshed in place.

    Empty (no row) until GOOGLE_MAPS_API_KEY is configured and scripts/refresh_place_stats.py runs.
    """

    __tablename__ = "restaurant_place_stats"

    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), primary_key=True
    )
    rating: Mapped[float | None] = mapped_column(Numeric(2, 1))
    review_count: Mapped[int | None] = mapped_column(Integer)
    price_level: Mapped[int | None] = mapped_column(Integer)
    open_now: Mapped[bool | None] = mapped_column(Boolean)
    hours_summary: Mapped[str | None] = mapped_column(Text)
    maps_uri: Mapped[str | None] = mapped_column(String(1024))

    # AI-generated summaries Places API (New) returns directly — each MUST
    # be shown with its own disclosure text per Google's attribution terms,
    # so we store the exact localized string they return rather than
    # hardcoding "Summarized with Gemini" ourselves.
    place_summary: Mapped[str | None] = mapped_column(Text)
    place_summary_disclosure: Mapped[str | None] = mapped_column(Text)
    review_summary: Mapped[str | None] = mapped_column(Text)
    review_summary_disclosure: Mapped[str | None] = mapped_column(Text)
    reviews_uri: Mapped[str | None] = mapped_column(String(1024))

    source: Mapped[str] = mapped_column(String(32), default="google_places", nullable=False)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    restaurant: Mapped[Restaurant] = relationship("Restaurant", back_populates="place_stats")


class RestaurantBusynessStats(Base):
    """Latest BestTime snapshot for a restaurant. One row per restaurant, refreshed in place.

    Empty (no row) until BESTTIME_API_KEY is configured and scripts/refresh_busyness.py runs.
    """

    __tablename__ = "restaurant_busyness_stats"

    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), primary_key=True
    )
    wait_minutes: Mapped[int | None] = mapped_column(Integer)
    # 7 values Mon..Sun, each 0-1 normalized busyness for "now" in that day's pattern.
    weekly_pattern: Mapped[list[float] | None] = mapped_column(ARRAY(Numeric(3, 2)))
    source: Mapped[str] = mapped_column(String(32), default="besttime", nullable=False)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    restaurant: Mapped[Restaurant] = relationship("Restaurant", back_populates="busyness_stats")
