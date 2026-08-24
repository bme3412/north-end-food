from sqlalchemy import select

from app.ingredients import record_menu_item_ingredients
from app.models import Ingredient, MenuItem, MenuItemIngredient, MenuSnapshot


def test_seed_creates_ingredients_and_links(db_session):
    ingredient_count = len(list(db_session.scalars(select(Ingredient.ingredient_id))))
    link_count = len(list(db_session.scalars(select(MenuItemIngredient.menu_item_id))))
    assert ingredient_count > 0
    assert link_count > 0


def test_plural_and_singular_merge_to_one_ingredient(db_session):
    mushroom = db_session.get(Ingredient, "MUSHROOM")
    assert mushroom is not None
    assert "mushroom" in mushroom.aliases
    assert "mushrooms" in mushroom.aliases


def test_spelling_variant_merges_to_one_ingredient(db_session):
    # "bufala mozzarella" and "buffalo mozzarella" name the same cheese.
    canonical = db_session.get(Ingredient, "BUFFALO_MOZZARELLA")
    assert canonical is not None
    assert "bufala mozzarella" in canonical.aliases
    assert "buffalo mozzarella" in canonical.aliases
    # Plain "mozzarella" is a distinct, more generic ingredient.
    assert db_session.get(Ingredient, "MOZZARELLA") is not None


def test_named_variety_stays_distinct_from_generic_form(db_session):
    # "ipswich clams" is a specific variety, not merged into generic "clam".
    assert db_session.get(Ingredient, "CLAM") is not None
    assert db_session.get(Ingredient, "IPSWICH_CLAMS") is not None


def test_link_matches_its_menu_item(db_session):
    row = db_session.execute(
        select(MenuItemIngredient, MenuItem).join(
            MenuItem, MenuItemIngredient.menu_item_id == MenuItem.menu_item_id
        )
    ).first()
    link, item = row
    assert item.ingredients is not None
    canonical = db_session.get(Ingredient, link.ingredient_id)
    assert any(alias in [i.lower() for i in item.ingredients] for alias in canonical.aliases)


def test_record_menu_item_ingredients_is_idempotent(db_session):
    snapshot = db_session.scalar(select(MenuSnapshot).where(MenuSnapshot.restaurant_id == "NE_0001"))
    before = len(list(db_session.scalars(select(MenuItemIngredient.menu_item_id))))

    written = record_menu_item_ingredients(db_session, snapshot)

    after = len(list(db_session.scalars(select(MenuItemIngredient.menu_item_id))))
    assert written == 0
    assert after == before
