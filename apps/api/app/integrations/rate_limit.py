"""In-process sliding-window limiter for the Google photo route."""

from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

PHOTO_IP_LIMIT = 20
PHOTO_IP_WINDOW_SECONDS = 5 * 60

_lock = Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def allow_photo_request(
    ip: str,
    *,
    limit: int = PHOTO_IP_LIMIT,
    window_seconds: float = PHOTO_IP_WINDOW_SECONDS,
    now: float | None = None,
) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds). Records the hit only when allowed."""
    current = monotonic() if now is None else now
    with _lock:
        bucket = _hits[ip]
        cutoff = current - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(bucket[0] + window_seconds - current) + 1)
            return False, retry_after
        bucket.append(current)
        return True, 0


def reset_photo_rate_limiter() -> None:
    with _lock:
        _hits.clear()
