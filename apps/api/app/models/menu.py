from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.restaurant import Restaurant


class CanonicalDish(Base):
    __tablename__ = "canonical_dishes"

    canonical_dish_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    subcategory: Mapped[str | None] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text)
    aliases: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)


class MenuSource(Base):
    __tablename__ = "menu_sources"

    menu_source_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False
    )
    menu_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    source_format: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    restaurant: Mapped[Restaurant] = relationship(back_populates="menu_sources")
    snapshots: Mapped[list["MenuSnapshot"]] = relationship(back_populates="menu_source")


class MenuSnapshot(Base):
    __tablename__ = "menu_snapshots"

    menu_snapshot_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False
    )
    menu_source_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("menu_sources.menu_source_id", ondelete="CASCADE"), nullable=False
    )
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_content_location: Mapped[str | None] = mapped_column(String(2048))
    extraction_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    extractor_model: Mapped[str | None] = mapped_column(Text)
    schema_version: Mapped[str] = mapped_column(String(16), default="v1")

    restaurant: Mapped[Restaurant] = relationship(back_populates="menu_snapshots")
    menu_source: Mapped[MenuSource] = relationship(back_populates="snapshots")
    items: Mapped[list["MenuItem"]] = relationship(back_populates="snapshot", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    menu_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    menu_snapshot_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("menu_snapshots.menu_snapshot_id", ondelete="CASCADE"), nullable=False
    )
    restaurant_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False
    )

    raw_name: Mapped[str] = mapped_column(String(512), nullable=False)
    raw_description: Mapped[str | None] = mapped_column(Text)
    raw_price_text: Mapped[str | None] = mapped_column(String(64))
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(8), default="USD")

    menu_section: Mapped[str | None] = mapped_column(String(128))
    menu_subsection: Mapped[str | None] = mapped_column(String(128))

    canonical_category: Mapped[str | None] = mapped_column(String(64))
    canonical_dish: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("canonical_dishes.canonical_dish_id")
    )

    protein: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    pasta_type: Mapped[str | None] = mapped_column(String(64))
    sauce: Mapped[str | None] = mapped_column(String(64))
    preparation: Mapped[str | None] = mapped_column(String(64))
    ingredients: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    dietary_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    portion: Mapped[str | None] = mapped_column(String(64))
    size: Mapped[str | None] = mapped_column(String(64))
    seasonal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    market_price: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    normalization_confidence: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    snapshot: Mapped[MenuSnapshot] = relationship(back_populates="items")
    restaurant: Mapped[Restaurant] = relationship(back_populates="menu_items")
    dish: Mapped[CanonicalDish | None] = relationship()
