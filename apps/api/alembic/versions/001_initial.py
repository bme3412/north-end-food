"""Initial schema: restaurants, external IDs, menu sources/snapshots/items, canonical dishes."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "restaurants",
        sa.Column("restaurant_id", sa.String(length=16), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True),
        sa.Column("address", sa.String(length=512), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("neighborhood", sa.String(length=64), nullable=False, server_default="North End"),
        sa.Column("establishment_type", sa.String(length=64), nullable=False),
        sa.Column("primary_cuisine", sa.String(length=64), nullable=False),
        sa.Column("secondary_cuisines", sa.Text(), nullable=True),
        sa.Column("official_website", sa.String(length=1024), nullable=True),
        sa.Column("official_menu_url", sa.String(length=1024), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "restaurant_external_ids",
        sa.Column("restaurant_external_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("restaurant_id", sa.String(length=16), sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("external_url", sa.String(length=1024), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("provider", "external_id", name="uq_provider_external_id"),
    )

    op.create_table(
        "canonical_dishes",
        sa.Column("canonical_dish_id", sa.String(length=64), primary_key=True),
        sa.Column("canonical_name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("subcategory", sa.String(length=64), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("aliases", postgresql.ARRAY(sa.String()), nullable=True),
    )

    op.create_table(
        "menu_sources",
        sa.Column("menu_source_id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=16), sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_type", sa.String(length=32), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("source_format", sa.String(length=32), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "menu_snapshots",
        sa.Column("menu_snapshot_id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=16), sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_source_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("menu_sources.menu_source_id", ondelete="CASCADE"), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_content_location", sa.String(length=2048), nullable=True),
        sa.Column("extraction_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("extractor_model", sa.String(length=128), nullable=True),
        sa.Column("schema_version", sa.String(length=16), nullable=False, server_default="v1"),
    )

    op.create_table(
        "menu_items",
        sa.Column("menu_item_id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("menu_snapshot_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("menu_snapshots.menu_snapshot_id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", sa.String(length=16), sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_name", sa.String(length=512), nullable=False),
        sa.Column("raw_description", sa.Text(), nullable=True),
        sa.Column("raw_price_text", sa.String(length=64), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="USD"),
        sa.Column("menu_section", sa.String(length=128), nullable=True),
        sa.Column("menu_subsection", sa.String(length=128), nullable=True),
        sa.Column("canonical_category", sa.String(length=64), nullable=True),
        sa.Column("canonical_dish", sa.String(length=64), sa.ForeignKey("canonical_dishes.canonical_dish_id"), nullable=True),
        sa.Column("protein", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("pasta_type", sa.String(length=64), nullable=True),
        sa.Column("sauce", sa.String(length=64), nullable=True),
        sa.Column("preparation", sa.String(length=64), nullable=True),
        sa.Column("ingredients", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("dietary_tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("portion", sa.String(length=64), nullable=True),
        sa.Column("size", sa.String(length=64), nullable=True),
        sa.Column("seasonal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("market_price", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("normalization_confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_menu_items_restaurant_id", "menu_items", ["restaurant_id"])
    op.create_index("ix_menu_items_canonical_dish", "menu_items", ["canonical_dish"])
    op.create_index("ix_menu_items_canonical_category", "menu_items", ["canonical_category"])
    op.create_index("ix_menu_items_price", "menu_items", ["price"])
    op.create_index("ix_menu_items_snapshot", "menu_items", ["menu_snapshot_id"])
    op.execute(
        "CREATE INDEX ix_menu_items_raw_name_trgm ON menu_items USING gin (raw_name gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_menu_items_raw_name_trgm")
    op.drop_index("ix_menu_items_snapshot", table_name="menu_items")
    op.drop_index("ix_menu_items_price", table_name="menu_items")
    op.drop_index("ix_menu_items_canonical_category", table_name="menu_items")
    op.drop_index("ix_menu_items_canonical_dish", table_name="menu_items")
    op.drop_index("ix_menu_items_restaurant_id", table_name="menu_items")
    op.drop_table("menu_items")
    op.drop_table("menu_snapshots")
    op.drop_table("menu_sources")
    op.drop_table("canonical_dishes")
    op.drop_table("restaurant_external_ids")
    op.drop_table("restaurants")
