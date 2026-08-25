"""SerpApi client for Google's Popular Times data (Google Maps Place Results
API), replacing BestTime as of 2026-08-25.

Inert without SERPAPI_KEY: fetch_popular_times returns None immediately so
callers (scripts/refresh_busyness.py) can no-op cleanly until a key is set.

Verified against a real response for Giacomo's Ristorante (2026-08-25), not
guessed. A single `engine=google_maps&place_id=...` GET request returns
place_results.popular_times = {current_day, live_hash, graph_results}:

- graph_results is a dict keyed by lowercase day name (sunday..saturday, not
  necessarily in that order in the payload -- look up each day by name).
  Each day's value is a list of hour entries spanning roughly opening to
  closing, NOT a full 24-hour array -- hours outside that range (including
  all of midnight-5am in the venue we tested) are simply absent from the
  list. Each present entry has `time` ("12 PM") and `busyness_score`
  (0-100), plus an `info` string ONLY when Google actually has a reading
  for that hour. Hours within the array's range but before/after the
  venue's real opening hours still show up with busyness_score: 0 and NO
  `info` key -- that missing key, not a score of 0, is the reliable signal
  for "no reading here" vs "genuinely not busy": an open venue at its
  quietest can legitimately read close to 0 while `info` is still present.
- Exactly one entry, on the CURRENT day's array, carries `current: true`
  and `live_busyness_score` -- that's today's live reading. live_hash
  itself only has `info` (a live text descriptor) and `time_spent`, no
  numeric score of its own.
- No busiest/quietest/peak-hours field is provided directly; derived here
  from graph_results the same way besttime.py used to derive them from
  BestTime's day_rank_mean/hour_analysis.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import settings

SEARCH_URL = "https://serpapi.com/search.json"

DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@dataclass(frozen=True)
class PopularTimesResult:
    hourly_pattern: list[list[float | None]]  # 7 (Mon..Sun) x 24 (hour 0-23), 0-1 or None if no reading
    daily_pattern: list[float]  # 7 values Mon..Sun, mean of that day's non-null hourly readings
    busiest_day: str | None
    quietest_day: str | None
    peak_hours_text: str | None  # e.g. "6 PM-8 PM", the busiest day's peak window
    live_busyness_percent: int | None  # today's current-hour reading, if Google has one right now
    typical_time_spent: str | None  # e.g. "People typically spend 1-4 hours here"


def is_configured() -> bool:
    return bool(settings.serpapi_key)


def _parse_hour_label(label: str) -> int | None:
    parts = label.split()
    if len(parts) != 2:
        return None
    num_str, period = parts
    if not num_str.isdigit():
        return None
    num = int(num_str)
    period = period.upper()
    if period == "AM":
        return 0 if num == 12 else num
    if period == "PM":
        return 12 if num == 12 else num + 12
    return None


def _hour_label(hour: int) -> str:
    period = "AM" if hour < 12 else "PM"
    h12 = hour % 12 or 12
    return f"{h12} {period}"


def _hourly_row(entries: list[dict]) -> list[float | None]:
    row: list[float | None] = [None] * 24
    for entry in entries:
        if "info" not in entry:
            continue
        hour = _parse_hour_label(entry.get("time", ""))
        score = entry.get("busyness_score")
        if hour is None or score is None:
            continue
        row[hour] = round(max(0.0, min(1.0, score / 100)), 2)
    return row


def _day_mean(row: list[float | None]) -> float:
    values = [v for v in row if v is not None]
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def _peak_hours_text(row: list[float | None]) -> str | None:
    present = [(hour, value) for hour, value in enumerate(row) if value is not None]
    if not present:
        return None
    top = max(value for _, value in present)
    peak_hours = sorted(hour for hour, value in present if value == top)
    start, end = peak_hours[0], peak_hours[-1]
    if start == end:
        return _hour_label(start)
    return f"{_hour_label(start)}-{_hour_label(end)}"


def fetch_popular_times(place_id: str) -> PopularTimesResult | None:
    if not is_configured():
        return None

    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            SEARCH_URL,
            params={"engine": "google_maps", "place_id": place_id, "api_key": settings.serpapi_key},
        )
        response.raise_for_status()
        payload = response.json()

    place = payload.get("place_results") or {}
    popular_times = place.get("popular_times")
    if not popular_times:
        return None

    graph_results = popular_times.get("graph_results") or {}
    hourly_pattern = [_hourly_row(graph_results.get(day) or []) for day in DAY_KEYS]

    if not any(value is not None for row in hourly_pattern for value in row):
        return None

    daily_pattern = [_day_mean(row) for row in hourly_pattern]
    ranked = sorted(range(7), key=lambda i: daily_pattern[i])
    quietest_idx, busiest_idx = ranked[0], ranked[-1]

    live_busyness_percent = None
    for entries in graph_results.values():
        current = next((entry for entry in entries if entry.get("current")), None)
        if current is not None:
            live_busyness_percent = current.get("live_busyness_score")
            break

    return PopularTimesResult(
        hourly_pattern=hourly_pattern,
        daily_pattern=daily_pattern,
        busiest_day=DAY_KEYS[busiest_idx].capitalize(),
        quietest_day=DAY_KEYS[quietest_idx].capitalize(),
        peak_hours_text=_peak_hours_text(hourly_pattern[busiest_idx]),
        live_busyness_percent=live_busyness_percent,
        typical_time_spent=(popular_times.get("live_hash") or {}).get("time_spent"),
    )
