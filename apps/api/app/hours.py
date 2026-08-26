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

from datetime import datetime, time, timedelta
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


def _anchor_datetime(day: int, at: time) -> datetime:
    """A tz-aware datetime whose weekday() is `day` (0=Mon..6=Sun, matching
    `hours[*]["days"]`) and whose time is `at`. The calendar date itself is
    meaningless -- `is_open_now` only reads `.weekday()`/`.time()` off it --
    so any Monday works as the anchor; Jan 1 2024 was one.
    """
    anchor_monday = datetime(2024, 1, 1, tzinfo=NORTH_END_TZ)
    return (anchor_monday + timedelta(days=day)).replace(hour=at.hour, minute=at.minute)


def is_open_during(hours: list[dict] | None, day: int, start: time, end: time) -> bool | None:
    """True if a single period fully covers the same-day window [start, end)
    -- e.g. "open from 6 to 9pm Friday" -- rather than just being open at
    each endpoint (a restaurant open at 6pm and again at 9pm but closed in
    between shouldn't count). The *period* may itself run overnight (e.g.
    16:00-02:00); the requested [start, end) window may not.
    """
    if not hours:
        return None
    if end <= start:
        return False
    for period in hours:
        if day not in period["days"]:
            continue
        open_t = _parse_time(period["open"])
        close_t = _parse_time(period["close"])
        overnight = close_t <= open_t
        if not overnight:
            if open_t <= start and end <= close_t:
                return True
        elif start >= open_t or end <= close_t:
            return True
    return False


def compute_open_status(
    hours: list[dict] | None,
    at_day: int | None,
    at_time: str | None,
    at_until: str | None,
) -> bool | None:
    """The single entry point every router uses to answer "is this
    restaurant open": the real current moment by default, or a simulated
    day/time (optionally through an end time, for a range) when the caller
    is previewing the "set a time" filter instead of asking about right now.
    """
    if at_day is None or at_time is None:
        return is_open_now(hours)
    start = _parse_time(at_time)
    if at_until:
        return is_open_during(hours, at_day, start, _parse_time(at_until))
    return is_open_now(hours, now=_anchor_datetime(at_day, start))


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
