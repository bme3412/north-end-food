from app.servings import classify_pizza_serving


def classify(**overrides):
    values = {
        "canonical_category": "pizza",
        "raw_name": "Margherita Pizza",
        "menu_section": "Pizza",
        "portion": None,
        "size": None,
    }
    values.update(overrides)
    return classify_pizza_serving(**values)


def test_classifies_slice_from_item_identity_or_section():
    assert classify(raw_name="Cheese Pizza Slice") == "slice"
    assert classify(menu_section="Pizza by the Slice") == "slice"
    assert classify(portion="slice") == "slice"


def test_classifies_whole_from_explicit_unit_or_diameter():
    assert classify(portion="whole") == "whole"
    assert classify(size="16 inch") == "whole"
    assert classify(size="12″") == "whole"


def test_does_not_mistake_sliced_toppings_for_a_slice():
    assert classify(raw_name="Prosciutto Pizza", portion=None, size=None) == "unknown"
    assert (
        classify_pizza_serving(
            canonical_category="antipasti",
            raw_name="Thinly sliced prosciutto",
            menu_section="Starters",
            portion=None,
            size=None,
        )
        is None
    )
