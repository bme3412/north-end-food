#!/usr/bin/env python3
"""Load the hand-seeded restaurant corpus (NE_0001–NE_0045) into Postgres."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from app.seed import main  # noqa: E402

if __name__ == "__main__":
    main()
