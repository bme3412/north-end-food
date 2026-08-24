import pytest

from app.integrations import besttime


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

    def post(self, url, params=None):
        return FakeResponse(self._payload)


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(besttime.settings, "besttime_api_key", "pri_test")


def test_hour_label():
    assert besttime._hour_label(0) == "12 AM"
    assert besttime._hour_label(12) == "12 PM"
    assert besttime._hour_label(13) == "1 PM"
    assert besttime._hour_label(23) == "11 PM"


def test_peak_hours_text_ignores_closed_hours():
    day = {
        "hour_analysis": [
            {"hour": 10, "intensity_nr": 999},
            {"hour": 18, "intensity_nr": 1},
            {"hour": 19, "intensity_nr": 2},
            {"hour": 20, "intensity_nr": 2},
            {"hour": 21, "intensity_nr": 0},
        ]
    }
    assert besttime._peak_hours_text(day) == "7 PM-8 PM"


def test_peak_hours_text_single_hour():
    day = {"hour_analysis": [{"hour": 12, "intensity_nr": 2}, {"hour": 13, "intensity_nr": -1}]}
    assert besttime._peak_hours_text(day) == "12 PM"


def test_peak_hours_text_all_closed_returns_none():
    day = {"hour_analysis": [{"hour": h, "intensity_nr": 999} for h in range(24)]}
    assert besttime._peak_hours_text(day) is None


def _day(day_text, rank_mean, day_mean, peak_hour=19):
    return {
        "day_info": {"day_text": day_text, "day_rank_mean": rank_mean, "day_mean": day_mean},
        "hour_analysis": [{"hour": peak_hour, "intensity_nr": 2}],
    }


def test_fetch_week_forecast_picks_busiest_and_quietest_by_rank(monkeypatch):
    days = [
        _day("Monday", 5, 30),
        _day("Tuesday", 6, 25),
        _day("Wednesday", 4, 35),
        _day("Thursday", 3, 40),
        _day("Friday", 2, 60),
        _day("Saturday", 1, 80),  # rank 1 = busiest
        _day("Sunday", 7, 20),  # highest rank number = quietest
    ]
    fake = FakeHTTPClient({"status": "OK", "analysis": days})
    monkeypatch.setattr(besttime.httpx, "Client", lambda timeout: fake)

    result = besttime.fetch_week_forecast("Test Venue", "1 Main St")

    assert result.busiest_day == "Saturday"
    assert result.quietest_day == "Sunday"
    assert result.daily_pattern == [0.3, 0.25, 0.35, 0.4, 0.6, 0.8, 0.2]
    assert result.peak_hours_text == "7 PM"


def test_fetch_week_forecast_wrong_day_count_returns_none(monkeypatch):
    fake = FakeHTTPClient({"status": "OK", "analysis": [_day("Monday", 1, 50)]})
    monkeypatch.setattr(besttime.httpx, "Client", lambda timeout: fake)

    assert besttime.fetch_week_forecast("Test Venue", "1 Main St") is None


def test_not_configured_returns_none_without_network_call(monkeypatch):
    monkeypatch.setattr(besttime.settings, "besttime_api_key", None)

    def boom(*args, **kwargs):
        raise AssertionError("should not construct an httpx client when unconfigured")

    monkeypatch.setattr(besttime.httpx, "Client", boom)

    assert besttime.fetch_live_forecast("x", "y") is None
    assert besttime.fetch_week_forecast("x", "y") is None
