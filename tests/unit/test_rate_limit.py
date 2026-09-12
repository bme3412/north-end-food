from app.integrations.rate_limit import allow_photo_request, reset_photo_rate_limiter


def setup_function() -> None:
    reset_photo_rate_limiter()


def test_photo_rate_limiter_allows_then_blocks():
    assert allow_photo_request("1.1.1.1", limit=2, window_seconds=60) == (True, 0)
    assert allow_photo_request("1.1.1.1", limit=2, window_seconds=60) == (True, 0)
    allowed, retry_after = allow_photo_request("1.1.1.1", limit=2, window_seconds=60)
    assert allowed is False
    assert retry_after >= 1


def test_photo_rate_limiter_is_per_ip():
    assert allow_photo_request("1.1.1.1", limit=1, window_seconds=60)[0] is True
    assert allow_photo_request("2.2.2.2", limit=1, window_seconds=60)[0] is True
