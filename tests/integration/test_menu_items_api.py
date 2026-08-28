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


def test_restaurant_photo_propagates_to_items_and_places(client):
    response = client.get("/menu-items", params={"restaurant_id": "NE_0003"})
    body = response.json()
    assert body["items"]
    expected = "/restaurant-photos/pizzeria-regina.jpg"
    assert all(item["photo_url"] == expected for item in body["items"])
    assert body["places"][0]["photo_url"] == expected


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


def test_places_carry_open_now_and_hours_summary(client):
    response = client.get("/menu-items", params={"restaurant_id": "NE_0002"})
    body = response.json()
    place = body["places"][0]
    assert place["open_now"] is not None
    assert place["hours_summary"]
    # Every item at a restaurant shares that restaurant's open/closed status.
    assert all(item["open_now"] == place["open_now"] for item in body["items"])


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


def test_service_mode_filter_excludes_only_confirmed_false(client, db_session):
    from app.models import RestaurantPlaceStats

    # NE_0002 explicitly does not offer takeout, per Google; every other
    # seeded restaurant's takeout status is left unset (null/unknown) and
    # must NOT be excluded just because we don't have an answer yet.
    db_session.add(RestaurantPlaceStats(restaurant_id="NE_0002", takeout=False))
    db_session.commit()

    unfiltered = client.get("/menu-items").json()
    takeout_only = client.get("/menu-items", params={"service_mode": "takeout"}).json()

    assert takeout_only["total"] < unfiltered["total"]
    assert all(item["restaurant_id"] != "NE_0002" for item in takeout_only["items"])
    assert any(item["restaurant_id"] == "NE_0001" for item in takeout_only["items"])


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


def test_list_pagination_keeps_map_places_on_the_same_page(client):
    full = client.get("/menu-items", params={"priced_only": "true"}).json()
    page = client.get("/menu-items", params={"priced_only": "true", "limit": 3, "offset": 1}).json()

    assert page["total"] == full["total"]
    assert len(page["items"]) == 3
    assert page["items"] == full["items"][1:4]

    page_restaurant_ids = []
    for item in page["items"]:
        if item["restaurant_id"] not in page_restaurant_ids:
            page_restaurant_ids.append(item["restaurant_id"])
    assert [place["restaurant_id"] for place in page["places"]] == page_restaurant_ids
    assert {place["restaurant_id"] for place in page["places"]} <= {
        place["restaurant_id"] for place in full["places"]
    }


def test_pizza_serving_filter_keeps_slice_and_whole_price_benchmarks_separate(client, db_session):
    from sqlalchemy import select

    from app.models import MenuItem

    pizzas = list(
        db_session.scalars(
            select(MenuItem).where(
                MenuItem.canonical_category == "pizza",
                MenuItem.canonical_dish == "CHEESE_PIZZA",
            )
        )
    )
    assert len(pizzas) >= 2
    slice_item, whole_item = pizzas[:2]
    slice_item.raw_name = "Cheese Pizza Slice"
    slice_item.portion = "slice"
    slice_item.size = None
    slice_item.price = Decimal("5")
    whole_item.portion = "whole"
    whole_item.size = "16 inch"
    whole_item.price = Decimal("25")
    db_session.commit()

    slices = client.get(
        "/menu-items",
        params={"canonical_dish": "CHEESE_PIZZA", "pizza_serving": "slice"},
    ).json()
    whole = client.get(
        "/menu-items",
        params={"canonical_dish": "CHEESE_PIZZA", "pizza_serving": "whole"},
    ).json()

    assert slices["total"] == 1
    assert slices["items"][0]["pizza_serving"] == "slice"
    assert Decimal(slices["items"][0]["north_end_median_price"]) == Decimal("5")
    assert whole["total"] >= 1
    assert all(item["pizza_serving"] == "whole" for item in whole["items"])
    assert all(Decimal(item["north_end_median_price"]) != Decimal("5") for item in whole["items"])
