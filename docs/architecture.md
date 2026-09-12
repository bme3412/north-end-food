# Architecture

Postgres is the system of record. FastAPI serves the Next.js discovery app. MCP is not in this phase.

```
Official menus (hand seed + ingest/extract/review)
        ↓
PostgreSQL
  restaurants, hours, snapshots, menu items
  canonical dishes, ingredients, price observations
  verified Google Place IDs, place stats, busyness stats
        ↓
FastAPI
        ↓
Next.js food discovery UI
```

## Public API

- `GET /restaurants` and `GET /restaurants/{id}` — catalog, curated hours, provenance, price profile.
- `GET /menu-items` — filtered, ranked search. Default page size 200. `open_now`, `service_mode`, and `pizza_serving` are applied in SQL.
- `GET /menu-items/featured` — home-page classics and below-median picks.
- `GET /menu-items/meta` — facet values.
- `GET /search/suggest` — restaurant and dish suggestions.
- `GET /restaurants/{id}/google-photo` — ephemeral Places photo fallback. RAM cache + monthly cap + per-IP limit. Photo bytes and resource names are not stored.

## Menu pipeline

`scripts/ingest_menu.py` writes a hashed snapshot. `scripts/extract_menu.py` runs Gemini extraction into `needs_review`. `scripts/review_extraction.py` is the human gate; only `complete` / `manual_seed` snapshots are searchable. Missing prices are never invented.

## Enrichment

Verified Place IDs are applied from a reviewed CSV, never from raw Text Search. `scripts/refresh_place_stats.py` (daily) and `scripts/refresh_busyness.py` (weekly) refresh Google Places and SerpApi snapshots. GitHub Actions runs those scripts against the production database.
