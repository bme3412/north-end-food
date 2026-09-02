#!/usr/bin/env python3
"""Export Place candidates, then apply only explicitly approved CSV rows."""

from __future__ import annotations
import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from sqlalchemy import select  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.integrations import places  # noqa: E402
from app.models import Restaurant, RestaurantExternalId  # noqa: E402

FIELDS = ["restaurant_id", "restaurant_name", "restaurant_address", "candidate_place_id", "candidate_name", "candidate_address", "google_maps_uri", "approved", "reviewer"]


def export_candidates(output: Path) -> None:
    if not places.is_configured():
        raise SystemExit("GOOGLE_MAPS_API_KEY not set — cannot export candidates.")
    with SessionLocal() as db:
        restaurants = list(db.scalars(select(Restaurant).where(Restaurant.active.is_(True)).order_by(Restaurant.name)))
        rows = []
        for restaurant in restaurants:
            candidates = places.find_place_candidates(restaurant.name, restaurant.address)
            if not candidates:
                rows.append({"restaurant_id": restaurant.restaurant_id, "restaurant_name": restaurant.name, "restaurant_address": restaurant.address})
            for candidate in candidates:
                rows.append({"restaurant_id": restaurant.restaurant_id, "restaurant_name": restaurant.name, "restaurant_address": restaurant.address, "candidate_place_id": candidate.place_id, "candidate_name": candidate.display_name or "", "candidate_address": candidate.formatted_address or "", "google_maps_uri": candidate.google_maps_uri or ""})
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Exported {len(rows)} candidates for {len(restaurants)} restaurants to {output}")


def apply_approvals(source: Path) -> None:
    with source.open(newline="", encoding="utf-8") as handle:
        approved = [row for row in csv.DictReader(handle) if row.get("approved", "").strip().lower() in {"yes", "true", "1"}]
    if not approved:
        raise SystemExit("No rows are explicitly approved.")
    selected = {}
    for row in approved:
        restaurant_id = row.get("restaurant_id", "").strip()
        if not restaurant_id or not row.get("candidate_place_id", "").strip() or not row.get("reviewer", "").strip():
            raise SystemExit("Every approved row needs restaurant_id, candidate_place_id, and reviewer.")
        if restaurant_id in selected:
            raise SystemExit(f"Multiple approved candidates for {restaurant_id}.")
        selected[restaurant_id] = row
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        for restaurant_id, row in selected.items():
            if db.get(Restaurant, restaurant_id) is None:
                raise SystemExit(f"Unknown restaurant_id: {restaurant_id}")
            record = db.scalar(select(RestaurantExternalId).where(RestaurantExternalId.restaurant_id == restaurant_id, RestaurantExternalId.provider == "google_places"))
            if record is None:
                record = RestaurantExternalId(restaurant_id=restaurant_id, provider="google_places", external_id="")
                db.add(record)
            record.external_id = row["candidate_place_id"].strip()
            record.external_url = row.get("google_maps_uri", "").strip() or None
            record.verification_status = "verified"
            record.verified_by = row["reviewer"].strip()
            record.verified_at = now
        db.commit()
    print(f"Applied {len(selected)} verified Place IDs")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    export_parser = commands.add_parser("export")
    export_parser.add_argument("--output", required=True, type=Path)
    apply_parser = commands.add_parser("apply")
    apply_parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    export_candidates(args.output) if args.command == "export" else apply_approvals(args.input)


if __name__ == "__main__":
    main()
