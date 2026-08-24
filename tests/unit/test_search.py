from decimal import Decimal

from app.search import parse_query


def test_empty_query():
    parsed = parse_query(None)
    assert parsed.tokens == []
    assert parsed.min_price is None
    assert parsed.max_price is None
    assert parsed.dietary == ()

    assert parse_query("   ") == parsed


def test_plain_tokens_strip_stopwords():
    parsed = parse_query("the lobster ravioli with butter")
    assert parsed.tokens == ["lobster", "ravioli", "butter"]


def test_under_price():
    parsed = parse_query("lobster ravioli under $35")
    assert parsed.tokens == ["lobster", "ravioli"]
    assert parsed.max_price == Decimal("35")
    assert parsed.min_price is None


def test_over_price_alias_at_least():
    parsed = parse_query("pasta at least $20")
    assert parsed.min_price == Decimal("20")
    assert parsed.max_price is None


def test_between_price():
    parsed = parse_query("pasta between $25 and $40")
    assert parsed.min_price == Decimal("25")
    assert parsed.max_price == Decimal("40")
    assert parsed.tokens == ["pasta"]


def test_between_price_with_dash():
    parsed = parse_query("pasta between 25-40")
    assert parsed.min_price == Decimal("25")
    assert parsed.max_price == Decimal("40")


def test_bare_comparison_operators():
    under = parse_query("cannoli <$10")
    assert under.max_price == Decimal("10")

    over = parse_query("cannoli >10")
    assert over.min_price == Decimal("10")


def test_dietary_aliases_deduped_and_normalized():
    parsed = parse_query("vegan, veggie, gluten-free pasta")
    assert parsed.dietary == ("vegetarian", "gluten-free")
    assert parsed.tokens == ["pasta"]


def test_dietary_alias_gf_shorthand():
    parsed = parse_query("gf pizza")
    assert parsed.dietary == ("gluten-free",)
    assert parsed.tokens == ["pizza"]


def test_comma_separated_proteins_are_separate_tokens():
    parsed = parse_query("lobster, shrimp, scallops")
    assert parsed.tokens == ["lobster", "shrimp", "scallops"]


def test_price_phrase_removed_from_tokens_leaves_rest_intact():
    parsed = parse_query("vegetarian pizza under $25 gluten-free")
    assert parsed.max_price == Decimal("25")
    assert parsed.dietary == ("vegetarian", "gluten-free")
    assert parsed.tokens == ["pizza"]
