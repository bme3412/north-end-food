"""Add busiest_day / quietest_day / peak_hours_text to restaurant_busyness_stats.

Derived from fields already present in the New Forecast response
(day_rank_mean, hour_analysis) that were being fetched and discarded —
no additional BestTime API cost.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_busiest_day_peak_hours"
down_revision: Union[str, Sequence[str], None] = "007_weekly_pattern_retrieved_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurant_busyness_stats", sa.Column("busiest_day", sa.String(length=16), nullable=True))
    op.add_column("restaurant_busyness_stats", sa.Column("quietest_day", sa.String(length=16), nullable=True))
    op.add_column("restaurant_busyness_stats", sa.Column("peak_hours_text", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurant_busyness_stats", "peak_hours_text")
    op.drop_column("restaurant_busyness_stats", "quietest_day")
    op.drop_column("restaurant_busyness_stats", "busiest_day")
