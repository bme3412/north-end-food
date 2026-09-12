"""Promote gnocchi variants that the compare audit found at 2+ restaurants.

Gnocchi is a shape, so lobster, sorrentina, and mushroom plates were sharing
one GNOCCHI median. seed_data.py already has the new IDs; this patches
already-seeded databases (production included) without a destructive reseed.
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text
from sqlalchemy.orm import Session


revision: str = "023_split_gnocchi_variants"
down_revision: str | None = "022_remove_mother_annas"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

REMATCH = (
    (
        "GNOCCHI_SORRENTINA",
        (
            "Gnocchetti Sorrentina",
            "Gnocchi alla Sorrentina",
            "Gnocchi alla Sorrentina (Late Night)",
            "Gnocchi Sorrentina",
        ),
    ),
    (
        "GNOCCHI_LOBSTER",
        (
            "Lobster Gnocchi",
            "Gnocchi con Aragosta",
            "Ricotta Gnocchi, Maine Lobster",
        ),
    ),
    (
        "GNOCCHI_FUNGHI",
        (
            "Gnocchi ai Funghi",
            "Black Truffle Ricotta Gnocchi",
        ),
    ),
)


def upgrade() -> None:
    from app.models import CanonicalDish
    from app.seed_data import CANONICAL_DISHES

    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        for dish in CANONICAL_DISHES:
            db.merge(CanonicalDish(**dish))
        db.flush()
        for dish_id, names in REMATCH:
            for name in names:
                db.execute(
                    text("UPDATE menu_items SET canonical_dish = :dish WHERE raw_name = :name"),
                    {"dish": dish_id, "name": name},
                )
        db.commit()
    finally:
        db.close()


def downgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)
    try:
        for dish_id, names in REMATCH:
            for name in names:
                db.execute(
                    text(
                        "UPDATE menu_items SET canonical_dish = 'GNOCCHI' "
                        "WHERE raw_name = :name AND canonical_dish = :dish"
                    ),
                    {"dish": dish_id, "name": name},
                )
        db.commit()
    finally:
        db.close()
