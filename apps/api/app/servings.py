import re
from typing import Literal

from sqlalchemy import ColumnElement, case, func, or_

from app.models import MenuItem

PizzaServing = Literal["slice", "whole", "unknown"]

_SLICE = re.compile(r"\b(?:slice|slices|by the slice)\b", re.I)
_WHOLE = re.compile(r"\b(?:whole|full pie|whole pie)\b", re.I)
_PIZZA_SIZE = re.compile(r"\b\d{1,2}(?:\.\d+)?\s*(?:in(?:ch(?:es)?)?|[″”])", re.I)


def classify_pizza_serving(
    *,
    canonical_category: str | None,
    raw_name: str,
    menu_section: str | None,
    portion: str | None,
    size: str | None,
) -> PizzaServing | None:
    """Classify pizza pricing units without mistaking sliced toppings for slices.

    Description text is intentionally excluded: phrases such as "sliced
    prosciutto" describe a topping, not the unit being sold.
    """
    if canonical_category != "pizza":
        return None

    identity_text = " ".join(filter(None, (raw_name, menu_section, portion)))
    if _SLICE.search(identity_text):
        return "slice"
    if _WHOLE.search(identity_text) or _PIZZA_SIZE.search(size or ""):
        return "whole"
    return "unknown"


def pizza_serving_sql_expr() -> ColumnElement[str | None]:
    """SQL mirror of classify_pizza_serving for WHERE/ORDER use."""
    identity = func.concat_ws(" ", MenuItem.raw_name, MenuItem.menu_section, MenuItem.portion)
    slice_match = identity.op("~*")(r"\m(?:slice|slices|by the slice)\M")
    whole_match = or_(
        identity.op("~*")(r"\m(?:whole|full pie|whole pie)\M"),
        func.coalesce(MenuItem.size, "").op("~*")(r"\m\d{1,2}(?:\.\d+)?\s*(?:in(?:ch(?:es)?)?|[″”])"),
    )
    return case(
        (or_(MenuItem.canonical_category.is_(None), MenuItem.canonical_category != "pizza"), None),
        (slice_match, "slice"),
        (whole_match, "whole"),
        else_="unknown",
    )
