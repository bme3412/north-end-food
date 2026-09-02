# North End Food Graph

Structured menu intelligence for Boston's North End. The current corpus covers 44 restaurants with a search API and food-discovery frontend.

## Quick start

```bash
cp .env.example .env
docker compose up -d
python3 -m venv .venv
source .venv/bin/activate
pip install -e "apps/api[dev]"
cd apps/api && alembic upgrade head && cd ../..
python scripts/seed.py
```

Run the API on port 8001 and the web app on port 3001. A URL-restricted `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` belongs in `apps/web/.env.local`.

## Tests

```bash
pytest
cd apps/web && npm run test && npm run lint && npm run build
```

Integration tests use PostgreSQL. Local runs may skip them when PostgreSQL is intentionally unavailable; `CI=true` makes an unavailable database a failure.

## Scope and local photos

The seed contains 44 restaurants. `restaurants.photo_url` means an owned, committed local asset only. Giacomo's and Pizzeria Regina currently have local photos. Add future owned photos under `apps/web/public/restaurant-photos/`; a valid local URL always wins and prevents a Google request.

## Google Place verification

Place IDs are never trusted directly from Text Search. Export candidates, review names, addresses, and links, then approve exactly one row per restaurant:

```bash
python scripts/link_google_places.py export --output place_candidates.csv
# Set approved=yes and reviewer=Your Name on reviewed rows.
python scripts/link_google_places.py apply --input place_candidates.csv
python scripts/refresh_place_stats.py
python scripts/refresh_busyness.py
```

Both enrichment scripts reject unverified IDs. Google summaries are displayed only when Google supplies the exact disclosure, reporting URL, and source URL.

## Temporary Google photo fallback

Deploy with photos disabled. After manually approving Place IDs, configure a server-only Places-restricted key:

```bash
GOOGLE_MAPS_API_KEY=server-only-key
GOOGLE_PLACE_PHOTOS_ENABLED=true
GOOGLE_PLACE_PHOTO_MONTHLY_CAP=900
```

`GET /restaurants/{id}/google-photo?variant=thumbnail|card|hero` returns a fresh ephemeral URL, dimensions, the individual Google Maps photo link, reporting link, and all author attributions. Responses are `private, no-store`. Missing/local/unverified photos return 404, the monthly guard returns 429, and disabled or unavailable Google service returns 503.

Only the approved Place ID is persisted. Photo resource names, image URLs, and image bytes are not stored. The persistent guard atomically reserves no more than 900 media attempts per UTC month. The frontend loads fallback photos only near the viewport, bypasses the Next.js optimizer, fails silently to its placeholder, shows required attribution, and excludes Google content from the Mapbox popup.

## Menu ingestion

```bash
python scripts/ingest_menu.py NE_0002 https://www.neptuneoyster.com/menu
python scripts/extract_menu.py NE_0002
python scripts/review_extraction.py NE_0002
```

Extracted items remain hidden in `needs_review` until approved. Missing prices are never invented.
