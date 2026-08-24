"""Add Places API (New) generative summary fields to restaurant_place_stats.

Populated only once GOOGLE_MAPS_API_KEY is configured and
scripts/refresh_place_stats.py runs — empty by default.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_place_summaries"
down_revision: Union[str, Sequence[str], None] = "004_restaurant_enrichment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurant_place_stats", sa.Column("maps_uri", sa.String(length=1024), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("place_summary", sa.Text(), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("place_summary_disclosure", sa.Text(), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("review_summary", sa.Text(), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("review_summary_disclosure", sa.Text(), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("reviews_uri", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurant_place_stats", "reviews_uri")
    op.drop_column("restaurant_place_stats", "review_summary_disclosure")
    op.drop_column("restaurant_place_stats", "review_summary")
    op.drop_column("restaurant_place_stats", "place_summary_disclosure")
    op.drop_column("restaurant_place_stats", "place_summary")
    op.drop_column("restaurant_place_stats", "maps_uri")
