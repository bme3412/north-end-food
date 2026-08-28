"""Data-only migration: add the highest-value next-wave North End
restaurants (NE_0031..NE_0045).

Idempotent: skip_existing=True so a database that already ran a local
reseed of seed_wave2 is left untouched.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

revision: str = "019_add_15_restaurants"
down_revision: Union[str, Sequence[str], None] = "018_restaurant_service_modes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.seed import add_restaurants
    from app.seed_wave2 import WAVE2_RESTAURANTS

    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        stats = add_restaurants(db, WAVE2_RESTAURANTS, skip_existing=True)
        print(f"migration 019: added {stats['restaurants']} restaurants, {stats['items']} items")
    finally:
        db.close()


def downgrade() -> None:
    from sqlalchemy import delete

    from app.models import MenuItem, MenuItemIngredient, MenuSnapshot, MenuSource, PriceObservation, Restaurant

    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        new_ids = [f"NE_{i:04d}" for i in range(31, 46)]
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
