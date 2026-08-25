"""Add restaurant_busyness_stats.hourly_pattern (JSONB, 7x24 grid).

BestTime's weekly-pattern response already includes per-hour intensity for
each day (hour_analysis) -- previously only collapsed into a single
day_mean per day (weekly_pattern) and a single peak-hours string for the
busiest day. This stores the full grid so the frontend can render an
hour-by-hour heatmap for the whole week, no extra API calls needed.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016_busyness_hourly_pattern"
down_revision: Union[str, Sequence[str], None] = "015_add_25_restaurants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurant_busyness_stats", sa.Column("hourly_pattern", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurant_busyness_stats", "hourly_pattern")
