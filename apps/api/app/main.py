from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.routers.menu_items import router as menu_items_router
from app.routers.restaurants import router as restaurants_router
from app.routers.search import router as search_router

app = FastAPI(
    title="North End Food Graph API",
    version="0.1.0",
    description="Menu-item intelligence for Boston's North End.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants_router)
app.include_router(menu_items_router)
app.include_router(search_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Readiness probe: process is up and Postgres answers SELECT 1."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ok"}
