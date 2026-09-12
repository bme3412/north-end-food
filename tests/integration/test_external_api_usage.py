from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from app.integrations.usage import release_monthly_attempt, reserve_monthly_attempt


def test_monthly_usage_cap_is_atomic_under_concurrency(engine):
    def reserve(_: int) -> bool:
        with Session(engine) as session:
            return reserve_monthly_attempt(session, provider="google_places_test", metric="photo_media", cap=3)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(reserve, range(8)))
    assert results.count(True) == 3
    assert results.count(False) == 5


def test_release_monthly_attempt_refunds_a_reservation(engine):
    with Session(engine) as session:
        assert reserve_monthly_attempt(session, provider="google_places_refund", metric="photo_media", cap=2)
        assert reserve_monthly_attempt(session, provider="google_places_refund", metric="photo_media", cap=2)
        assert release_monthly_attempt(session, provider="google_places_refund", metric="photo_media")
        assert reserve_monthly_attempt(session, provider="google_places_refund", metric="photo_media", cap=2)
        assert not reserve_monthly_attempt(session, provider="google_places_refund", metric="photo_media", cap=2)
