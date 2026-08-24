from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.enrichment import RestaurantBusynessStats, RestaurantPlaceStats
    from app.models.menu import MenuItem, MenuSnapshot, MenuSource


class Restaurant(Base):
    __tablename__ = "restaurants"

    restaurant_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(String(512), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    neighborhood: Mapped[str] = mapped_column(String(64), default="North End")
    establishment_type: Mapped[str] = mapped_column(String(64), nullable=False)
    primary_cuisine: Mapped[str] = mapped_column(String(64), nullable=False)
    secondary_cuisines: Mapped[str | None] = mapped_column(Text)
    official_website: Mapped[str | None] = mapped_column(String(1024))
    official_menu_url: Mapped[str | None] = mapped_column(String(1024))
    photo_url: Mapped[str | None] = mapped_column(String(512))
    reservation_url: Mapped[str | None] = mapped_column(String(1024))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    external_ids: Mapped[list["RestaurantExternalId"]] = relationship(
        back_populates="restaurant", cascade="all, delete-orphan"
    )
    menu_sources: Mapped[list[MenuSource]] = relationship(
        "MenuSource", back_populates="restaurant", cascade="all, delete-orphan"
    )
    menu_snapshots: Mapped[list[MenuSnapshot]] = relationship(
        "MenuSnapshot", back_populates="restaurant", cascade="all, delete-orphan"
    )
    menu_items: Mapped[list[MenuItem]] = relationship("MenuItem", back_populates="restaurant")
    place_stats: Mapped["RestaurantPlaceStats | None"] = relationship(
        "RestaurantPlaceStats", back_populates="restaurant", cascade="all, delete-orphan", uselist=False
    )
    busyness_stats: Mapped["RestaurantBusynessStats | None"] = relationship(
        "RestaurantBusynessStats", back_populates="restaurant", cascade="all, delete-orphan", uselist=False
    )


class RestaurantExternalId(Base):
    __tablename__ = "restaurant_external_ids"
    __table_args__ = (UniqueConstraint("provider", "external_id", name="uq_provider_external_id"),)

    restaurant_external_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    external_url: Mapped[str | None] = mapped_column(String(1024))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    restaurant: Mapped[Restaurant] = relationship(back_populates="external_ids")
