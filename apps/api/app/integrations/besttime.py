"""BestTime client for restaurant wait time + weekly popularity pattern.

Inert without BESTTIME_API_KEY: fetch_live_forecast returns None immediately
so callers (scripts/refresh_busyness.py) can no-op cleanly until a key is set.

Field names below follow BestTime's public "Live Forecast" response shape as
documented at https://besttime.app/api/ — verify against a live response once
a real key is configured, since this parsing isn't exercised by tests here.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import settings

LIVE_FORECAST_URL = "https://besttime.app/api/v1/forecasts/live"


@dataclass(frozen=True)
class BusynessForecast:
    wait_minutes: int | None
    weekly_pattern: list[float] | None  # Mon..Sun, 0-1 normalized


def is_configured() -> bool:
    return bool(settings.besttime_api_key)


def fetch_live_forecast(venue_name: str, venue_address: str) -> BusynessForecast | None:
    if not is_configured():
        return None

    with httpx.Client(timeout=15.0) as client:
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
    wait_minutes = analysis.get("venue_forecasted_wait_minutes")

    day_raw = payload.get("day_info", {}).get("week_raw") or payload.get("week_raw")
    weekly_pattern = None
    if isinstance(day_raw, list) and len(day_raw) == 7:
        weekly_pattern = [round(max(0.0, min(1.0, value / 100)), 2) for value in day_raw]

    return BusynessForecast(wait_minutes=wait_minutes, weekly_pattern=weekly_pattern)
