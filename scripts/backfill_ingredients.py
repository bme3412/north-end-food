#!/usr/bin/env python3
"""Backfill ingredients/menu_item_ingredients for snapshots that went live
before those tables existed. Idempotent (record_menu_item_ingredients skips
(menu_item, ingredient) pairs that already exist), so safe to rerun.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.ingredients import record_menu_item_ingredients  # noqa: E402
from app.models import MenuSnapshot  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        snapshots = list(
            db.scalars(
                select(MenuSnapshot).where(MenuSnapshot.extraction_status.in_(("complete", "manual_seed")))
            )
        )
        total = 0
        for snapshot in snapshots:
            total += record_menu_item_ingredients(db, snapshot)
        db.commit()
        print(f"Backfilled {total} ingredient link(s) across {len(snapshots)} trusted snapshot(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
