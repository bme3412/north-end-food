from datetime import datetime, timedelta, timezone

from app.integrations.cache import is_fresh


def test_none_is_never_fresh():
    assert is_fresh(None, max_age_hours=24) is False


def test_recent_timestamp_is_fresh():
    assert is_fresh(datetime.now(timezone.utc) - timedelta(minutes=5), max_age_hours=1) is True


def test_old_timestamp_is_not_fresh():
    assert is_fresh(datetime.now(timezone.utc) - timedelta(hours=2), max_age_hours=1) is False


def test_naive_datetime_treated_as_utc():
    naive_recent = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
    assert is_fresh(naive_recent, max_age_hours=1) is True
