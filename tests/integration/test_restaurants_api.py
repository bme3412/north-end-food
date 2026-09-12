from datetime import datetime, timezone

import httpx

from app.integrations.photo_cache import clear_photo_cache
from app.integrations.places import PhotoAuthor, PlacePhoto
from app.integrations.rate_limit import reset_photo_rate_limiter
from app.models import ExternalApiUsage, RestaurantExternalId
from app.routers import restaurants as restaurants_router


def test_health_requires_database(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_restaurants_returns_forty_four_active(client):
    response = client.get("/restaurants")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 44
    ids = {row["restaurant_id"] for row in body}
    assert ids == {f"NE_{i:04d}" for i in range(1, 46)} - {"NE_0012"}
    owned_photo_ids = {"NE_0001", "NE_0003"}
    assert all(row["photo_url"] for row in body if row["restaurant_id"] in owned_photo_ids)


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


def test_removed_restaurant_is_not_public(client):
    response = client.get("/restaurants/NE_0012")
    assert response.status_code == 404


def test_get_restaurant_detail_shape(client):
    response = client.get("/restaurants/NE_0002")
    assert response.status_code == 200
    body = response.json()

    assert body["name"] == "Neptune Oyster"
    assert body["item_count"] > 0

    # Google Places / SerpApi are wired but unconfigured in tests -> null, not fabricated.
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


def _verified_google_id(db_session, restaurant_id="NE_0002"):
    db_session.add(RestaurantExternalId(
        restaurant_id=restaurant_id, provider="google_places", external_id="ChIJ_verified",
        external_url="https://maps.google.com/place/verified", verification_status="verified",
        verified_by="Test reviewer", verified_at=datetime.now(timezone.utc),
    ))
    db_session.commit()


def _reset_photo_guards():
    clear_photo_cache()
    reset_photo_rate_limiter()


def _sample_photo() -> PlacePhoto:
    return PlacePhoto(
        "https://lh3.googleusercontent.com/ephemeral", 1200, 800,
        "https://maps.google.com/photo/source", "https://maps.google.com/photo/report",
        (PhotoAuthor("Author", "https://maps.google.com/author", "https://example.com/avatar"),),
    )


def test_google_photo_success_is_ephemeral_and_attributed(client, db_session, monkeypatch):
    _reset_photo_guards()
    _verified_google_id(db_session)
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    monkeypatch.setattr(restaurants_router, "reserve_monthly_attempt", lambda *args, **kwargs: True)
    monkeypatch.setattr(restaurants_router.places, "fetch_place_photo", lambda *args, **kwargs: _sample_photo())
    response = client.get("/restaurants/NE_0002/google-photo?variant=hero")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json()["authors"][0]["display_name"] == "Author"
    assert "test-key" not in response.text


def test_google_photo_requires_verified_place(client, monkeypatch):
    _reset_photo_guards()
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    response = client.get("/restaurants/NE_0002/google-photo")
    assert response.status_code == 404
    assert response.headers["cache-control"] == "private, no-store"


def test_owned_photo_takes_precedence(client, monkeypatch):
    _reset_photo_guards()
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    monkeypatch.setattr(restaurants_router, "reserve_monthly_attempt", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("quota used")))
    assert client.get("/restaurants/NE_0001/google-photo").status_code == 404


def test_google_photo_monthly_cap(client, db_session, monkeypatch):
    _reset_photo_guards()
    _verified_google_id(db_session)
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    monkeypatch.setattr(restaurants_router, "reserve_monthly_attempt", lambda *args, **kwargs: False)
    assert client.get("/restaurants/NE_0002/google-photo").status_code == 429


def test_google_photo_disabled(client, db_session, monkeypatch):
    _reset_photo_guards()
    _verified_google_id(db_session)
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: False)
    assert client.get("/restaurants/NE_0002/google-photo").status_code == 503


def test_google_photo_failed_fetch_does_not_consume_quota(client, db_session, monkeypatch):
    _reset_photo_guards()
    _verified_google_id(db_session)
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    monkeypatch.setattr(restaurants_router.settings, "google_place_photo_monthly_cap", 900)

    def boom(*_args, **_kwargs):
        raise httpx.HTTPError("unavailable")

    monkeypatch.setattr(restaurants_router.places, "fetch_place_photo", boom)
    assert client.get("/restaurants/NE_0002/google-photo").status_code == 503
    usage = db_session.get(ExternalApiUsage, ("google_places", "photo_media", datetime.now(timezone.utc).date().replace(day=1)))
    assert usage is None or usage.attempt_count == 0


def test_google_photo_cache_skips_second_places_call(client, db_session, monkeypatch):
    _reset_photo_guards()
    _verified_google_id(db_session)
    calls = {"n": 0}

    def fetch(*_args, **_kwargs):
        calls["n"] += 1
        return _sample_photo()

    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    monkeypatch.setattr(restaurants_router.places, "fetch_place_photo", fetch)
    assert client.get("/restaurants/NE_0002/google-photo?variant=card").status_code == 200
    assert client.get("/restaurants/NE_0002/google-photo?variant=card").status_code == 200
    assert calls["n"] == 1


def test_google_photo_ip_limit_returns_429(client, db_session, monkeypatch):
    _reset_photo_guards()
    _verified_google_id(db_session)
    monkeypatch.setattr(restaurants_router.places, "photos_are_configured", lambda: True)
    monkeypatch.setattr(restaurants_router.places, "fetch_place_photo", lambda *_args, **_kwargs: _sample_photo())
    monkeypatch.setattr("app.integrations.rate_limit.PHOTO_IP_LIMIT", 1)
    monkeypatch.setattr(restaurants_router, "allow_photo_request", lambda ip: (False, 12) if ip else (False, 12))
    response = client.get("/restaurants/NE_0002/google-photo?variant=hero")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "12"
