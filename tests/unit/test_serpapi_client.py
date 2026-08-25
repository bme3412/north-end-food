import pytest

from app.integrations import serpapi


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeHTTPClient:
    def __init__(self, payload):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, params=None):
        return FakeResponse(self._payload)


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(serpapi.settings, "serpapi_key", "test_key")


def test_parse_hour_label():
    assert serpapi._parse_hour_label("12 AM") == 0
    assert serpapi._parse_hour_label("1 AM") == 1
    assert serpapi._parse_hour_label("11 AM") == 11
    assert serpapi._parse_hour_label("12 PM") == 12
    assert serpapi._parse_hour_label("1 PM") == 13
    assert serpapi._parse_hour_label("11 PM") == 23
    assert serpapi._parse_hour_label("garbage") is None


def test_hourly_row_treats_missing_info_as_no_reading():
    entries = [
        {"time": "10 AM", "busyness_score": 0},  # no `info` -> closed/no data, not a real 0
        {"time": "12 PM", "info": "Usually not too busy", "busyness_score": 26},
        {"time": "6 PM", "info": "Usually a little busy", "busyness_score": 44},
    ]
    row = serpapi._hourly_row(entries)
    assert row[10] is None
    assert row[12] == 0.26
    assert row[18] == 0.44
    assert row[0] is None  # hour never mentioned at all


def test_day_mean_ignores_none():
    assert serpapi._day_mean([None, 0.5, None, 0.3]) == 0.4
    assert serpapi._day_mean([None] * 24) == 0.0


def test_peak_hours_text_range_and_single_and_empty():
    row = [None] * 24
    row[18] = 0.7
    row[19] = 0.9
    row[20] = 0.9
    row[21] = 0.4
    assert serpapi._peak_hours_text(row) == "7 PM-8 PM"

    single = [None] * 24
    single[12] = 0.5
    assert serpapi._peak_hours_text(single) == "12 PM"

    assert serpapi._peak_hours_text([None] * 24) is None


def _day(entries):
    return entries


def test_fetch_popular_times_end_to_end(monkeypatch):
    def day_entries(base_score, current_hour=None):
        entries = []
        for hour in range(11, 22):
            entry = {"time": serpapi._hour_label(hour), "info": "Usually not too busy", "busyness_score": base_score}
            if hour == current_hour:
                entry["current"] = True
                entry["live_busyness_score"] = base_score + 5
            entries.append(entry)
        return entries

    payload = {
        "place_results": {
            "popular_times": {
                "current_day": "tuesday",
                "live_hash": {"info": "Not too busy", "time_spent": "People typically spend 1-4 hours here"},
                "graph_results": {
                    "monday": day_entries(20),
                    "tuesday": day_entries(25, current_hour=18),
                    "wednesday": day_entries(30),
                    "thursday": day_entries(35),
                    "friday": day_entries(50),
                    "saturday": day_entries(80),
                    "sunday": day_entries(15),
                },
            }
        }
    }
    fake = FakeHTTPClient(payload)
    monkeypatch.setattr(serpapi.httpx, "Client", lambda timeout: fake)

    result = serpapi.fetch_popular_times("place123")

    assert result.busiest_day == "Saturday"
    assert result.quietest_day == "Sunday"
    assert result.live_busyness_percent == 30
    assert result.typical_time_spent == "People typically spend 1-4 hours here"
    assert result.peak_hours_text is not None


def test_fetch_popular_times_no_popular_times_returns_none(monkeypatch):
    fake = FakeHTTPClient({"place_results": {}})
    monkeypatch.setattr(serpapi.httpx, "Client", lambda timeout: fake)

    assert serpapi.fetch_popular_times("place123") is None


def test_not_configured_returns_none_without_network_call(monkeypatch):
    monkeypatch.setattr(serpapi.settings, "serpapi_key", None)

    def boom(*args, **kwargs):
        raise AssertionError("should not construct an httpx client when unconfigured")

    monkeypatch.setattr(serpapi.httpx, "Client", boom)

    assert serpapi.fetch_popular_times("place123") is None
