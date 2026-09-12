"""Process-local TTL cache for Google photo payloads.

Stores only successful API responses in RAM. Photo URLs stay ephemeral and
are never written to the database.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic

from app.schemas import GooglePhotoOut

PHOTO_CACHE_TTL_SECONDS = 20 * 60


@dataclass(frozen=True)
class _Entry:
    expires_at: float
    photo: GooglePhotoOut


_lock = Lock()
_store: dict[tuple[str, str], _Entry] = {}


def cache_key(restaurant_id: str, variant: str) -> tuple[str, str]:
    return (restaurant_id, variant)


def get_cached_photo(restaurant_id: str, variant: str) -> GooglePhotoOut | None:
    key = cache_key(restaurant_id, variant)
    now = monotonic()
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        if entry.expires_at <= now:
            _store.pop(key, None)
            return None
        return entry.photo


def set_cached_photo(restaurant_id: str, variant: str, photo: GooglePhotoOut, *, ttl_seconds: float = PHOTO_CACHE_TTL_SECONDS) -> None:
    with _lock:
        _store[cache_key(restaurant_id, variant)] = _Entry(monotonic() + ttl_seconds, photo)


def clear_photo_cache() -> None:
    with _lock:
        _store.clear()
