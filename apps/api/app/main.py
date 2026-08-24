from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.menu_items import router as menu_items_router
from app.routers.restaurants import router as restaurants_router

app = FastAPI(
    title="North End Food Graph API",
    version="0.1.0",
    description="Menu-item intelligence for Boston's North End. Sprint 0 / Phase 0.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants_router)
app.include_router(menu_items_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe for local compose and the screener."""
    return {"status": "ok"}
