import pytest

from app.integrations import places


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeHTTPClient:
    """Stands in for httpx.Client(...) as a context manager."""

    def __init__(self, payload, capture=None):
        self._payload = payload
        self._capture = capture

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, headers=None):
        if self._capture is not None:
            self._capture.update(method="GET", url=url, headers=headers)
        return FakeResponse(self._payload)

    def post(self, url, headers=None, json=None):
        if self._capture is not None:
            self._capture.update(method="POST", url=url, headers=headers, json=json)
        return FakeResponse(self._payload)


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(places.settings, "google_maps_api_key", "test-key")


def test_not_configured_short_circuits_without_network_call(monkeypatch):
    monkeypatch.setattr(places.settings, "google_maps_api_key", None)

    def boom(*args, **kwargs):
        raise AssertionError("should not construct an httpx client when unconfigured")

    monkeypatch.setattr(places.httpx, "Client", boom)

    assert places.find_place_id("Neptune Oyster", "63 Salem St") is None
    assert places.fetch_place_details("some-id") is None


def test_find_place_id_returns_first_match(monkeypatch):
    capture = {}
    fake = FakeHTTPClient({"places": [{"id": "ChIJ_first"}, {"id": "ChIJ_second"}]}, capture)
    monkeypatch.setattr(places.httpx, "Client", lambda timeout: fake)

    place_id = places.find_place_id("Neptune Oyster", "63 Salem St, Boston, MA")
    assert place_id == "ChIJ_first"
    assert capture["method"] == "POST"
    assert capture["headers"]["X-Goog-Api-Key"] == "test-key"
    assert "Neptune Oyster" in capture["json"]["textQuery"]


def test_find_place_id_no_results_returns_none(monkeypatch):
    fake = FakeHTTPClient({"places": []})
    monkeypatch.setattr(places.httpx, "Client", lambda timeout: fake)

    assert places.find_place_id("Nowhere", "nowhere") is None


def test_fetch_place_details_parses_full_response(monkeypatch):
    payload = {
        "rating": 4.6,
        "userRatingCount": 3200,
        "priceLevel": "PRICE_LEVEL_EXPENSIVE",
        "regularOpeningHours": {
            "openNow": True,
            "weekdayDescriptions": ["Monday: 11:00 AM – 10:00 PM", "Tuesday: 11:00 AM – 10:00 PM"],
        },
        "googleMapsUri": "https://maps.google.com/?cid=123",
        "generativeSummary": {
            "overview": {"text": "A lively seafood spot known for lobster rolls.", "languageCode": "en-US"},
            "disclosureText": {"text": "Summarized with Gemini", "languageCode": "en-US"},
        },
        "reviewSummary": {
            "text": {"text": "Reviewers love the raw bar but note long waits.", "languageCode": "en-US"},
            "disclosureText": {"text": "Summarized with Gemini", "languageCode": "en-US"},
            "reviewsUri": "https://maps.google.com/reviews/123",
        },
    }
    capture = {}
    fake = FakeHTTPClient(payload, capture)
    monkeypatch.setattr(places.httpx, "Client", lambda timeout: fake)

    details = places.fetch_place_details("ChIJ_neptune")

    assert capture["method"] == "GET"
    assert "ChIJ_neptune" in capture["url"]
    assert details.rating == 4.6
    assert details.review_count == 3200
    assert details.price_level == 3  # PRICE_LEVEL_EXPENSIVE -> 3
    assert details.open_now is True
    assert "Monday" in details.hours_summary
    assert details.maps_uri == "https://maps.google.com/?cid=123"
    assert details.place_summary == "A lively seafood spot known for lobster rolls."
    assert details.place_summary_disclosure == "Summarized with Gemini"
    assert details.review_summary == "Reviewers love the raw bar but note long waits."
    assert details.review_summary_disclosure == "Summarized with Gemini"
    assert details.reviews_uri == "https://maps.google.com/reviews/123"


def test_fetch_place_details_handles_missing_optional_fields(monkeypatch):
    # Place summaries/review summaries aren't guaranteed for every place.
    fake = FakeHTTPClient({"rating": 4.1, "userRatingCount": 50})
    monkeypatch.setattr(places.httpx, "Client", lambda timeout: fake)

    details = places.fetch_place_details("ChIJ_no_summary")

    assert details.rating == 4.1
    assert details.price_level is None
    assert details.place_summary is None
    assert details.review_summary is None
    assert details.reviews_uri is None
