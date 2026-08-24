#!/usr/bin/env python3
"""Fetch a menu URL, hash it, and store a snapshot. Does not extract items (Phase 1)."""

from __future__ import annotations

import argparse
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

import httpx  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import MenuSnapshot, MenuSource, Restaurant  # noqa: E402


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def ingest(restaurant_id: str, menu_url: str, menu_type: str = "dinner") -> int:
    db = SessionLocal()
    try:
        restaurant = db.scalar(select(Restaurant).where(Restaurant.restaurant_id == restaurant_id))
        if restaurant is None:
            print(f"error: unknown restaurant_id {restaurant_id}", file=sys.stderr)
            return 1

        print(f"fetching {menu_url}")
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            response = client.get(menu_url, headers={"User-Agent": "north-end-food-graph/0.1"})
            response.raise_for_status()
            body = response.content

        content_hash = sha256_bytes(body)
        now = datetime.now(timezone.utc)

        source = db.scalar(
            select(MenuSource).where(
                MenuSource.restaurant_id == restaurant_id,
                MenuSource.source_url == menu_url,
            )
        )
        if source is None:
            source = MenuSource(
                restaurant_id=restaurant_id,
                menu_type=menu_type,
                source_url=menu_url,
                source_format="html",
                active=True,
            )
            db.add(source)
            db.flush()

        source.last_checked_at = now

        previous = db.scalar(
            select(MenuSnapshot)
            .where(MenuSnapshot.menu_source_id == source.menu_source_id)
            .order_by(MenuSnapshot.retrieved_at.desc())
            .limit(1)
        )
        if previous is not None and previous.content_hash == content_hash:
            db.commit()
            print(f"unchanged hash={content_hash} snapshot={previous.menu_snapshot_id}")
            return 0

        snapshot = MenuSnapshot(
            restaurant_id=restaurant_id,
            menu_source_id=source.menu_source_id,
            retrieved_at=now,
            content_hash=content_hash,
            extraction_status="pending",
            extractor_model=None,
            schema_version="v1",
        )
        db.add(snapshot)
        db.flush()

        dest_dir = settings.resolved_raw_menu_dir / restaurant_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{snapshot.menu_snapshot_id}.bin"
        dest.write_bytes(body)
        snapshot.raw_content_location = str(dest.relative_to(ROOT))
        db.commit()

        print(f"stored snapshot={snapshot.menu_snapshot_id} hash={content_hash} bytes={len(body)}")
        print("extraction skipped (Phase 1). status=pending")
        return 0
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("restaurant_id", help="Internal id such as NE_0001")
    parser.add_argument("menu_url", help="Official menu URL")
    parser.add_argument("--menu-type", default="dinner")
    args = parser.parse_args()
    raise SystemExit(ingest(args.restaurant_id, args.menu_url, args.menu_type))


if __name__ == "__main__":
    main()
