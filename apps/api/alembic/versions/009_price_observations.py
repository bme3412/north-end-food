"""Add price_observations: one row per priced MenuItem, written once its
snapshot is trusted. Turns the snapshot chain into a queryable price history
per (restaurant, canonical_dish) — closes intent-build-plan.md Phase 6.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009_price_observations"
down_revision: Union[str, Sequence[str], None] = "008_busiest_day_peak_hours"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "price_observations",
        sa.Column("price_observation_id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "menu_item_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("menu_items.menu_item_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "restaurant_id",
            sa.String(length=16),
            sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "canonical_dish",
            sa.String(length=64),
            sa.ForeignKey("canonical_dishes.canonical_dish_id"),
            nullable=True,
        ),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("service_mode", sa.String(length=16), nullable=False, server_default="dine_in"),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("menu_item_id", name="uq_price_observation_menu_item"),
    )

    op.create_index("ix_price_observations_restaurant_id", "price_observations", ["restaurant_id"])
    op.create_index("ix_price_observations_canonical_dish", "price_observations", ["canonical_dish"])
    op.create_index("ix_price_observations_observed_at", "price_observations", ["observed_at"])


def downgrade() -> None:
    op.drop_index("ix_price_observations_observed_at", table_name="price_observations")
    op.drop_index("ix_price_observations_canonical_dish", table_name="price_observations")
    op.drop_index("ix_price_observations_restaurant_id", table_name="price_observations")
    op.drop_table("price_observations")
