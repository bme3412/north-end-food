"""Shared fixtures. Integration tests run against a real Postgres database
(a dedicated *_test database derived from DATABASE_URL) rather than SQLite,
because the schema leans on Postgres-only features — ARRAY columns, UUID
primary keys stored as strings, ILIKE + array_to_string — that a SQLite
substitute wouldn't actually exercise.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import get_db
from app.main import app
from app.models import Base
from app.seed import seed as seed_db


def _test_db_url():
    base = make_url(settings.database_url)
    return base.set(database=f"{base.database}_test")


@pytest.fixture(scope="session")
def engine():
    test_url = _test_db_url()
    admin_url = test_url.set(database="postgres")

    try:
        admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": test_url.database}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{test_url.database}"'))
        admin_engine.dispose()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Postgres not reachable for tests ({exc}); start it and rerun.")

    test_engine = create_engine(test_url, pool_pre_ping=True)
    # drop_all + create_all rather than create_all alone: create_all only adds
    # missing tables, it won't add a column a model gained since the test db
    # was last created, so a stale schema from a prior run goes undetected.
    Base.metadata.drop_all(test_engine)
    Base.metadata.create_all(test_engine)
    yield test_engine
    test_engine.dispose()


@pytest.fixture()
def db_session(engine):
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = session_factory()
    seed_db(session, reset=True)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(engine, db_session):
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
