"""Add restaurant_busyness_stats.weekly_pattern_retrieved_at.

The weekly pattern comes from BestTime's "New Forecast" endpoint, a
heavier call than Live Forecast with genuinely different data — a
historical/typical pattern, not real-time. It needs its own staleness
timestamp so refreshing current busyness_percent (hourly) doesn't force
an unnecessary refetch of the weekly data (which changes far less often).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_weekly_pattern_retrieved_at"
down_revision: Union[str, Sequence[str], None] = "006_busyness_percent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "restaurant_busyness_stats", sa.Column("weekly_pattern_retrieved_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("restaurant_busyness_stats", "weekly_pattern_retrieved_at")
