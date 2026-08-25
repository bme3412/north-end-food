from datetime import datetime
from zoneinfo import ZoneInfo

from app.hours import format_hours_summary, is_open_now

TZ = ZoneInfo("America/New_York")

# Bricco's real hours: Mon-Thu/Sun 4pm-11pm, Fri 4pm-2am, Sat 12pm-2am.
# Fri/Sat close past midnight, deliberately exercising the overnight-
# spanning branch of is_open_now.
BRICCO_HOURS = [
    {"days": [0, 1, 2, 3, 6], "open": "16:00", "close": "23:00"},
    {"days": [4], "open": "16:00", "close": "02:00"},
    {"days": [5], "open": "12:00", "close": "02:00"},
]


def _at(year, month, day, hour, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=TZ)


def test_no_hours_means_unknown_not_closed():
    assert is_open_now(None) is None
    assert is_open_now([]) is None


def test_open_during_a_plain_same_day_period():
    # Monday 5pm, within the Mon-Thu/Sun 4pm-11pm period.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 31, 17)) is True


def test_closed_before_opening():
    # Monday 3pm, before the 4pm open.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 31, 15)) is False


def test_closed_after_same_day_close():
    # Monday 11:30pm, after the 11pm close.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 31, 23, 30)) is False


def test_open_late_within_an_overnight_period():
    # Friday 11pm, within Friday's 4pm-2am period, well before midnight.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 28, 23)) is True


def test_open_past_midnight_via_overnight_spillover():
    # Saturday 1am -- still Friday's overnight period (4pm-2am), even
    # though the calendar day has rolled over to Saturday.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 29, 1)) is True


def test_closed_between_overnight_close_and_next_days_open():
    # Saturday 3am -- Friday's overnight period ended at 2am, and
    # Saturday's own period doesn't start until noon.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 29, 3)) is False


def test_open_once_next_days_own_period_starts():
    # Saturday 1pm -- Saturday's own 12pm-2am period has started.
    assert is_open_now(BRICCO_HOURS, _at(2026, 8, 29, 13)) is True


def test_format_hours_summary_compresses_contiguous_day_ranges():
    assert format_hours_summary(BRICCO_HOURS) == "Mon-Thu/Sun 4pm–11pm, Fri 4pm–2am, Sat 12pm–2am"


def test_format_hours_summary_handles_missing_hours():
    assert format_hours_summary(None) is None
