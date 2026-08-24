"""BestTime client for restaurant crowd data — current busyness (Live
Forecast) and the typical weekly pattern (New Forecast).

Inert without BESTTIME_API_KEY: both fetch functions return None
immediately so callers (scripts/refresh_busyness.py) can no-op cleanly
until a key is set.

Both endpoints verified against real responses (2026-08-24), not guessed:

- Live Forecast returns analysis.venue_forecasted_busyness, a 0-100
  busyness percentage for the CURRENT hour only. No wait-minutes field,
  no 7-day array, and no such field exists anywhere in BestTime's API —
  confirmed against their full API reference. Busyness % (here) and
  intensity_txt (New Forecast, below) are the closest proxies they offer.
- New Forecast (POST /api/v1/forecasts, not the same endpoint as Live)
  returns analysis: a 7-element array, Monday->Sunday in order. Each day
  has day_info.day_mean (0-100 typical busyness), day_info.day_rank_mean
  (1=busiest day of the week, 7=quietest), and hour_analysis (per-hour
  intensity_nr, -2..2, 999=closed). This is a heavier call than Live
  Forecast — treat it as historical/typical data, refreshed far less
  often, not a live reading.

Note: BestTime's own peak_hours/busy_hours arrays on each day came back
empty for quieter days in testing (they seem to apply an internal
threshold that quiet venues never cross) — so peak_hours_text below is
computed directly from hour_analysis's intensity_nr instead of trusting
those arrays, which is more reliable across both busy and quiet venues.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import settings

LIVE_FORECAST_URL = "https://besttime.app/api/v1/forecasts/live"
NEW_FORECAST_URL = "https://besttime.app/api/v1/forecasts"


@dataclass(frozen=True)
class BusynessForecast:
    busyness_percent: int | None  # 0-100, forecasted busyness for the current hour


@dataclass(frozen=True)
class WeekForecast:
    daily_pattern: list[float]  # 7 values Mon..Sun, 0-1 normalized day_mean
    busiest_day: str | None  # e.g. "Saturday"
    quietest_day: str | None  # e.g. "Monday"
    peak_hours_text: str | None  # e.g. "6-9 PM", the busiest day's peak intensity window


def is_configured() -> bool:
    return bool(settings.besttime_api_key)


def fetch_live_forecast(venue_name: str, venue_address: str) -> BusynessForecast | None:
    if not is_configured():
        return None

    # First-time forecasts for a venue BestTime hasn't analyzed before run a
    # live analysis pass and can take well over 15s; repeat calls are fast.
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            LIVE_FORECAST_URL,
            params={
                "api_key_private": settings.besttime_api_key,
                "venue_name": venue_name,
                "venue_address": venue_address,
            },
        )
        response.raise_for_status()
        payload = response.json()

    if payload.get("status") != "OK":
        return None

    analysis = payload.get("analysis") or {}
    return BusynessForecast(busyness_percent=analysis.get("venue_forecasted_busyness"))


def _hour_label(hour: int) -> str:
    period = "AM" if hour < 12 else "PM"
    h12 = hour % 12
    if h12 == 0:
        h12 = 12
    return f"{h12} {period}"


def _peak_hours_text(day: dict) -> str | None:
    hours = [h for h in (day.get("hour_analysis") or []) if h.get("intensity_nr") not in (None, 999)]
    if not hours:
        return None
    top = max(h["intensity_nr"] for h in hours)
    peak_hours = sorted(h["hour"] for h in hours if h["intensity_nr"] == top)
    if not peak_hours:
        return None
    start, end = peak_hours[0], peak_hours[-1]
    if start == end:
        return _hour_label(start)
    return f"{_hour_label(start)}-{_hour_label(end)}"


def fetch_week_forecast(venue_name: str, venue_address: str) -> WeekForecast | None:
    if not is_configured():
        return None

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            NEW_FORECAST_URL,
            params={
                "api_key_private": settings.besttime_api_key,
                "venue_name": venue_name,
                "venue_address": venue_address,
            },
        )
        response.raise_for_status()
        payload = response.json()

    if payload.get("status") != "OK":
        return None

    days = payload.get("analysis") or []
    if len(days) != 7:
        return None

    daily_pattern = [round(max(0.0, min(1.0, day["day_info"]["day_mean"] / 100)), 2) for day in days]

    ranks = [day["day_info"]["day_rank_mean"] for day in days]
    busiest = days[ranks.index(min(ranks))]
    quietest = days[ranks.index(max(ranks))]

    return WeekForecast(
        daily_pattern=daily_pattern,
        busiest_day=busiest["day_info"].get("day_text"),
        quietest_day=quietest["day_info"].get("day_text"),
        peak_hours_text=_peak_hours_text(busiest),
    )
