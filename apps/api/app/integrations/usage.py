from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import ExternalApiUsage


def reserve_monthly_attempt(db: Session, *, provider: str, metric: str, cap: int, now: datetime | None = None) -> bool:
    """Atomically reserve one provider attempt under a UTC-month cap."""
    if cap <= 0:
        return False
    current = now or datetime.now(timezone.utc)
    period_start = current.date().replace(day=1)
    statement = (
        insert(ExternalApiUsage)
        .values(provider=provider, metric=metric, period_start=period_start, attempt_count=1)
        .on_conflict_do_update(
            index_elements=["provider", "metric", "period_start"],
            set_={"attempt_count": ExternalApiUsage.attempt_count + 1, "updated_at": current},
            where=ExternalApiUsage.attempt_count < cap,
        )
        .returning(ExternalApiUsage.attempt_count)
    )
    reserved = db.scalar(statement)
    db.commit()
    return reserved is not None
