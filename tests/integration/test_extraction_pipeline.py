from uuid import uuid4

import pytest

from app.config import REPO_ROOT
from app.extraction.pipeline import ExtractionError, run_extraction
from app.extraction.schema import ExtractedItem, ExtractionResult
from app.models import MenuItem, MenuSnapshot, MenuSource

SAMPLE_HTML = b"<html><body><p>Test Dish - $12</p></body></html>"


@pytest.fixture()
def pending_snapshot(db_session):
    raw_dir = REPO_ROOT / "data" / "raw_menus" / "NE_TEST_EXTRACT"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / "sample.html"
    raw_path.write_bytes(SAMPLE_HTML)

    source = MenuSource(
        restaurant_id="NE_0002",
        menu_type="dinner",
        source_url="https://example.com/menu",
        source_format="html",
    )
    db_session.add(source)
    db_session.flush()

    snapshot = MenuSnapshot(
        restaurant_id="NE_0002",
        menu_source_id=source.menu_source_id,
        content_hash=str(uuid4()),
        raw_content_location=str(raw_path.relative_to(REPO_ROOT)),
        extraction_status="pending",
    )
    db_session.add(snapshot)
    db_session.flush()

    yield snapshot, source

    raw_path.unlink(missing_ok=True)
    raw_dir.rmdir()


def test_run_extraction_writes_items_and_marks_needs_review(db_session, pending_snapshot, monkeypatch):
    snapshot, source = pending_snapshot

    canned = ExtractionResult(
        items=[
            ExtractedItem(raw_name="Test Dish", raw_price_text="$12", price=12.0, confidence=0.95),
            ExtractedItem(raw_name="Market Special", raw_price_text=None, price=None, confidence=0.4),
        ]
    )
    monkeypatch.setattr("app.extraction.pipeline.gemini.is_configured", lambda: True)
    monkeypatch.setattr("app.extraction.pipeline.gemini.extract_menu_items", lambda prompt: canned)

    count = run_extraction(db_session, snapshot, source)

    assert count == 2
    assert snapshot.extraction_status == "needs_review"
    assert snapshot.extractor_model  # set to settings.gemini_model

    items = (
        db_session.query(MenuItem)
        .filter(MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id)
        .order_by(MenuItem.raw_name)
        .all()
    )
    assert [item.raw_name for item in items] == ["Market Special", "Test Dish"]

    market_special = items[0]
    assert market_special.price is None  # never invented, even though a price wasn't returned

    test_dish = items[1]
    assert test_dish.price == 12


def test_run_extraction_nulls_hallucinated_canonical_dish(db_session, pending_snapshot, monkeypatch):
    snapshot, source = pending_snapshot

    canned = ExtractionResult(
        items=[
            ExtractedItem(
                raw_name="Fake Dish",
                canonical_dish="NOT_A_REAL_TAXONOMY_ID",
                confidence=0.9,
            )
        ]
    )
    monkeypatch.setattr("app.extraction.pipeline.gemini.is_configured", lambda: True)
    monkeypatch.setattr("app.extraction.pipeline.gemini.extract_menu_items", lambda prompt: canned)

    run_extraction(db_session, snapshot, source)

    item = db_session.query(MenuItem).filter(MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id).one()
    assert item.canonical_dish is None


def test_run_extraction_raises_when_not_configured(db_session, pending_snapshot, monkeypatch):
    snapshot, source = pending_snapshot
    monkeypatch.setattr("app.extraction.pipeline.gemini.is_configured", lambda: False)

    with pytest.raises(ExtractionError, match="GEMINI_API_KEY"):
        run_extraction(db_session, snapshot, source)


def test_run_extraction_raises_when_gemini_returns_nothing(db_session, pending_snapshot, monkeypatch):
    snapshot, source = pending_snapshot
    monkeypatch.setattr("app.extraction.pipeline.gemini.is_configured", lambda: True)
    monkeypatch.setattr("app.extraction.pipeline.gemini.extract_menu_items", lambda prompt: None)

    with pytest.raises(ExtractionError, match="no usable items"):
        run_extraction(db_session, snapshot, source)
