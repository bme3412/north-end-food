# North End Food Graph

[![CI](https://github.com/bme3412/north-end-food/actions/workflows/ci.yml/badge.svg)](https://github.com/bme3412/north-end-food/actions/workflows/ci.yml)

Structured menu intelligence for Boston's North End. Sprint 0 owns the schema, five hand-seeded restaurants, a search API, and a Food Screener. Gemini extraction, Places, busyness, and MCP come later.

## Quick start

```bash
cp .env.example .env
# Default in .env.example is Docker Postgres on 5433.
# This machine already had Homebrew Postgres on 5432; .env points there.

docker compose up -d   # optional if you want isolated Postgres on 5433

python3 -m venv .venv
source .venv/bin/activate
pip install -e apps/api

cd apps/api && alembic upgrade head && cd ../..
python scripts/seed.py

# terminal 1 — use 8001 if 8000 is already taken
cd apps/api && uvicorn app.main:app --reload --port 8001

# terminal 2
cd apps/web && npm run dev
```

Open [http://localhost:3001](http://localhost:3001). The home screen is **map-first**: filters and dish list on the left (desktop) or via the Dishes tab (mobile), Mapbox pins sized by match count.

Add a Mapbox token to `apps/web/.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here
```

Get one at [mapbox.com](https://account.mapbox.com/). Restrict it to your domain in the Mapbox dashboard.

**Search tricks** (parsed server-side):

- `lobster ravioli under $35`
- `pasta between $25 and $40`
- `vegetarian` / `gluten-free`
- Comma-separated proteins with **match any** vs **match all**
- Category, ingredient, min/max price, priced-only toggle

API: [http://localhost:8001/docs](http://localhost:8001/docs) (8001 if 8000 is occupied)

Postgres is on **5433** in docker-compose (to avoid colliding with a local 5432). Homebrew Postgres on 5432 also works — set `DATABASE_URL` accordingly.

## Tests

```bash
pip install -e "apps/api[dev]"
pytest
```

Integration tests run against a real Postgres database (`<your db name>_test`,
created automatically from `DATABASE_URL`) rather than SQLite — the schema
leans on Postgres-only features (ARRAY columns, string UUID keys, ILIKE) that
a SQLite stand-in wouldn't actually exercise. Each test reseeds the five
restaurants fresh, so it never touches your dev data.

## What this sprint includes

- `restaurants`, `restaurant_external_ids`, `menu_sources`, `menu_snapshots`, `menu_items`, `canonical_dishes`
- Seed set: Giacomo's, Neptune Oyster, Pizzeria Regina, Modern Pastry, Bricco
- `GET /restaurants`, `GET /restaurants/{id}`, `GET /menu-items?q=`
- `scripts/ingest_menu.py` — fetch, hash, snapshot; skip if unchanged; **no extraction**
- Food Screener with raw vs canonical fields and provenance

## Ingest a URL without extracting

```bash
python scripts/ingest_menu.py NE_0002 https://www.neptuneoyster.com/menu
```

Re-running with the same content prints `unchanged` and does not insert a snapshot.

## Honest seed caveats

- **Neptune Oyster** and **Bricco** items/prices come from official pages (2026-08-23).
- **Modern Pastry** names come from the official pastry list; prices were not published, so they are null.
- **Pizzeria Regina** names come from the official PDF; only the 16" original pie had a fully legible price.
- **Giacomo's** names mix the official site with widely listed Yelp/delivery dishes. Most à-la-carte prices are not on giacomosboston.com; those prices are lower-confidence until Phase 1 official extraction.

Missing prices are never invented (`—` or `MKT`).
