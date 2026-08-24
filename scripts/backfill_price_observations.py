#!/usr/bin/env python3
"""Backfill price_observations for snapshots that went live before that table
existed. Idempotent (record_price_observations skips items that already have
an observation), so safe to rerun.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import MenuSnapshot  # noqa: E402
from app.pricing import record_price_observations  # noqa: E402


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
            total += record_price_observations(db, snapshot)
        db.commit()
        print(f"Backfilled {total} price observation(s) across {len(snapshots)} trusted snapshot(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
