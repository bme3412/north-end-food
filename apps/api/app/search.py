from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

STOPWORDS = {
    "a",
    "an",
    "the",
    "in",
    "on",
    "of",
    "for",
    "and",
    "or",
    "to",
    "with",
    "at",
    "from",
}

BETWEEN = re.compile(
    r"\bbetween\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:and|-)\s*\$?\s*(\d+(?:\.\d+)?)\b",
    re.I,
)
UNDER = re.compile(
    r"\b(?:under|below|less than|up to|upto|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d+)?)\b",
    re.I,
)
OVER = re.compile(
    r"\b(?:over|above|more than|at least|min(?:imum)?)\s*\$?\s*(\d+(?:\.\d+)?)\b",
    re.I,
)
BARE_MAX = re.compile(r"(?:<=|<)\s*\$?\s*(\d+(?:\.\d+)?)")
BARE_MIN = re.compile(r"(?:>=|>)\s*\$?\s*(\d+(?:\.\d+)?)")

DIET_ALIASES = {
    "vegetarian": "vegetarian",
    "veggie": "vegetarian",
    "vegan": "vegetarian",
    "gluten-free": "gluten-free",
    "glutenfree": "gluten-free",
    "gf": "gluten-free",
}


@dataclass(frozen=True)
class ParsedQuery:
    tokens: list[str]
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    dietary: tuple[str, ...] = ()


def parse_query(raw: str | None) -> ParsedQuery:
    if not raw or not raw.strip():
        return ParsedQuery(tokens=[])

    text = raw.strip()
    min_price: Decimal | None = None
    max_price: Decimal | None = None

    match = BETWEEN.search(text)
    if match:
        min_price = Decimal(match.group(1))
        max_price = Decimal(match.group(2))
        text = BETWEEN.sub(" ", text)
    match = UNDER.search(text)
    if match:
        max_price = Decimal(match.group(1))
        text = UNDER.sub(" ", text)
    match = OVER.search(text)
    if match:
        min_price = Decimal(match.group(1))
        text = OVER.sub(" ", text)
    match = BARE_MAX.search(text)
    if match:
        max_price = Decimal(match.group(1))
        text = BARE_MAX.sub(" ", text)
    match = BARE_MIN.search(text)
    if match:
        min_price = Decimal(match.group(1))
        text = BARE_MIN.sub(" ", text)

    tokens: list[str] = []
    dietary: list[str] = []
    for part in re.split(r"[\s,]+", text.lower()):
        cleaned = part.strip(".#")
        if not cleaned or cleaned in STOPWORDS:
            continue
        if cleaned in DIET_ALIASES:
            tag = DIET_ALIASES[cleaned]
            if tag not in dietary:
                dietary.append(tag)
            continue
        tokens.append(cleaned)

    return ParsedQuery(
        tokens=tokens,
        min_price=min_price,
        max_price=max_price,
        dietary=tuple(dietary),
    )
