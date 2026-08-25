from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
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
    """Latest Google Popular Times snapshot for a restaurant (via SerpApi's
    Google Maps Place Results API). One row per restaurant, refreshed in place.

    Empty (no row) until SERPAPI_KEY is configured and scripts/refresh_busyness.py runs.
    """

    __tablename__ = "restaurant_busyness_stats"

    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), primary_key=True
    )
    # 0-100 live busyness for the current hour, when Google has one --
    # sourced from the single hour entry in the day's graph that carries
    # `current: true` in SerpApi's response. Refreshed alongside everything
    # else below since one SerpApi call returns it all together (unlike
    # BestTime's old split between a cheap live call and a heavier weekly
    # one, there's no separate cheap endpoint here).
    busyness_percent: Mapped[int | None] = mapped_column(Integer)

    # 7 values Mon..Sun, 0-1 normalized mean of each day's hourly readings
    # (typical/historical busyness, not real-time) from the same SerpApi
    # response as busyness_percent above.
    weekly_pattern: Mapped[list[float] | None] = mapped_column(ARRAY(Numeric(3, 2)))
    weekly_pattern_retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # 7 (Mon..Sun) x 24 (hour 0-23) grid, 0-1 normalized busyness_score or
    # null for hours the venue is closed / Google has no reading for. Same
    # SerpApi response as weekly_pattern above (graph_results per day) —
    # no extra API cost, just keeping more of what's already fetched
    # instead of collapsing it straight to a single day mean.
    hourly_pattern: Mapped[list[list[float | None]] | None] = mapped_column(JSONB)

    # Human-readable dwell-time estimate SerpApi/Google provides alongside
    # popular times (e.g. "People typically spend 1-4 hours here") -- new
    # data BestTime never had. Captured but not yet surfaced in the UI.
    typical_time_spent: Mapped[str | None] = mapped_column(Text)

    # Derived from the same SerpApi response above -- daily_pattern for
    # busiest/quietest, that day's hourly readings for the peak window. No
    # extra API cost, just more of what we already fetch.
    busiest_day: Mapped[str | None] = mapped_column(String(16))
    quietest_day: Mapped[str | None] = mapped_column(String(16))
    peak_hours_text: Mapped[str | None] = mapped_column(String(32))
    source: Mapped[str] = mapped_column(String(32), default="serpapi", nullable=False)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    restaurant: Mapped[Restaurant] = relationship("Restaurant", back_populates="busyness_stats")
