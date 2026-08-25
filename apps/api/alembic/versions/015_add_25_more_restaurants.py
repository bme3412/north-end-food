"""Data-only migration: add 25 more North End restaurants (NE_0006..NE_0030)
and their canonical dishes/ingredients/price observations, expanding the
map from 5 to 30 restaurants. Hand-researched from each restaurant's own
site (name/address/coordinates/hours/a handful of real representative
dishes), not a full menu extraction -- matches the project's own Phase 0
target in intent-build-plan.md (30-40 representative venues).

Idempotent and additive only: uses app.seed.add_restaurants(skip_existing=
True), which leaves the original 5 restaurants (and any restaurant already
present from a prior run of this migration) untouched. Applies via the
same `alembic upgrade head` step the Docker CMD already runs on every
deploy, so this reaches production without a destructive reseed.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

revision: str = "015_add_25_restaurants"
down_revision: Union[str, Sequence[str], None] = "014_seed_restaurant_hours"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.seed import add_restaurants
    from app.seed_data import CANONICAL_DISHES, RESTAURANTS
    from app.models import CanonicalDish

    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        for dish in CANONICAL_DISHES:
            db.merge(CanonicalDish(**dish))
        db.flush()

        new_restaurants = [row for row in RESTAURANTS if row["restaurant_id"] >= "NE_0006"]
        stats = add_restaurants(db, new_restaurants, skip_existing=True)
        print(f"migration 015: added {stats['restaurants']} restaurants, {stats['items']} items")
    finally:
        db.close()


def downgrade() -> None:
    from sqlalchemy import delete

    from app.models import MenuItem, MenuItemIngredient, MenuSnapshot, MenuSource, PriceObservation, Restaurant

    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        new_ids = [f"NE_{i:04d}" for i in range(6, 31)]
        item_ids = db.query(MenuItem.menu_item_id).filter(MenuItem.restaurant_id.in_(new_ids)).subquery()
        db.execute(delete(MenuItemIngredient).where(MenuItemIngredient.menu_item_id.in_(item_ids)))
        db.execute(delete(PriceObservation).where(PriceObservation.restaurant_id.in_(new_ids)))
        db.execute(delete(MenuItem).where(MenuItem.restaurant_id.in_(new_ids)))
        db.execute(delete(MenuSnapshot).where(MenuSnapshot.restaurant_id.in_(new_ids)))
        db.execute(delete(MenuSource).where(MenuSource.restaurant_id.in_(new_ids)))
        db.execute(delete(Restaurant).where(Restaurant.restaurant_id.in_(new_ids)))
        db.commit()
    finally:
        db.close()
