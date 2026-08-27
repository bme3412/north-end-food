from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot

# Merges for raw variants confirmed, by inspecting the actual seeded corpus,
# to name the same ingredient — plural/singular pairs and spelling variants
# only. Deliberately NOT merged: named varieties of a base ingredient
# ("ipswich clams", "san marzano tomato") stay distinct from the generic
# form, since collapsing those would throw away real information the
# extraction captured. Grows as new variants are confirmed; anything not
# listed here canonicalizes to itself.
_ALIAS_MERGES = {
    "mushrooms": "mushroom",
    "onions": "onion",
    "roasted red peppers": "roasted red pepper",
    "fava beans": "fava bean",
    "clams": "clam",
    "bufala mozzarella": "buffalo mozzarella",
    "parmigiano": "parmesan",
}

_SLUG_RE = re.compile(r"[^A-Z0-9]+")

# Keyword -> category, checked in order against the canonical form (first
# match wins). A keyword table generalizes to ingredients not seen yet,
# unlike a fixed per-ingredient dict that needs an entry for every new
# item — matching this module's own "grows over time, don't over-build"
# instinct (see _ALIAS_MERGES above). Anything unmatched falls back to
# "other" rather than blocking resolution.
_CATEGORY_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "cheese",
        (
            "cheese", "mozzarella", "parmesan", "pecorino", "ricotta", "feta", "cheddar", "mascarpone",
            "burrata", "romano", "provolone", "asiago", "fontina", "gorgonzola", "grana", "provola",
            "scamorza", "stracciatella", "parmigian",
        ),
    ),
    (
        "seafood",
        (
            "lobster", "shrimp", "scallop", "clam", "mussel", "oyster", "crab", "octopus", "calamari",
            "tuna", "salmon", "fish", "sardine", "mackerel", "branzino", "sea bass", "sea bream", "redfish",
            "bluefin", "swordfish", "urchin", "caviar", "shellfish", "squid", "sole", "anchov",
            "cherrystone", "little neck", "cod", "tobiko", "seafood",
        ),
    ),
    (
        "protein",
        (
            "chicken", "beef", "veal", "pork", "sausage", "bacon", "prosciutto", "pancetta", "salami",
            "soppressata", "pepperoni", "chorizo", "nduja", "linguica", "egg", "wild boar", "ribeye",
            "salt pork", "patty", "guanciale", "speck", "rabbit", "lamb", "ham", "meat",
            "bison", "coppa", "mortadella", "porchetta", "cold cut", "steak", "tenderloin", "rib",
            "venison",
        ),
    ),
    (
        "vegetable",
        (
            "onion", "garlic", "tomato", "spinach", "eggplant", "zucchini", "broccoli", "cauliflower",
            "pepper", "jalape", "peperoncino", "peperonata", "piri piri", "mushroom", "porcini", "artichoke",
            "asparagus", "fennel", "cucumber", "radish", "turnip", "brussel", "corn", "olive", "pickle",
            "potato", "fava bean", "haricot verts", "pumpkin", "beet", "watercress", "celery", "chick pea",
            "green bean", "kale", "leek", "lettuce", "mixed greens", "parsnip", "romaine", "white bean",
            "peas", "grilled vegetables", "vegetable", "green", "arugula", "carrot", "shallot", "scallion",
            "escarole", "radicchio", "squash", "bean", "chil", "giardiniera", "insalata", "slaw",
            "cipollini", "frisee", "lentil", "sweet pea",
        ),
    ),
    ("herb", ("basil", "sage", "thyme", "anise", "parsley", "rosemary", "oregano", "tarragon", "mint", "cilantro", "herb")),
    (
        "fruit",
        (
            "apple", "apricot", "blueberry", "cranberry", "raisin", "raspberry", "strawberry", "lemon",
            "avocado", "banana", "berr", "cherr", "coconut", "fig", "mango", "melon", "orange", "peach",
            "pear", "watermelon", "lime", "currant", "citrus", "passion fruit", "fruit",
        ),
    ),
    ("nut", ("almond", "pine nut", "pinenut", "pistachio", "walnut", "hazelnut", "pignoli", "pecan")),
    (
        "grain_starch",
        (
            "rice", "bread", "baguette", "brioche", "ciabatta", "cornbread", "johnnycake", "fries",
            "pasta", "linguine", "pappardelle", "penne", "risotto", "ziti", "focaccia", "crouton",
            "semolina", "agnolotti", "crostini", "gnocchi", "polenta", "rigatoni", "bombolotti",
            "capellini", "bagel", "toast", "sourdough", "crepe", "pancake", "panko", "waffle", "quinoa",
            "roll", "fregola",
        ),
    ),
    (
        "sauce_condiment",
        (
            "sauce", "pesto", "marinara", "aioli", "romesco", "piperrada", "besciamella", "brodo",
            "arrabiata", "honey", "peanut butter", "nutella", "oil", "vinegar", "tartar", "balsamic",
            "caesar dressing", "caper", "dijon", "mustard", "vincotto", "muffaletta", "bolognese",
            "ragu", "ragú", "chile", "alfredo", "chimichurri", "ponzu", "shoyu", "bagna cauda",
            "gremolata", "salsa", "vinaigrette", "dressing", "evoo", "maple", "syrup", "topping",
            "pomodoro", "chipotle", "tzatziki", "soy",
        ),
    ),
    ("dairy", ("cream", "butter")),
    (
        "dessert",
        (
            "gelato", "ladyfinger", "lady finger", "amaretti", "custard", "caramel", "zabaglione",
            "savoiardi", "chocolate", "biscotti", "cannoli", "cookie", "vanilla", "tiramisu",
            "marzipan", "mousse", "fudge", "ganache", "sugar", "icing", "crumble", "cotton candy",
            "tres leches", "jimmies", "oreo",
        ),
    ),
    (
        "beverage",
        (
            "wine", "espresso martini", "limoncello", "prosecco", "brandy", "espresso", "amaretto",
            "liqueur", "frangelico", "rum", "marsala", "barolo", "coffee", "cappuccino", "mocha",
        ),
    ),
    ("seasoning", ("salt", "sesame", "ginger", "truffle", "saffron", "cinnamon", "cocoa", "paprika", "togarashi")),
)


def _infer_ingredient_category(canonical_form: str) -> str:
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(keyword in canonical_form for keyword in keywords):
            return category
    return "other"


def _normalize(raw: str) -> str:
    return " ".join(raw.strip().lower().split())


def _canonical_form(raw: str) -> str:
    normalized = _normalize(raw)
    return _ALIAS_MERGES.get(normalized, normalized)


def _slug(canonical_form: str) -> str:
    return _SLUG_RE.sub("_", canonical_form.upper()).strip("_")


def _resolve_ingredient(db: Session, raw: str) -> Ingredient | None:
    normalized = _normalize(raw)
    if not normalized:
        return None

    canonical_form = _canonical_form(raw)
    ingredient_id = _slug(canonical_form)
    if not ingredient_id:
        return None

    ingredient = db.get(Ingredient, ingredient_id)
    if ingredient is None:
        ingredient = Ingredient(
            ingredient_id=ingredient_id,
            canonical_name=canonical_form.title(),
            ingredient_category=_infer_ingredient_category(canonical_form),
            aliases=[normalized],
        )
        db.add(ingredient)
        db.flush()
    else:
        if normalized not in (ingredient.aliases or []):
            ingredient.aliases = [*(ingredient.aliases or []), normalized]
        if ingredient.ingredient_category is None:
            ingredient.ingredient_category = _infer_ingredient_category(canonical_form)

    return ingredient


def record_menu_item_ingredients(db: Session, snapshot: MenuSnapshot) -> int:
    """Resolve each priced-or-not item's raw `ingredients` array in `snapshot`
    into canonical Ingredient rows and CONTAINS join rows.

    Idempotent — skips (menu_item, ingredient) pairs that already exist, so
    it's safe to call from seed/backfill scripts and from the review-approval
    path without double-writing. Only call once a snapshot is trusted
    (extraction_status "complete" or "manual_seed"), matching
    record_price_observations — an unreviewed extraction shouldn't be able
    to add ingredients to the live search graph.
    """
    items = list(
        db.scalars(
            select(MenuItem).where(
                MenuItem.menu_snapshot_id == snapshot.menu_snapshot_id,
                MenuItem.ingredients.is_not(None),
            )
        )
    )
    if not items:
        return 0

    existing_pairs = set(
        db.execute(
            select(MenuItemIngredient.menu_item_id, MenuItemIngredient.ingredient_id).where(
                MenuItemIngredient.menu_item_id.in_([item.menu_item_id for item in items])
            )
        ).all()
    )

    written = 0
    for item in items:
        if not item.ingredients:
            continue
        seen_for_item: set[str] = set()
        for raw in item.ingredients:
            ingredient = _resolve_ingredient(db, raw)
            if ingredient is None or ingredient.ingredient_id in seen_for_item:
                continue
            seen_for_item.add(ingredient.ingredient_id)
            pair = (item.menu_item_id, ingredient.ingredient_id)
            if pair in existing_pairs:
                continue
            db.add(MenuItemIngredient(menu_item_id=item.menu_item_id, ingredient_id=ingredient.ingredient_id))
            existing_pairs.add(pair)
            written += 1
    return written
