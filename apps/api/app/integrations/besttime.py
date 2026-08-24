"""BestTime client for restaurant crowd data — current busyness (Live
Forecast) and the typical weekly pattern (New Forecast).

Inert without BESTTIME_API_KEY: both fetch functions return None
immediately so callers (scripts/refresh_busyness.py) can no-op cleanly
until a key is set.

Both endpoints verified against real responses (2026-08-24), not guessed:

- Live Forecast returns analysis.venue_forecasted_busyness, a 0-100
  busyness percentage for the CURRENT hour only. No wait-minutes field,
  no 7-day array. (An earlier version of this client guessed at a
  wait-minutes field that doesn't exist — that was wrong.)
- New Forecast (POST /api/v1/forecasts, not the same endpoint as Live)
  returns analysis: a 7-element array, Monday->Sunday in order, each with
  day_info.day_mean (0-100 typical busyness for that day) and an hourly
  day_raw breakdown. This is what a real weekly popularity chart needs.
  It's a heavier call than Live Forecast — treat it as historical/typical
  data, refreshed far less often, not a live reading.
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


def fetch_week_forecast(venue_name: str, venue_address: str) -> list[float] | None:
    """Returns 7 values Mon..Sun, 0-1 normalized typical busyness, or None."""
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

    return [round(max(0.0, min(1.0, day["day_info"]["day_mean"] / 100)), 2) for day in days]
