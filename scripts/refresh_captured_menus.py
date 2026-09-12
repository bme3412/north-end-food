#!/usr/bin/env python3
"""Write new snapshots for restaurants captured into menus/*.md."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from app.db import SessionLocal  # noqa: E402
from app.seed import refresh_restaurant_menus  # noqa: E402
from app.seed_captured_menus import CAPTURED_MENUS  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        stats = refresh_restaurant_menus(db, list(CAPTURED_MENUS))
        print(f"Refreshed {len(CAPTURED_MENUS)} restaurants, wrote {stats['items']} items.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
