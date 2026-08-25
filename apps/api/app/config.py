from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://northend:northend@localhost:5433/northend"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"
    raw_menu_dir: Path = REPO_ROOT / "data" / "raw_menus"

    google_maps_api_key: str | None = None
    serpapi_key: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("database_url")
    @classmethod
    def _add_psycopg_driver(cls, value: str) -> str:
        # Managed Postgres providers (Render, Heroku, ...) hand back a bare
        # postgres(ql):// URL with no driver — SQLAlchemy needs +psycopg.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_raw_menu_dir(self) -> Path:
        path = Path(self.raw_menu_dir)
        if not path.is_absolute():
            return (REPO_ROOT / path).resolve()
        return path


settings = Settings()
