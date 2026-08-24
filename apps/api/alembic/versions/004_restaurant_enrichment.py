"""Add reservation_url plus Google Places / BestTime enrichment tables.

Both new tables are populated only once GOOGLE_MAPS_API_KEY / BESTTIME_API_KEY
are configured and their refresh scripts run — empty by default.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_restaurant_enrichment"
down_revision: Union[str, Sequence[str], None] = "003_restaurant_photo_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("reservation_url", sa.String(length=1024), nullable=True))

    op.create_table(
        "restaurant_place_stats",
        sa.Column(
            "restaurant_id",
            sa.String(length=16),
            sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("rating", sa.Numeric(2, 1), nullable=True),
        sa.Column("review_count", sa.Integer(), nullable=True),
        sa.Column("price_level", sa.Integer(), nullable=True),
        sa.Column("open_now", sa.Boolean(), nullable=True),
        sa.Column("hours_summary", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="google_places"),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "restaurant_busyness_stats",
        sa.Column(
            "restaurant_id",
            sa.String(length=16),
            sa.ForeignKey("restaurants.restaurant_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("wait_minutes", sa.Integer(), nullable=True),
        sa.Column("weekly_pattern", postgresql.ARRAY(sa.Numeric(3, 2)), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="besttime"),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("restaurant_busyness_stats")
    op.drop_table("restaurant_place_stats")
    op.drop_column("restaurants", "reservation_url")
