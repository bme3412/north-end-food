import re
from typing import Literal

from sqlalchemy import ColumnElement, case, func, or_

from app.models import MenuItem

PizzaServing = Literal["slice", "whole", "unknown"]

_SLICE = re.compile(r"\b(?:slice|slices|by the slice)\b", re.I)


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
    prosciutto" describe a topping, not the unit being sold. An unmarked
    pizza is a whole pie -- North End menus rarely say "whole."
    """
    if canonical_category != "pizza":
        return None

    identity_text = " ".join(filter(None, (raw_name, menu_section, portion, size)))
    if _SLICE.search(identity_text):
        return "slice"
    return "whole"


def pizza_serving_sql_expr() -> ColumnElement[str | None]:
    """SQL mirror of classify_pizza_serving for WHERE/ORDER use."""
    identity = func.concat_ws(
        " ",
        MenuItem.raw_name,
        MenuItem.menu_section,
        MenuItem.portion,
        MenuItem.size,
    )
    slice_match = identity.op("~*")(r"\m(?:slice|slices|by the slice)\M")
    return case(
        (or_(MenuItem.canonical_category.is_(None), MenuItem.canonical_category != "pizza"), None),
        (slice_match, "slice"),
        else_="whole",
    )
