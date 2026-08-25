"""Data-only migration: populate restaurants.hours for the 5 seeded
restaurants. Migration 013 only added the column; this patches
already-seeded databases (production included) in place via the same
`alembic upgrade head` step already run on every deploy, rather than
requiring a full seed(reset=True) that would wipe and recreate the
entire menu corpus just to add hours data. Mirrors seed_data.py's
RESTAURANTS[*]["hours"] exactly — keep both in sync if hours change.
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014_seed_restaurant_hours"
down_revision: Union[str, Sequence[str], None] = "013_restaurant_hours"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

HOURS_BY_RESTAURANT = {
    "NE_0001": [  # Giacomo's Ristorante
        {"days": [0, 1, 2, 3, 6], "open": "12:00", "close": "22:00"},
        {"days": [4, 5], "open": "12:00", "close": "22:30"},
    ],
    "NE_0002": [  # Neptune Oyster
        {"days": [6, 0, 1, 2, 3], "open": "11:00", "close": "22:00"},
        {"days": [4, 5], "open": "11:00", "close": "23:00"},
    ],
    "NE_0003": [  # Pizzeria Regina
        {"days": [0, 1, 2, 3, 4, 5], "open": "11:00", "close": "22:00"},
        {"days": [6], "open": "11:00", "close": "21:00"},
    ],
    "NE_0004": [  # Modern Pastry
        {"days": [6, 0, 1, 2, 3], "open": "07:00", "close": "23:00"},
        {"days": [4, 5], "open": "07:00", "close": "23:59"},
    ],
    "NE_0005": [  # Bricco
        {"days": [0, 1, 2, 3, 6], "open": "16:00", "close": "23:00"},
        {"days": [4], "open": "16:00", "close": "02:00"},
        {"days": [5], "open": "12:00", "close": "02:00"},
    ],
}


def upgrade() -> None:
    conn = op.get_bind()
    for restaurant_id, hours in HOURS_BY_RESTAURANT.items():
        conn.execute(
            sa.text("UPDATE restaurants SET hours = :hours WHERE restaurant_id = :restaurant_id"),
            {"hours": json.dumps(hours), "restaurant_id": restaurant_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for restaurant_id in HOURS_BY_RESTAURANT:
        conn.execute(
            sa.text("UPDATE restaurants SET hours = NULL WHERE restaurant_id = :restaurant_id"),
            {"restaurant_id": restaurant_id},
        )
