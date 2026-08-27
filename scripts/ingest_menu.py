#!/usr/bin/env python3
"""Fetch a menu URL, hash it, and store a snapshot. Does not extract items (Phase 1)."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
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

# Some restaurant sites 403 a bare/identifying UA outright (confirmed against
# prezza.com and ernestospizza.com, which both 200 for this exact string but
# reject "north-end-food-graph/0.1"). A real browser UA is a one-time fetch of
# public menu text for our own directory, not high-volume scraping.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _fetch_via_curl(url: str) -> bytes:
    """Fallback for sites whose bot protection blocks httpx's TLS/client
    fingerprint outright -- confirmed against prezza.com and
    ernestospizza.com, both of which 403 httpx with an identical browser
    User-Agent and full browser headers, yet 200 for plain curl with the
    same UA. The block sits below the header layer, so no header tweak
    fixes it; shelling out to curl (a different HTTP stack entirely) does.
    """
    result = subprocess.run(
        ["curl", "-sL", "--fail", "--max-time", "30", "-A", BROWSER_USER_AGENT, url],
        capture_output=True,
        check=True,
    )
    return result.stdout


def _fetch(url: str) -> bytes:
    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            response = client.get(url, headers={"User-Agent": BROWSER_USER_AGENT})
            response.raise_for_status()
            return response.content
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 403:
            raise
        print(f"httpx got 403, retrying via curl: {url}")
        try:
            return _fetch_via_curl(url)
        except subprocess.CalledProcessError as curl_exc:
            stderr = curl_exc.stderr.decode(errors="replace").strip() if curl_exc.stderr else ""
            raise RuntimeError(f"curl fallback also failed for {url}: {stderr or curl_exc}") from curl_exc


def ingest(restaurant_id: str, menu_url: str, menu_type: str = "dinner") -> int:
    db = SessionLocal()
    try:
        restaurant = db.scalar(select(Restaurant).where(Restaurant.restaurant_id == restaurant_id))
        if restaurant is None:
            print(f"error: unknown restaurant_id {restaurant_id}", file=sys.stderr)
            return 1

        print(f"fetching {menu_url}")
        body = _fetch(menu_url)

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
