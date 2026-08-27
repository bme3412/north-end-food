"""Hand-labeled relevance regression suite -- schema-audit.md's flagged gap
(P21: "hand-labeled query-relevance regression set... doesn't exist"). Built
right after Phase 1 (ranking) ships, not deferred, since every later phase
in the search/indexing plan (ontology depth, embeddings, NL intent parsing)
needs a way to tell whether a change actually improved relevance rather than
just eyeballing results. Re-run before/after any ranking-weight or ontology
change.

Cases are grounded in the actual seed data (5 restaurants), not the
aspirational examples in intent-build-plan.md -- e.g. there is no
"carbonara" dish in the seed set, and canonical-dish aliases (Phase 3, not
yet built) aren't wired into search, so "four cheese pizza" doesn't resolve
to the White Pizza dish yet even though its alias list already contains
"quattro formaggio". Cases here test what Phase 1 actually shipped: fuzzy
typo tolerance and field-weighted relevance ordering.
"""

from decimal import Decimal


def test_typo_still_finds_the_intended_dish(client):
    """'canoli' is a plausible fat-finger typo for 'Cannoli'. Before Phase 1
    this returned zero results -- a bare ILIKE requires an exact substring.
    """
    response = client.get("/menu-items", params={"q": "canoli"})
    body = response.json()
    assert body["total"] >= 1
    assert any(item["raw_name"] == "Cannoli" for item in body["items"])


def test_exact_name_query_ranks_the_exact_match_first(client):
    response = client.get("/menu-items", params={"q": "cannoli"})
    body = response.json()
    assert body["total"] >= 1
    assert body["items"][0]["raw_name"] == "Cannoli"


def test_pizza_query_ranks_name_matches_above_category_only_matches(client):
    """'Cheese Pizza'/'Pepperoni Pizza' literally contain 'pizza' in
    raw_name (search_vector weight A); items that only match through
    canonical_dish/canonical_category (weight B) should rank behind them.
    """
    response = client.get("/menu-items", params={"q": "pizza"})
    body = response.json()
    assert body["total"] >= 2
    names = [item["raw_name"] for item in body["items"]]
    name_match_positions = [i for i, n in enumerate(names) if "pizza" in n.lower()]
    other_positions = [i for i, n in enumerate(names) if "pizza" not in n.lower()]
    assert name_match_positions
    if other_positions:
        assert max(name_match_positions) < min(other_positions)
    assert "pizza" in names[0].lower()


def test_places_preserve_the_best_matching_item_order(client):
    body = client.get("/menu-items", params={"q": "pizza"}).json()
    assert body["items"]
    assert body["places"]
    assert body["places"][0]["restaurant_id"] == body["items"][0]["restaurant_id"]


def test_italian_dish_name_query_finds_its_raw_text(client):
    response = client.get("/menu-items", params={"q": "quattro formaggio"})
    body = response.json()
    assert body["total"] >= 1
    assert body["items"][0]["raw_name"] == "Quattro Formaggio"
    assert body["items"][0]["canonical_dish"] == "WHITE_PIZZA"


def test_dish_alias_finds_dishes_with_no_matching_literal_text(client):
    """intent-build-plan.md's own flagship example: "four cheese pizza"
    matches nothing in raw_name/description/category text (the closest
    seeded item is literally named "Quattro Formaggio"), and previously
    returned zero results even after alias search was wired in, because
    the alias list itself lacked the English phrase. Regression case for
    both fixes together: dish_match_clause querying CanonicalDish.aliases,
    plus "four cheese"/"four cheese pizza" added to WHITE_PIZZA's aliases.
    """
    response = client.get("/menu-items", params={"q": "four cheese pizza"})
    body = response.json()
    assert body["total"] >= 1
    assert any(item["canonical_dish"] == "WHITE_PIZZA" for item in body["items"])


def test_category_and_price_combine_in_free_text(client):
    response = client.get("/menu-items", params={"q": "pasta under 25"})
    body = response.json()
    assert body["total"] >= 1
    pasta_category_items = [item for item in body["items"] if item["canonical_category"] == "pasta"]
    assert pasta_category_items
    for item in body["items"]:
        assert item["price"] is None or Decimal(item["price"]) <= Decimal("25")
        haystack = f"{item['raw_name']} {item['canonical_category']} {item['raw_description'] or ''}".lower()
        assert "pasta" in haystack


def test_dietary_and_price_combine_in_free_text(client):
    response = client.get("/menu-items", params={"q": "gluten free under 20"})
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert "gluten-free" in (item["dietary_tags"] or [])
        assert item["price"] is None or Decimal(item["price"]) <= Decimal("20")


def test_seafood_pasta_surfaces_the_canonical_seafood_pasta_dish(client):
    response = client.get("/menu-items", params={"q": "seafood pasta"})
    body = response.json()
    assert body["total"] >= 1
    assert any(item["canonical_dish"] == "SEAFOOD_PASTA" for item in body["items"])
