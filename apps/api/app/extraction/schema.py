"""The structured-output contract Gemini must fill in. Mirrors MenuItem's
columns (minus DB-internal ids) using JSON-friendly types — float instead of
Decimal, since JSON has no Decimal type; the pipeline converts on write.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ExtractedItem(BaseModel):
    raw_name: str
    raw_description: str | None = None
    raw_price_text: str | None = None
    price: float | None = None
    menu_section: str | None = None
    canonical_category: str | None = None
    canonical_dish: str | None = None
    protein: list[str] = Field(default_factory=list)
    pasta_type: str | None = None
    sauce: str | None = None
    preparation: str | None = None
    ingredients: list[str] = Field(default_factory=list)
    dietary_tags: list[str] = Field(default_factory=list)
    portion: str | None = None
    size: str | None = None
    seasonal: bool = False
    market_price: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractionResult(BaseModel):
    items: list[ExtractedItem] = Field(default_factory=list)
