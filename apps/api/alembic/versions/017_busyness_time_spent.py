"""Add restaurant_busyness_stats.typical_time_spent.

New field from switching the crowd-data source from BestTime to SerpApi's
Google Maps Place Results API (Google Popular Times) -- SerpApi's response
includes a human-readable dwell-time estimate (e.g. "People typically spend
1-4 hours here") alongside the busyness data, at no extra API cost. Captured
here; not yet surfaced in the UI.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_busyness_time_spent"
down_revision: Union[str, Sequence[str], None] = "016_busyness_hourly_pattern"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurant_busyness_stats", sa.Column("typical_time_spent", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurant_busyness_stats", "typical_time_spent")
