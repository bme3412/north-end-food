from decimal import Decimal

import pytest


def test_free_text_price_query(client):
    response = client.get("/menu-items", params={"q": "lobster ravioli under $35"})
    assert response.status_code == 200
    body = response.json()
    assert body["parsed_tokens"] == ["lobster", "ravioli"]
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["price"] is None or Decimal(item["price"]) <= Decimal("35")
        haystack = " ".join(
            filter(
                None,
                [item["raw_name"], item["raw_description"], item["canonical_category"], item["canonical_dish"]],
            )
        ).lower()
        assert "lobster" in haystack or "ravioli" in haystack


def test_dietary_filter_vegetarian(client):
    response = client.get("/menu-items", params={"dietary": "vegetarian"})
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["dietary_tags"] and "vegetarian" in item["dietary_tags"]


def test_protein_mode_all_requires_every_protein(client):
    response = client.get("/menu-items", params={"protein": "lobster,shrimp", "protein_mode": "all"})
    body = response.json()
    for item in body["items"]:
        proteins = set(item["protein"] or [])
        assert {"lobster", "shrimp"}.issubset(proteins)


def test_priced_only_excludes_market_and_null_prices(client):
    response = client.get("/menu-items", params={"priced_only": "true"})
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["price"] is not None
        assert item["market_price"] is False


def test_restaurant_scoped_search(client):
    response = client.get("/menu-items", params={"restaurant_id": "NE_0002"})
    body = response.json()
    assert body["total"] > 0
    assert all(item["restaurant_id"] == "NE_0002" for item in body["items"])
    assert len(body["places"]) == 1
    assert body["places"][0]["restaurant_id"] == "NE_0002"


def test_meta_reflects_seeded_data(client):
    response = client.get("/menu-items/meta")
    body = response.json()
    assert "vegetarian" in body["dietary"]
    assert body["min_price"] is not None
    assert body["max_price"] is not None
    assert body["min_price"] <= body["max_price"]


def test_meta_exposes_subcategory_and_ingredient_category_facets(client):
    response = client.get("/menu-items/meta")
    body = response.json()
    assert body["subcategories"]
    assert body["ingredient_categories"]
    assert "cheese" in body["ingredient_categories"]


def test_subcategory_filter_matches_only_dishes_in_that_subcategory(client):
    meta = client.get("/menu-items/meta").json()
    subcategory = meta["subcategories"][0]
    response = client.get("/menu-items", params={"subcategory": subcategory})
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["canonical_dish"] is not None


def test_meta_ingredients_facet_is_canonical_and_deduped(client):
    response = client.get("/menu-items/meta")
    body = response.json()
    assert "Mushroom" in body["ingredients"]
    # Deduped: "mushroom" and "mushrooms" collapse to one canonical facet value.
    assert body["ingredients"].count("Mushroom") == 1


def test_ingredient_filter_matches_plural_variant(client):
    response = client.get("/menu-items", params={"ingredient": "mushroom"})
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        haystack = " ".join(i.lower() for i in (item["ingredients"] or []))
        assert "mushroom" in haystack


def test_ingredient_filter_matches_across_spelling_variants(client):
    # Seed data has items spelled both "bufala mozzarella" and "buffalo
    # mozzarella"; searching the anglicized spelling should find both via
    # the shared canonical ingredient's alias list, not a raw-text
    # substring match (which could never catch the "bufala" item).
    response = client.get("/menu-items", params={"ingredient": "buffalo mozzarella"})
    body = response.json()
    assert body["total"] >= 1
    raw_ingredient_lists = [set(i.lower() for i in (item["ingredients"] or [])) for item in body["items"]]
    assert any("bufala mozzarella" in ingredients for ingredients in raw_ingredient_lists)


def test_ingredient_mode_all_requires_every_ingredient(client):
    response = client.get(
        "/menu-items", params={"ingredient": "mozzarella,tomato", "ingredient_mode": "all"}
    )
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        haystack = " ".join(i.lower() for i in (item["ingredients"] or []))
        assert "mozzarella" in haystack
        assert "tomato" in haystack


def test_free_text_search_matches_across_spelling_variants(client):
    response = client.get("/menu-items", params={"q": "buffalo mozzarella"})
    body = response.json()
    assert body["total"] >= 1


def test_open_now_filter_partitions_results_by_computed_status(client):
    # Deliberately doesn't assert *which* restaurants are open -- that's
    # time-dependent (the whole point of app/hours.is_open_now) and would
    # make this test flaky depending on when it runs. Only asserts the
    # filter actually partitions the full result set correctly.
    unfiltered = client.get("/menu-items").json()
    open_now = client.get("/menu-items", params={"open_now": "true"}).json()
    closed_now = client.get("/menu-items", params={"open_now": "false"}).json()

    assert open_now["total"] + closed_now["total"] == unfiltered["total"]
    for item in open_now["items"]:
        assert item["open_now"] is True
    for item in closed_now["items"]:
        assert item["open_now"] is False


def test_every_seeded_item_carries_hours_summary(client):
    # All 5 seeded restaurants have hand-curated Restaurant.hours.
    response = client.get("/menu-items")
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["hours_summary"]
        assert item["open_now"] is not None


def test_menu_item_not_found(client):
    response = client.get("/menu-items/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_priced_items_carry_a_north_end_median(client):
    response = client.get("/menu-items", params={"priced_only": "true"})
    body = response.json()
    assert body["total"] >= 1
    with_median = [item for item in body["items"] if item["canonical_category"] or item["canonical_dish"]]
    assert with_median
    for item in with_median:
        assert item["north_end_median_price"] is not None
        assert item["pct_vs_median"] is not None


def test_pct_vs_median_matches_its_own_price(client):
    response = client.get("/menu-items", params={"priced_only": "true"})
    body = response.json()
    for item in body["items"]:
        median = item["north_end_median_price"]
        pct = item["pct_vs_median"]
        if median is None:
            assert pct is None
            continue
        expected = float((Decimal(item["price"]) / Decimal(median) - 1) * 100)
        assert pct == pytest.approx(expected, abs=0.01)


def test_market_price_items_have_no_pct_vs_median(client):
    response = client.get("/menu-items")
    body = response.json()
    for item in body["items"]:
        if item["market_price"]:
            assert item["pct_vs_median"] is None
