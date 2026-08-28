"""Integrity checks for the NE_0031–NE_0045 seed wave (no database)."""

from app.seed_wave2 import WAVE2_RESTAURANTS


def test_wave2_covers_fifteen_sequential_ids():
    ids = [row["restaurant_id"] for row in WAVE2_RESTAURANTS]
    assert ids == [f"NE_{i:04d}" for i in range(31, 46)]
    assert len({row["slug"] for row in WAVE2_RESTAURANTS}) == 15


def test_wave2_restaurants_all_have_hours_and_a_source():
    for row in WAVE2_RESTAURANTS:
        assert row["hours"], f"{row['restaurant_id']} is missing hours"
        assert row["sources"], f"{row['restaurant_id']} is missing a menu source"
        assert row["latitude"] and row["longitude"]
        assert row["items"], f"{row['restaurant_id']} has no dishes"


def test_wave2_items_never_invent_a_price_without_raw_text():
    for row in WAVE2_RESTAURANTS:
        for dish in row["items"]:
            if dish["price"] is not None:
                assert dish["raw_price_text"], f"{row['name']}: {dish['raw_name']} has a price but no raw_price_text"
