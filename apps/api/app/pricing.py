from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MenuItem, MenuSnapshot, MenuSource, PriceObservation

_TAKEOUT_MENU_TYPES = {"takeout", "delivery"}


def _service_mode(menu_type: str | None) -> str:
    return "takeout" if menu_type in _TAKEOUT_MENU_TYPES else "dine_in"


def record_price_observations(db: Session, snapshot: MenuSnapshot) -> int:
    """Write one PriceObservation per priced item in `snapshot`.

    Idempotent — skips items that already have an observation, so this is
    safe to call from seed/backfill scripts and from the review-approval
    path without double-counting. Only call this once a snapshot is trusted
    (extraction_status "complete" or "manual_seed"); calling it earlier would
    let an unreviewed extraction pollute the price history.
    """
    items = list(
        db.scalars(
            select(MenuItem).where(
                MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id,
                MenuItem.price.is_not(None),
                MenuItem.market_price.is_(False),
            )
        )
    )
    if not items:
        return 0

    already = set(
        db.scalars(
            select(PriceObservation.menu_item_id).where(
                PriceObservation.menu_item_id.in_([item.menu_item_id for item in items])
            )
        )
    )

    source = db.get(MenuSource, snapshot.menu_source_id)
    service_mode = _service_mode(source.menu_type if source else None)

    written = 0
    for item in items:
        if item.menu_item_id in already:
            continue
        db.add(
            PriceObservation(
                menu_item_id=item.menu_item_id,
                restaurant_id=item.restaurant_id,
                canonical_dish=item.canonical_dish,
                price=item.price,
                service_mode=service_mode,
                observed_at=snapshot.retrieved_at,
            )
        )
        written += 1
    return written
