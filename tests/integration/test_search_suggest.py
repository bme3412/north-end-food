from app.queries import resolve_search_intent, suggest_search


def test_suggest_requires_at_least_two_characters(client):
    empty = client.get("/search/suggest", params={"q": ""}).json()
    assert empty["restaurants"] == []
    assert empty["dishes"] == []

    short = client.get("/search/suggest", params={"q": "n"}).json()
    assert short["restaurants"] == []
    assert short["dishes"] == []


def test_suggest_returns_matching_restaurants(client):
    body = client.get("/search/suggest", params={"q": "nep"}).json()
    names = [row["name"] for row in body["restaurants"]]
    assert any("Neptune" in name for name in names)
    neptune = next(row for row in body["restaurants"] if "Neptune" in row["name"])
    assert neptune["restaurant_id"] == "NE_0002"


def test_suggest_returns_matching_dishes(client):
    body = client.get("/search/suggest", params={"q": "carbonara"}).json()
    dishes = [row["canonical_dish"] for row in body["dishes"]]
    assert "CARBONARA" in dishes
    carbonara = next(row for row in body["dishes"] if row["canonical_dish"] == "CARBONARA")
    assert carbonara["restaurant_count"] >= 1
    assert carbonara["canonical_name"]


def test_suggest_caps_each_group(client):
    body = client.get("/search/suggest", params={"q": "pizza"}).json()
    assert len(body["restaurants"]) <= 5
    assert len(body["dishes"]) <= 5


def test_resolve_search_intent_unique_restaurant(db_session):
    intent = resolve_search_intent(db_session, "Neptune Oyster")
    assert intent.restaurant_id == "NE_0002"
    assert intent.restaurant_name == "Neptune Oyster"
    assert intent.dish is None
    assert intent.category is None


def test_resolve_search_intent_dish_not_restaurant(db_session):
    intent = resolve_search_intent(db_session, "carbonara")
    assert intent.dish == "CARBONARA"
    assert intent.restaurant_id is None


def test_resolve_search_intent_ignores_qualified_category_query(db_session):
    intent = resolve_search_intent(db_session, "pasta under $25")
    assert intent.category is None
    assert intent.dish is None
    assert intent.restaurant_id is None


def test_suggest_search_helper_matches_router(db_session):
    result = suggest_search(db_session, "nep")
    assert any(row.restaurant_id == "NE_0002" for row in result.restaurants)
    empty = suggest_search(db_session, "x")
    assert empty.restaurants == []
    assert empty.dishes == []
