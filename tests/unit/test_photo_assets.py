from pathlib import Path
from app.seed_data import RESTAURANTS
from app.seed_wave2 import WAVE2_RESTAURANTS


def test_every_seeded_local_photo_exists() -> None:
    public_dir = Path(__file__).resolve().parents[2] / "apps" / "web" / "public"
    missing = []
    for restaurant in RESTAURANTS + WAVE2_RESTAURANTS:
        photo_url = restaurant.get("photo_url")
        if photo_url and not (public_dir / photo_url.lstrip("/")).is_file():
            missing.append(f"{restaurant['restaurant_id']}: {photo_url}")
    assert missing == []
