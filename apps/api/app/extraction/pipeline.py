"""Pending snapshot -> extracted MenuItem rows, held for human review.

Writes items immediately (inspectable) but leaves the snapshot's
extraction_status at "needs_review" rather than "complete" — since
latest_snapshot_ids() only surfaces "complete"/"manual_seed" snapshots,
unreviewed extractions stay invisible to the public search API until
scripts/review_extraction.py approves them. This is deliberate: an LLM
extraction error shouldn't reach the live "trusted" menu graph unreviewed.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.config import REPO_ROOT, settings
from app.extraction.content import extract_text
from app.extraction.prompt import build_prompt
from app.extraction.schema import ExtractedItem
from app.integrations import gemini
from app.models import MenuItem, MenuSnapshot, MenuSource
from app.seed_data import CANONICAL_DISHES

_VALID_DISH_IDS = {dish["canonical_dish_id"] for dish in CANONICAL_DISHES}


class ExtractionError(Exception):
    pass


def run_extraction(db: Session, snapshot: MenuSnapshot, source: MenuSource) -> int:
    if not gemini.is_configured():
        raise ExtractionError("GEMINI_API_KEY not set")

    if not snapshot.raw_content_location:
        raise ExtractionError(f"snapshot {snapshot.menu_snapshot_id} has no stored raw content")

    raw_bytes = (REPO_ROOT / snapshot.raw_content_location).read_bytes()
    text = extract_text(raw_bytes, source.source_format)
    if not text.strip():
        raise ExtractionError("no extractable text found in raw content")

    result = gemini.extract_menu_items(build_prompt(text))
    if result is None or not result.items:
        raise ExtractionError("Gemini returned no usable items")

    for item in result.items:
        db.add(_to_menu_item(item, snapshot))

    snapshot.extraction_status = "needs_review"
    snapshot.extractor_model = settings.gemini_model
    db.commit()
    return len(result.items)


def _to_menu_item(item: ExtractedItem, snapshot: MenuSnapshot) -> MenuItem:
    # Guard against a hallucinated canonical_dish id that isn't in the real
    # taxonomy — the FK would otherwise reject the whole insert.
    canonical_dish = item.canonical_dish if item.canonical_dish in _VALID_DISH_IDS else None

    return MenuItem(
        menu_snapshot_id=snapshot.menu_snapshot_id,
        restaurant_id=snapshot.restaurant_id,
        raw_name=item.raw_name,
        raw_description=item.raw_description,
        raw_price_text=item.raw_price_text,
        price=Decimal(str(item.price)) if item.price is not None else None,
        menu_section=item.menu_section,
        canonical_category=item.canonical_category,
        canonical_dish=canonical_dish,
        protein=item.protein or None,
        pasta_type=item.pasta_type,
        sauce=item.sauce,
        preparation=item.preparation,
        ingredients=item.ingredients or None,
        dietary_tags=item.dietary_tags or None,
        portion=item.portion,
        size=item.size,
        seasonal=item.seasonal,
        market_price=item.market_price,
        available=True,
        normalization_confidence=Decimal(str(item.confidence)),
    )
