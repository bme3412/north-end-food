"""Write the current seed menus onto already-seeded databases.

Production still serves the original thin snapshots (~500 items, pasta
91/25 with the default Open-now + Dine-in chips). Local already has the
full wave-1 research menus plus captured wave-2 lists. This writes a new
snapshot per restaurant from RESTAURANTS + WAVE2_RESTAURANTS (wave two
already overlays CAPTURED_MENUS) so pasta browse matches local.

Idempotent: add_restaurants(menu_only=True) skips a snapshot whose hash
already exists.
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.orm import Session


revision: str = "024_refresh_captured_menus"
down_revision: str | None = "023_split_gnocchi_variants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    from app.models import CanonicalDish
    from app.seed import refresh_restaurant_menus
    from app.seed_data import CANONICAL_DISHES

    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        for dish in CANONICAL_DISHES:
            db.merge(CanonicalDish(**dish))
        db.flush()
        stats = refresh_restaurant_menus(db)
        print(f"migration 024: wrote {stats['items']} items from current seed menus")
    finally:
        db.close()


def downgrade() -> None:
    # New snapshots stay; latest_snapshot_ids keeps using the newest row.
    # Rolling back would require remembering the previous snapshot ids.
    return
