"""Add takeout/dine_in/delivery booleans to restaurant_place_stats.

Google Places API (New) exposes these directly on Place Details
(takeout/delivery/dineIn) — same call already made for rating/hours/price,
just not requested yet. Populated only once
scripts/refresh_place_stats.py runs again with the extended field mask;
null until then, same as every other Places-sourced column here.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018_restaurant_service_modes"
down_revision: Union[str, Sequence[str], None] = "017_busyness_time_spent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurant_place_stats", sa.Column("takeout", sa.Boolean(), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("dine_in", sa.Boolean(), nullable=True))
    op.add_column("restaurant_place_stats", sa.Column("delivery", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurant_place_stats", "delivery")
    op.drop_column("restaurant_place_stats", "dine_in")
    op.drop_column("restaurant_place_stats", "takeout")
