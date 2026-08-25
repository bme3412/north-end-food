def test_list_restaurants_returns_thirty_active(client):
    response = client.get("/restaurants")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 30
    ids = {row["restaurant_id"] for row in body}
    assert ids == {f"NE_{i:04d}" for i in range(1, 31)}
    # Only the original 5 hand-curated restaurants have real photos; the
    # 25 added later (see migration 015) rely on RestaurantPhoto's
    # monogram-avatar fallback instead of a fabricated image path.
    original_five = {"NE_0001", "NE_0002", "NE_0003", "NE_0004", "NE_0005"}
    assert all(row["photo_url"] for row in body if row["restaurant_id"] in original_five)


def test_list_restaurants_open_now_filter_partitions(client):
    unfiltered = client.get("/restaurants").json()
    open_now = client.get("/restaurants", params={"open_now": "true"}).json()
    closed_now = client.get("/restaurants", params={"open_now": "false"}).json()

    assert len(open_now) + len(closed_now) == len(unfiltered)
    assert all(row["open_now"] is True for row in open_now)
    assert all(row["open_now"] is False for row in closed_now)


def test_list_restaurants_carries_hours_summary(client):
    body = client.get("/restaurants").json()
    assert all(row["hours_summary"] for row in body)


def test_get_restaurant_not_found(client):
    response = client.get("/restaurants/NE_9999")
    assert response.status_code == 404


def test_get_restaurant_detail_shape(client):
    response = client.get("/restaurants/NE_0002")
    assert response.status_code == 200
    body = response.json()

    assert body["name"] == "Neptune Oyster"
    assert body["item_count"] > 0

    # Google Places / BestTime are wired but unconfigured in tests -> null, not fabricated.
    assert body["rating"] is None
    assert body["review_count"] is None
    assert body["weekly_popularity"] is None

    profile = body["price_profile"]
    assert profile["restaurant_median"] is not None
    assert profile["north_end_median"] is not None
    assert any(c["category"] == "seafood" for c in profile["categories"])

    labels = {entry["label"] for entry in body["provenance"]}
    assert labels == {"Menu", "Categories", "Rating", "Crowd"}
    by_label = {entry["label"]: entry for entry in body["provenance"]}
    assert by_label["Menu"]["status"] == "connected"
    assert by_label["Categories"]["confidence"] is not None
    assert by_label["Rating"]["status"] == "not_connected"
    assert by_label["Crowd"]["status"] == "not_connected"


def test_price_profile_matches_direct_computation(client, db_session):
    from app.queries import price_profile

    expected = price_profile(db_session, "NE_0001")
    response = client.get("/restaurants/NE_0001")
    body = response.json()["price_profile"]

    assert body["restaurant_median"] == str(expected.restaurant_median)
    assert body["north_end_median"] == str(expected.north_end_median)


def test_modern_pastry_has_no_priced_items(client):
    # Modern Pastry's prices are honestly null in the seed data (never invented).
    response = client.get("/restaurants/NE_0004")
    body = response.json()
    assert body["price_profile"]["restaurant_median"] is None
    assert body["price_profile"]["categories"] == []
