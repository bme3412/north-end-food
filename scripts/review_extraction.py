#!/usr/bin/env python3
"""Review a Gemini-extracted menu snapshot before it goes live in search.

Approve promotes extraction_status to "complete" (now visible via
latest_snapshot_ids -> the public API). Reject deletes the extracted items
and resets the snapshot to "pending" so scripts/extract_menu.py can retry.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import MenuItem, MenuSnapshot  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: review_extraction.py <restaurant_id> [--yes]", file=sys.stderr)
        raise SystemExit(2)
    restaurant_id = sys.argv[1]
    auto_approve = "--yes" in sys.argv[2:]

    db = SessionLocal()
    try:
        snapshot = db.scalar(
            select(MenuSnapshot)
            .where(MenuSnapshot.restaurant_id == restaurant_id, MenuSnapshot.extraction_status == "needs_review")
            .order_by(MenuSnapshot.retrieved_at.desc())
        )
        if snapshot is None:
            print(f"no snapshot awaiting review for {restaurant_id}")
            return

        items = list(
            db.scalars(
                select(MenuItem)
                .where(MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id)
                .order_by(MenuItem.menu_section, MenuItem.raw_name)
            )
        )

        print(f"{len(items)} items extracted by {snapshot.extractor_model} (snapshot {snapshot.menu_snapshot_id})\n")
        for item in items:
            price = f"${item.price}" if item.price is not None else "—"
            confidence = f"{float(item.normalization_confidence):.2f}" if item.normalization_confidence is not None else "?"
            print(f"  [{confidence}] {item.raw_name:<40} {price:>10}  ({item.menu_section or 'no section'})")

        null_prices = sum(1 for item in items if item.price is None)
        print(f"\n{null_prices}/{len(items)} items have no price (left null, not invented).")

        decision = "a" if auto_approve else input("\nApprove and publish? [a]pprove / [r]eject / [s]kip: ").strip().lower()

        if decision == "a":
            snapshot.extraction_status = "complete"
            db.commit()
            print("approved — now live in search.")
        elif decision == "r":
            db.query(MenuItem).filter(MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id).delete()
            snapshot.extraction_status = "pending"
            snapshot.extractor_model = None
            db.commit()
            print("rejected — items removed, snapshot reset to pending for retry.")
        else:
            print("skipped, no changes made.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
