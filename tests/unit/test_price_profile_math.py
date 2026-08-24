from decimal import Decimal

from app.queries import _median


def test_median_empty_is_none():
    assert _median([]) is None


def test_median_odd_count():
    assert _median([Decimal("10"), Decimal("30"), Decimal("20")]) == Decimal("20")


def test_median_even_count_averages_middle_two():
    assert _median([Decimal("10"), Decimal("20"), Decimal("30"), Decimal("40")]) == Decimal("25")
