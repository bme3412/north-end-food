"""Intent-first ranking for free-text menu-item search.

Matching and ranking are deliberately separate. The query remains permissive
enough to find aliases, ingredients, descriptions, and misspellings, while a
hard intent tier prevents those broad matches from outranking a literal dish
name. A balanced secondary score then orders genuinely comparable results.
"""

from __future__ import annotations

import math
import re
from decimal import Decimal

from sqlalchemy import ColumnElement, and_, case, func, or_

from app.models import MenuItem, Restaurant
from app.queries import dish_match_clause

# pg_trgm similarity() returns 0..1. 0.25 catches realistic single-word
# typos ("carbonera" vs "Carbonara" scores well above this) without the
# false-positive rate of the library default (0.3 is tuned for exact-ish
# matches, not deliberately-fuzzy free text).
SIMILARITY_THRESHOLD = 0.25

NORTH_END_LATITUDE = 42.3642
NORTH_END_LONGITUDE = -71.054


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


def relevance_expressions(tokens: list[str]):
    """Return SQL expressions for the result's worst token tier and text quality.

    Every token is already required by the WHERE clause. Taking the greatest
    (weakest) tier means a multi-word query cannot be promoted by one strong
    token while its other token only matches incidental metadata.
    """
    token_tiers = []
    for token in tokens:
        like = f"%{token}%"
        whole_word = MenuItem.raw_name.op("~*")(fr"\m{re.escape(token)}\M")
        fuzzy_name = or_(
            MenuItem.raw_name.ilike(like),
            func.similarity(MenuItem.raw_name, token) > SIMILARITY_THRESHOLD,
        )
        dish_match = or_(
            MenuItem.canonical_dish.ilike(like),
            dish_match_clause(token),
        )
        # Whole-word on the restaurant name, not ILIKE: "pizza" should not
        # promote every item at Pizzeria Regina, but "Neptune" / "Oyster"
        # should promote that restaurant's items above description/category hits.
        restaurant_match = Restaurant.name.op("~*")(fr"\m{re.escape(token)}\M")
        description_match = or_(
            MenuItem.raw_description.ilike(like),
            func.similarity(func.coalesce(MenuItem.raw_description, ""), token) > SIMILARITY_THRESHOLD,
        )
        category_match = MenuItem.canonical_category.ilike(like)
        token_tiers.append(
            case(
                (and_(whole_word, MenuItem.canonical_dish.is_not(None)), 0),
                (fuzzy_name, 1),
                (dish_match, 2),
                (restaurant_match, 3),
                (description_match, 4),
                (category_match, 5),
                else_=6,
            )
        )
    intent_tier = token_tiers[0] if len(token_tiers) == 1 else func.greatest(*token_tiers)
    return intent_tier, _text_score(tokens)


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _distance_miles(latitude: float | None, longitude: float | None) -> float | None:
    if latitude is None or longitude is None:
        return None
    radius_miles = 3958.8
    lat1 = math.radians(NORTH_END_LATITUDE)
    lat2 = math.radians(latitude)
    delta_lat = lat2 - lat1
    delta_lng = math.radians(longitude - NORTH_END_LONGITUDE)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    return radius_miles * 2 * math.asin(math.sqrt(a))


def balanced_secondary_score(
    *,
    available: bool,
    open_now: bool | None,
    match_quality: float,
    rating: Decimal | None,
    review_count: int | None,
    pct_vs_median: float | None,
    latitude: float | None,
    longitude: float | None,
) -> float:
    """Score comparable results without allowing those signals to override intent."""
    availability = 1.0 if available else 0.0
    open_score = 1.0 if open_now is True else 0.0 if open_now is False else 0.5
    quality = _clamp(match_quality / 1.5)

    if rating is None:
        rating_score = 0.5
    else:
        reviews = max(0, review_count or 0)
        effective_rating = (reviews * float(rating) + 50 * 4.2) / (reviews + 50)
        rating_score = _clamp((effective_rating - 3.0) / 2.0)

    value_score = 0.5 if pct_vs_median is None else _clamp(0.5 - pct_vs_median / 100)
    distance = _distance_miles(latitude, longitude)
    distance_score = 0.5 if distance is None else 1 - _clamp(distance / 0.75)

    return (
        availability * 0.12
        + open_score * 0.18
        + quality * 0.35
        + rating_score * 0.15
        + value_score * 0.12
        + distance_score * 0.08
    )
