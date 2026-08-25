"""Add restaurants.hours (JSONB weekly hours), for a live open-now filter
and clock display. Google Places open_now/hours_summary already exist on
restaurant_place_stats but are unpopulated (no restaurant has ever been
linked+refreshed) and would be a stale batch snapshot even if they were.
This is hand-curated, first-party data instead — see app/hours.py.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013_restaurant_hours"
down_revision: Union[str, Sequence[str], None] = "012_white_pizza_aliases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("hours", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurants", "hours")
