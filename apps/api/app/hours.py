"""Live open/closed computation from a restaurant's own weekly hours
(Restaurant.hours), evaluated in America/New_York. All restaurants in
this dataset are North End Boston; nothing in the schema stores a
per-restaurant timezone, and one shared zone is the right call at this
scope (see architecture-audit.md's scale analysis) rather than adding a
timezone column nobody would ever set differently.

This is a pure function computed fresh on every request, not a cached
snapshot — unlike Google Places' open_now (RestaurantPlaceStats), which
is a batch job's result from whenever it last ran. Genuinely "is it open
right now" needs to be computed now, not read back from a stale row.
"""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

NORTH_END_TZ = ZoneInfo("America/New_York")

_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def now_in_north_end() -> datetime:
    return datetime.now(NORTH_END_TZ)


def _parse_time(value: str) -> time:
    hour, minute = value.split(":")
    return time(int(hour), int(minute))


def is_open_now(hours: list[dict] | None, now: datetime | None = None) -> bool | None:
    """True/False from `hours`; None if we don't have curated hours for
    this restaurant yet (distinct from "closed"). Handles overnight-
    spanning periods (`close` <= `open`, e.g. Bricco's Fri 16:00-02:00) by
    also checking whether *yesterday's* period is still running past
    midnight into today.
    """
    if not hours:
        return None
    now = (now or now_in_north_end()).astimezone(NORTH_END_TZ)
    current = now.time()
    weekday = now.weekday()

    for offset in (0, 1):
        day = (weekday - offset) % 7
        for period in hours:
            if day not in period["days"]:
                continue
            open_t = _parse_time(period["open"])
            close_t = _parse_time(period["close"])
            overnight = close_t <= open_t
            if offset == 0:
                if overnight:
                    if current >= open_t:
                        return True
                elif open_t <= current < close_t:
                    return True
            elif overnight and current < close_t:
                return True
    return False


def _format_clock(value: str) -> str:
    hour, minute = (int(part) for part in value.split(":"))
    period = "am" if hour < 12 else "pm"
    hour12 = hour % 12 or 12
    return f"{hour12}:{minute:02d}{period}" if minute else f"{hour12}{period}"


def _day_range_label(days: list[int]) -> str:
    ranges: list[tuple[int, int]] = []
    ordered = sorted(days)
    start = prev = ordered[0]
    for day in ordered[1:]:
        if day == prev + 1:
            prev = day
            continue
        ranges.append((start, prev))
        start = prev = day
    ranges.append((start, prev))
    return "/".join(_DAY_NAMES[a] if a == b else f"{_DAY_NAMES[a]}-{_DAY_NAMES[b]}" for a, b in ranges)


def format_hours_summary(hours: list[dict] | None) -> str | None:
    """A compact human-readable summary, e.g. "Mon-Thu/Sun 12-10pm, Fri-Sat 12-10:30pm"."""
    if not hours:
        return None
    return ", ".join(
        f"{_day_range_label(period['days'])} {_format_clock(period['open'])}–{_format_clock(period['close'])}"
        for period in hours
    )
