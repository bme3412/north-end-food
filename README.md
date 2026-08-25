# North End Food Graph

[![CI](https://github.com/bme3412/north-end-food/actions/workflows/ci.yml/badge.svg)](https://github.com/bme3412/north-end-food/actions/workflows/ci.yml)

Structured menu intelligence for Boston's North End. Sprint 0 owns the schema, five hand-seeded restaurants, a search API, and a Food Screener. Gemini extraction, Google Places, and SerpApi (Google Popular Times) are wired up but inert until their API keys are configured; MCP comes later.

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
- `scripts/ingest_menu.py` — fetch, hash, snapshot; skip if unchanged (no extraction on its own)
- `scripts/extract_menu.py` / `scripts/review_extraction.py` — Gemini extraction with a human-approval gate before results go live
- `scripts/link_google_places.py` / `scripts/refresh_place_stats.py` / `scripts/refresh_busyness.py` — Places (New) + SerpApi (Google Popular Times) enrichment, wired but inert without API keys
- Food Screener with raw vs canonical fields and provenance

## Ingest a URL without extracting

```bash
python scripts/ingest_menu.py NE_0002 https://www.neptuneoyster.com/menu
```

Re-running with the same content prints `unchanged` and does not insert a snapshot.

## Extract a pending snapshot into menu items

Requires `GEMINI_API_KEY` in `.env` (wired but inert without one — the
scripts below print a message and exit cleanly if it's unset).

```bash
python scripts/extract_menu.py NE_0002     # writes items, status -> needs_review
python scripts/review_extraction.py NE_0002  # inspect, then approve or reject
```

Extracted items are written immediately but stay invisible to the search
API (`extraction_status="needs_review"`) until approved — an LLM extraction
error should never reach the live menu graph unreviewed. Approving sets
`extraction_status="complete"` and stamps the real Gemini model name as
`extractor_model`, which is what the restaurant page's data-provenance
panel displays. The extractor is instructed to never invent a price or
dish that isn't literally in the source text — missing prices come back
null, same as the hand-seeded data.

## Refresh rating, hours, and review summaries

Requires `GOOGLE_MAPS_API_KEY` in `.env`, and (for crowd data) `SERPAPI_KEY`
(get one at serpapi.com). Both are wired but inert without a key — the
scripts below print a message and exit cleanly if theirs is unset.

```bash
python scripts/link_google_places.py     # Text Search -> restaurant_external_ids (once)
python scripts/refresh_place_stats.py    # rating, price, hours, AI place/review summaries
python scripts/refresh_busyness.py       # live busyness, weekly pattern, hour-by-hour heatmap
```

`refresh_place_stats.py` uses the current Places API's `generativeSummary`
and `reviewSummary` fields — Google runs its own Gemini summarization over
real reviews server-side, so the restaurant page's review-intelligence
section doesn't need a separate scrape-then-summarize pipeline. It's a
single narrative per place, not a food/service/value/atmosphere breakdown,
and isn't guaranteed for every place. Every AI-generated summary shown in
the UI carries Google's exact disclosure text, not a hardcoded one.

`refresh_busyness.py` uses SerpApi's Google Maps Place Results API to pull
Google's own Popular Times data: one call per restaurant returns the
current live busyness (when Google has a reading), the typical weekly
pattern, and the full hour-by-hour breakdown together — all rendered on the
restaurant page as the "Popularity this week" heatmap. SerpApi's free tier
is 250 searches/month; at 30 restaurants the default `--max-age-hours`
(168h/weekly) keeps this to ~130 calls/month, comfortably inside the free
tier. Pass `--force` to refetch regardless of freshness.

Both refresh scripts cache in Postgres and skip restaurants refreshed
within `--max-age-hours` — nothing calls Google or SerpApi on a page load,
only when you explicitly run these scripts.

## Honest seed caveats

Refreshed 2026-08-24 against a full audit of each live site — all five
restaurants are now at (or near) full official-menu coverage, not the
smaller Sprint 0 samples from 2026-08-23.

- **Neptune Oyster**, **Pizzeria Regina**, and **Bricco** items/prices come from official pages, complete across every section.
- **Giacomo's** now comes entirely from the official site (giacomosboston.com), not Yelp — the site renders its menu via JavaScript, so this required a rendered-browser fetch rather than the plain HTTP fetch `scripts/ingest_menu.py` uses; re-running that script against it will not reproduce this data until a headless-browser fetch path exists.
- **Modern Pastry** names come from the official pastry list (79 items, every section); prices were not published, so they stay null.
- Deliberately excluded everywhere: beverages (beer/wine/cocktails/coffee) and per-topping add-ons — this schema models dishes, not drinks or modifiers.
- Bricco's menu spans 7 official sub-pages; `menu_sources` is restaurant-granularity, not item-granularity, so its recorded source URL is the landing page that links all of them rather than each item's exact sub-page.

Missing prices are never invented (`—` or `MKT`).
