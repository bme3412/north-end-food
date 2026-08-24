from app.config import Settings


def test_bare_postgres_url_gets_psycopg_driver():
    settings = Settings(database_url="postgres://u:p@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://u:p@host:5432/db"


def test_bare_postgresql_url_gets_psycopg_driver():
    settings = Settings(database_url="postgresql://u:p@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://u:p@host:5432/db"


def test_url_with_driver_already_set_is_unchanged():
    settings = Settings(database_url="postgresql+psycopg://u:p@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://u:p@host:5432/db"
