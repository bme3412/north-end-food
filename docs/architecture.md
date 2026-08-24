# Architecture (Sprint 0)

Postgres is the system of record. FastAPI serves the web app. MCP is not in this phase.

```
Official menus (manual seed)
        ↓
PostgreSQL (restaurants / sources / snapshots / items / canonical dishes)
        ↓
FastAPI
        ↓
Next.js Food Screener
```

`scripts/ingest_menu.py` writes hashed snapshots only. Extraction is Phase 1.
