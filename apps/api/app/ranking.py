"""Blended relevance ranking for free-text menu-item search.

Postgres full-text search (`MenuItem.search_vector`, multi-word, stemmed,
field-weighted) and pg_trgm similarity solve different halves of "fuzzy,
relevant search": ts_rank understands word importance but not misspellings;
trigram similarity tolerates misspellings but not word importance. Blended
here with a small price/value nudge (reusing the same medians `_to_out`
already computes) and an extraction-confidence nudge, as one SQL ORDER BY
expression -- no app-layer re-ranking pass, since every signal here is
natively SQL-expressible at this dataset's scale (see architecture-audit.md
section 1 on the ~6,000-item Phase-0 ceiling).

Structured filters (category/price/protein/ingredient/dietary) are untouched
by any of this -- only free-text matching (`fuzzy_token_clause`) and the
default ORDER BY (`relevance_order_by`) change.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ColumnElement, and_, case, func, or_

from app.models import MenuItem
from app.queries import DishCategoryMedians

# pg_trgm similarity() returns 0..1. 0.25 catches realistic single-word
# typos ("carbonera" vs "Carbonara" scores well above this) without the
# false-positive rate of the library default (0.3 is tuned for exact-ish
# matches, not deliberately-fuzzy free text).
SIMILARITY_THRESHOLD = 0.25

# Weights for the blended score. text_score dominates (its own scale is
# roughly 0-1.5 after the trigram bonus); value/confidence are tie-breakers
# among similarly-relevant results, not primary ranking signals.
VALUE_WEIGHT = 0.15
CONFIDENCE_WEIGHT = 0.1
DEFAULT_CONFIDENCE = Decimal("0.7")


def fuzzy_token_clause(token: str) -> ColumnElement[bool]:
    """True if `token` ILIKE-matches or is trigram-similar to the item's own
    name or description. A misspelling like "carbonera" still matches
    "Carbonara" this way -- a bare ILIKE substring check never could, and
    this is the one already-idle index (migration 001) put to use.
    """
    like = f"%{token}%"
    return or_(
        MenuItem.raw_name.ilike(like),
        func.similarity(MenuItem.raw_name, token) > SIMILARITY_THRESHOLD,
        MenuItem.raw_description.ilike(like),
        func.similarity(func.coalesce(MenuItem.raw_description, ""), token) > SIMILARITY_THRESHOLD,
    )


def _text_score(tokens: list[str]):
    tsquery = func.plainto_tsquery("english", " ".join(tokens))
    rank = func.ts_rank(MenuItem.search_vector, tsquery)
    best_similarity = func.greatest(0.0, *[func.similarity(MenuItem.raw_name, token) for token in tokens])
    return rank + best_similarity * 0.5


def _value_score(medians: DishCategoryMedians):
    """(median - price) / median, 0 when there's no median to compare
    against. Dish-level medians take priority over category-level, matching
    `DishCategoryMedians.median_for`'s own fallback order.
    """
    whens = [(MenuItem.canonical_dish == dish, float(median)) for dish, median in medians.by_dish.items()]
    whens += [
        (MenuItem.canonical_category == category, float(median))
        for category, median in medians.by_category.items()
    ]
    if not whens:
        return 0
    median_expr = func.coalesce(case(*whens, else_=None), 0.0)
    price_expr = func.coalesce(MenuItem.price, 0)
    return case(
        (and_(median_expr > 0, MenuItem.price.is_not(None)), (median_expr - price_expr) / median_expr),
        else_=0,
    )


def relevance_order_by(tokens: list[str], medians: DishCategoryMedians):
    """Composite ORDER BY for a non-empty free-text query: text relevance
    dominates, price/value and extraction-confidence break ties among
    similarly-relevant results.
    """
    confidence = func.coalesce(MenuItem.normalization_confidence, DEFAULT_CONFIDENCE)
    score = _text_score(tokens) + _value_score(medians) * VALUE_WEIGHT + confidence * CONFIDENCE_WEIGHT
    return score.desc()
