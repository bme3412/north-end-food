"""Rename restaurant_busyness_stats.wait_minutes to busyness_percent.

Correction: BestTime's Live Forecast response has no wait-minutes field —
verified against a real response 2026-08-24. It returns a 0-100 busyness
percentage (venue_forecasted_busyness) instead. The original column name
was written before this integration was ever tested against a live key.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_busyness_percent"
down_revision: Union[str, Sequence[str], None] = "005_place_summaries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "restaurant_busyness_stats",
        "wait_minutes",
        new_column_name="busyness_percent",
        existing_type=sa.Integer(),
    )


def downgrade() -> None:
    op.alter_column(
        "restaurant_busyness_stats",
        "busyness_percent",
        new_column_name="wait_minutes",
        existing_type=sa.Integer(),
    )
