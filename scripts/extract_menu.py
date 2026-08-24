#!/usr/bin/env python3
"""Run Gemini extraction on a restaurant's latest pending menu snapshot.

No-ops with a clear message if GEMINI_API_KEY isn't set. On success, items
are written but the snapshot stays at extraction_status="needs_review" —
run scripts/review_extraction.py to approve before it's live in search.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.extraction.pipeline import ExtractionError, run_extraction  # noqa: E402
from app.integrations import gemini  # noqa: E402
from app.models import MenuSnapshot, MenuSource  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: extract_menu.py <restaurant_id>", file=sys.stderr)
        raise SystemExit(2)
    restaurant_id = sys.argv[1]

    if not gemini.is_configured():
        print("GEMINI_API_KEY not set — nothing to extract.")
        return

    db = SessionLocal()
    try:
        row = db.execute(
            select(MenuSnapshot, MenuSource)
            .join(MenuSource, MenuSnapshot.menu_source_id == MenuSource.menu_source_id)
            .where(MenuSnapshot.restaurant_id == restaurant_id, MenuSnapshot.extraction_status == "pending")
            .order_by(MenuSnapshot.retrieved_at.desc())
        ).first()

        if row is None:
            print(f"no pending snapshot for {restaurant_id}")
            return

        snapshot, source = row
        try:
            count = run_extraction(db, snapshot, source)
        except ExtractionError as exc:
            print(f"extraction failed: {exc}", file=sys.stderr)
            raise SystemExit(1)

        print(f"extracted {count} items for {restaurant_id} -> snapshot {snapshot.menu_snapshot_id}")
        print("status=needs_review — run scripts/review_extraction.py to approve")
    finally:
        db.close()


if __name__ == "__main__":
    main()
