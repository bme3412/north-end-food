from decimal import Decimal

from app.ranking import balanced_secondary_score


BASE_SIGNALS = {
    "available": True,
    "open_now": True,
    "match_quality": 0.8,
    "rating": None,
    "review_count": None,
    "pct_vs_median": 0.0,
    "latitude": 42.3642,
    "longitude": -71.054,
}


def score(**overrides) -> float:
    return balanced_secondary_score(**(BASE_SIGNALS | overrides))


def test_available_item_beats_unavailable_comparable_item():
    assert score(available=True) > score(available=False)


def test_open_restaurant_beats_closed_comparable_restaurant():
    assert score(open_now=True) > score(open_now=False)


def test_missing_rating_is_neutral_and_deterministic():
    assert score(rating=None, review_count=None) == score(rating=None, review_count=None)
    assert score(rating=Decimal("4.8"), review_count=500) > score(rating=None, review_count=None)


def test_value_and_distance_break_comparable_matches():
    assert score(pct_vs_median=-25) > score(pct_vs_median=25)
    assert score(latitude=42.3642, longitude=-71.054) > score(latitude=42.37, longitude=-71.07)
