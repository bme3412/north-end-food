Phase 1 target: fetch → extract → normalize.

Fetch + hash + snapshot: `scripts/ingest_menu.py`.

Extract + normalize is implemented, but lives in `apps/api/app/extraction/`
(run via `scripts/extract_menu.py` + `scripts/review_extraction.py`) rather
than as a standalone service here — there's no shared-models package yet
(see `packages/schemas`), so splitting this into its own deployable would
mean duplicating the SQLAlchemy models. Revisit once that's solved or once
scale/scheduling needs actually require a separate worker process.
