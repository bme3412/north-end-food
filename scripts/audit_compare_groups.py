#!/usr/bin/env python3
"""Read-only audit of like-for-like compare groups across the seed corpus.

Walks seed_data.py + seed_wave2.py and prints markdown: coverage, over-merged
canonical dishes, and unmapped items that look like existing twins.

    python3 scripts/audit_compare_groups.py
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from app.seed_data import CANONICAL_DISHES, RESTAURANTS  # noqa: E402
from app.seed_wave2 import WAVE2_RESTAURANTS  # noqa: E402

SHAPE_DISHES = {"GNOCCHI", "RAVIOLI"}
PROTEIN_FAMILIES = (
    ("lobster", re.compile(r"\b(lobster|aragosta|astice)\b")),
    ("seafood", re.compile(r"\b(shrimp|scallop|mussel|calamari|seafood|salmon|fish)\b")),
    ("meat", re.compile(r"\b(short rib|sausage|salsiccia|meatball|speck|chicken|veal|beef|pork)\b")),
)
PREP_FAMILIES = (
    ("sorrentina", re.compile(r"\bsorrentina\b")),
    ("vodka", re.compile(r"\b(alla )?vodka\b")),
    ("cacio", re.compile(r"\bcacio(?: e | de | )?pepe\b")),
    ("funghi", re.compile(r"\b(funghi|mushroom)\b")),
)
TOKEN_RE = re.compile(
    r"\b(lobster|aragosta|short rib|truffle|sorrentina|vodka|pesto|cacio)\b",
    re.I,
)


def haystack(item: dict[str, Any]) -> str:
    bits = [
        item.get("raw_name") or "",
        item.get("raw_description") or "",
        item.get("sauce") or "",
        " ".join(item.get("protein") or []),
        " ".join(item.get("ingredients") or []),
    ]
    return " ".join(bits).lower()


def protein_family(item: dict[str, Any]) -> str | None:
    text = haystack(item)
    for name, pattern in PROTEIN_FAMILIES:
        if pattern.search(text):
            return name
    return None


def prep_family(item: dict[str, Any]) -> str | None:
    text = haystack(item)
    for name, pattern in PREP_FAMILIES:
        if pattern.search(text):
            return name
    return None


def compare_variant(item: dict[str, Any]) -> str | None:
    dish = item.get("canonical_dish")
    protein = protein_family(item)
    prep = prep_family(item)
    if dish in SHAPE_DISHES:
        return protein or prep
    if protein in {"lobster", "seafood"}:
        return protein
    return prep if prep and dish in SHAPE_DISHES else None


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def collect_items() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for restaurant in RESTAURANTS + WAVE2_RESTAURANTS:
        for item in restaurant.get("items") or []:
            rows.append({**item, "restaurant_name": restaurant["name"], "restaurant_id": restaurant["restaurant_id"]})
    return rows


def alias_index() -> list[tuple[str, list[str]]]:
    entries = []
    for dish in CANONICAL_DISHES:
        aliases = {normalize(dish["canonical_name"])}
        aliases.update(normalize(a) for a in dish.get("aliases", []))
        aliases = sorted((a for a in aliases if a), key=len, reverse=True)
        entries.append((dish["canonical_dish_id"], aliases))
    return entries


def match_unmapped(raw_name: str, index: list[tuple[str, list[str]]]) -> str | None:
    norm = normalize(raw_name)
    hits = set()
    for dish_id, aliases in index:
        for alias in aliases:
            if re.search(rf"\b{re.escape(alias)}\b", norm):
                hits.add(dish_id)
                break
    return hits.pop() if len(hits) == 1 else None


def fmt_price(price: float | None) -> str:
    if price is None:
        return "Ask"
    return f"${price:g}"


def main() -> None:
    items = collect_items()
    by_dish: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        category = item.get("canonical_category") or "uncategorized"
        by_category[category].append(item)
        if item.get("canonical_dish"):
            by_dish[item["canonical_dish"]].append(item)

    print("# Compare-group audit")
    print()
    print(f"{len(items)} seeded items across {len(RESTAURANTS) + len(WAVE2_RESTAURANTS)} restaurants.")
    print()
    print("## Coverage")
    print()
    print("| Category | Items | With dish id | Coverage |")
    print("| --- | ---: | ---: | ---: |")
    for category, rows in sorted(by_category.items(), key=lambda pair: (-len(pair[1]), pair[0])):
        mapped = sum(1 for row in rows if row.get("canonical_dish"))
        pct = round(100 * mapped / len(rows)) if rows else 0
        print(f"| {category} | {len(rows)} | {mapped} | {pct}% |")

    print()
    print("## Over-merged groups")
    print()
    print("A group is over-merged when members mix protein families, the priced")
    print("spread is at least 1.8x, or names carry a distinctive token")
    print("(lobster, sorrentina, truffle, …) that the rest of the group does not share.")
    print()

    gnocchi = by_dish.get("GNOCCHI", [])
    if gnocchi:
        print("### GNOCCHI (first example)")
        print()
        print("Lobster plates (Arya, Little Sage) currently sit with tomato-and-mozzarella")
        print("sorrentina (Rocco’s $19.95). Gnocchi is a shape, not a sauce.")
        print()
        for item in sorted(gnocchi, key=lambda row: (row.get("price") is None, row.get("price") or 0)):
            variant = compare_variant(item) or "plain"
            print(
                f"- {item['restaurant_name']}: {item['raw_name']} "
                f"({fmt_price(item.get('price'))}) → `{variant}`"
            )
        print()

    for dish_id, rows in sorted(by_dish.items(), key=lambda pair: (-len(pair[1]), pair[0])):
        if dish_id == "GNOCCHI":
            continue
        families = {protein_family(row) for row in rows}
        preps = {prep_family(row) for row in rows}
        prices = [row["price"] for row in rows if row.get("price") is not None]
        tokens = {match.group(1).lower() for row in rows for match in TOKEN_RE.finditer(haystack(row))}
        spread = prices and max(prices) / min(prices) >= 1.8 if prices and min(prices) > 0 else False
        mixed_protein = len(families - {None}) > 1
        mixed_prep = len(preps - {None}) > 1
        mixed_tokens = len(tokens) > 1
        if not (mixed_protein or mixed_prep or spread or mixed_tokens):
            continue
        reasons = []
        if mixed_protein:
            reasons.append("mixed protein")
        if mixed_prep:
            reasons.append("mixed prep")
        if spread:
            reasons.append(f"price {min(prices):g}–{max(prices):g}")
        if mixed_tokens:
            reasons.append("tokens: " + ", ".join(sorted(tokens)))
        print(f"### {dish_id} ({len(rows)} items — {', '.join(reasons)})")
        print()
        for item in sorted(rows, key=lambda row: (row.get("price") is None, row.get("price") or 0)):
            variant = compare_variant(item) or "plain"
            print(
                f"- {item['restaurant_name']}: {item['raw_name']} "
                f"({fmt_price(item.get('price'))}) → `{variant}`"
            )
        print()

    print("## High-count variants (2+ restaurants)")
    print()
    variant_restaurants: dict[tuple[str, str], set[str]] = defaultdict(set)
    for item in items:
        dish = item.get("canonical_dish")
        variant = compare_variant(item)
        if not dish or not variant:
            continue
        variant_restaurants[(dish, variant)].add(item["restaurant_id"])
    promoted = [(dish, variant, places) for (dish, variant), places in variant_restaurants.items() if len(places) >= 2]
    if not promoted:
        print("None.")
    for dish, variant, places in sorted(promoted, key=lambda row: (-len(row[2]), row[0], row[1])):
        print(f"- `{dish}_{variant.upper()}` — {len(places)} restaurants")
    print()

    print("## Unmapped twins")
    print()
    index = alias_index()
    twins: list[tuple[str, str, str]] = []
    for item in items:
        if item.get("canonical_dish"):
            continue
        guess = match_unmapped(item["raw_name"], index)
        if guess:
            twins.append((guess, item["restaurant_name"], item["raw_name"]))
    if not twins:
        print("None.")
    for dish_id, restaurant, name in sorted(twins):
        print(f"- {restaurant}: {name} → `{dish_id}`")


if __name__ == "__main__":
    main()
