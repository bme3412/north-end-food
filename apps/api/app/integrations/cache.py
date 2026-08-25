"""Staleness check for cached third-party data (Places, SerpApi).

Both integrations write into DB tables with a `retrieved_at` timestamp and
are read from there on every request — nothing calls Google or SerpApi
live from the request path. This just decides whether an existing row is
fresh enough for a refresh script to skip refetching it, so accidentally
running a refresh script twice in a row doesn't burn API quota for nothing.
"""

from __future__ import annotations

from datetime import datetime, timezone


def is_fresh(retrieved_at: datetime | None, max_age_hours: float) -> bool:
    if retrieved_at is None:
        return False
    if retrieved_at.tzinfo is None:
        retrieved_at = retrieved_at.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - retrieved_at).total_seconds() / 3600
    return age_hours < max_age_hours
