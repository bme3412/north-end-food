#!/usr/bin/env python3
"""Backfill canonical_dish onto seed_data.py item() calls for a category.

Conservative by design: only assigns canonical_dish when a menu item's
already-present raw_name or sauce field confidently matches one of that
category's CANONICAL_DISHES aliases. Anything ambiguous or unmatched is
left as-is and reported, never guessed -- consistent with this project's
"never fabricate" rule (see apps/api/app -- ratings/menus/prices are
never invented, only what's actually observed).

No new scraping, no LLM calls: every signal used here (raw_name, sauce)
is already sitting on the same item() line in seed_data.py, most of it
entered during the original manual restaurant-site audits.

Usage:
    python3 scripts/backfill_canonical_dish.py pasta            # dry run, prints a report
    python3 scripts/backfill_canonical_dish.py pasta --apply    # writes the edits to seed_data.py
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
SEED_DATA_PATH = API_ROOT / "app" / "seed_data.py"
sys.path.insert(0, str(API_ROOT))

from app.seed_data import CANONICAL_DISHES  # noqa: E402

ITEM_LINE_RE = re.compile(r'^\s*item\(\s*"(?P<raw_name>(?:[^"\\]|\\.)*)"')
CATEGORY_RE = re.compile(r'canonical_category="(?P<category>[^"]*)"')
DISH_RE = re.compile(r'canonical_dish="[^"]*"')
SAUCE_RE = re.compile(r'sauce="(?P<sauce>(?:[^"\\]|\\.)*)"')


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def build_alias_index(category: str) -> list[tuple[str, list[str]]]:
    """[(canonical_dish_id, [normalized aliases incl. canonical_name])]
    for the given category, longest alias first so a more specific alias
    (e.g. "chicken parmigiana") is tried before a shorter one that could
    coincidentally substring-match unrelated items."""
    entries = []
    for dish in CANONICAL_DISHES:
        if dish["category"] != category:
            continue
        aliases = {normalize(dish["canonical_name"])}
        aliases.update(normalize(a) for a in dish.get("aliases", []))
        aliases = sorted((a for a in aliases if a), key=len, reverse=True)
        entries.append((dish["canonical_dish_id"], aliases))
    return entries


def match_dish(raw_name: str, sauce: str | None, alias_index: list[tuple[str, list[str]]]) -> str | None:
    # Highest confidence: the item's own structured `sauce` field exactly
    # names a dish (e.g. sauce="bolognese" -> BOLOGNESE) -- this is a
    # value someone already entered deliberately, not a fuzzy guess.
    if sauce:
        norm_sauce = normalize(sauce)
        for dish_id, aliases in alias_index:
            if norm_sauce in aliases:
                return dish_id

    # Next: an alias appears as a whole-word-ish substring of raw_name.
    norm_name = normalize(raw_name)
    matches = set()
    for dish_id, aliases in alias_index:
        for alias in aliases:
            if re.search(rf"\b{re.escape(alias)}\b", norm_name):
                matches.add(dish_id)
                break
    if len(matches) == 1:
        return matches.pop()
    return None  # zero or ambiguous (multiple) matches -- don't guess


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("category", help="canonical_category to backfill, e.g. pasta")
    parser.add_argument("--apply", action="store_true", help="write edits to seed_data.py (default: dry run)")
    args = parser.parse_args()

    alias_index = build_alias_index(args.category)
    if not alias_index:
        print(f"No CANONICAL_DISHES entries found for category {args.category!r}.")
        return

    lines = SEED_DATA_PATH.read_text().splitlines(keepends=True)
    matched: Counter[str] = Counter()
    unmatched: Counter[str] = Counter()
    edits = 0

    for i, line in enumerate(lines):
        item_match = ITEM_LINE_RE.match(line)
        if not item_match:
            continue
        category_match = CATEGORY_RE.search(line)
        if not category_match or category_match.group("category") != args.category:
            continue
        if DISH_RE.search(line):
            continue  # already has canonical_dish

        raw_name = item_match.group("raw_name")
        sauce_match = SAUCE_RE.search(line)
        sauce = sauce_match.group("sauce") if sauce_match else None

        dish_id = match_dish(raw_name, sauce, alias_index)
        if dish_id is None:
            unmatched[raw_name] += 1
            continue

        matched[dish_id] += 1
        edits += 1
        if args.apply:
            # `category_match.group(0)` is `canonical_category="pasta"` with
            # no trailing comma -- the comma already present right after it
            # in the source line is what separates it from the *next*
            # original kwarg, so the new kwarg must be inserted with a
            # LEADING comma (and no trailing one) to avoid a double comma.
            lines[i] = line.replace(
                category_match.group(0),
                f'{category_match.group(0)}, canonical_dish="{dish_id}"',
                1,
            )

    print(f"Category: {args.category}")
    print(f"Matched {edits} item(s) across {len(matched)} canonical dish(es):")
    for dish_id, count in matched.most_common():
        print(f"  {count:4d}  {dish_id}")
    print(f"\nStill unmatched: {sum(unmatched.values())} item(s) across {len(unmatched)} distinct raw_name(s):")
    for raw_name, count in unmatched.most_common(30):
        print(f"  {count:4d}  {raw_name}")
    if len(unmatched) > 30:
        print(f"  ... and {len(unmatched) - 30} more distinct names")

    if args.apply:
        SEED_DATA_PATH.write_text("".join(lines))
        print(f"\nWrote {edits} edit(s) to {SEED_DATA_PATH}")
    else:
        print("\nDry run -- no files changed. Re-run with --apply to write these edits.")


if __name__ == "__main__":
    main()
