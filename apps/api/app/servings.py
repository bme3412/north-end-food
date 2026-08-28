import re
from typing import Literal

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
