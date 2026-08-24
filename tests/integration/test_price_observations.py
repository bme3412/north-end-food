from sqlalchemy import select

from app.models import MenuItem, MenuSnapshot, PriceObservation
from app.pricing import record_price_observations


def test_seed_writes_one_observation_per_priced_item(db_session):
    priced_items = db_session.scalar(
        select(MenuItem)
        .where(MenuItem.price.is_not(None), MenuItem.market_price.is_(False))
        .limit(1)
    )
    assert priced_items is not None

    priced_count = len(
        list(
            db_session.scalars(
                select(MenuItem.menu_item_id).where(
                    MenuItem.price.is_not(None), MenuItem.market_price.is_(False)
                )
            )
        )
    )
    observation_count = len(list(db_session.scalars(select(PriceObservation.price_observation_id))))
    assert observation_count == priced_count
    assert observation_count > 0


def test_observation_matches_its_menu_item(db_session):
    row = db_session.execute(
        select(PriceObservation, MenuItem).join(MenuItem, PriceObservation.menu_item_id == MenuItem.menu_item_id)
    ).first()
    observation, item = row

    assert observation.restaurant_id == item.restaurant_id
    assert observation.canonical_dish == item.canonical_dish
    assert observation.price == item.price


def test_record_price_observations_is_idempotent(db_session):
    snapshot = db_session.scalar(select(MenuSnapshot).where(MenuSnapshot.restaurant_id == "NE_0001"))
    before = len(list(db_session.scalars(select(PriceObservation.price_observation_id))))

    written = record_price_observations(db_session, snapshot)

    after = len(list(db_session.scalars(select(PriceObservation.price_observation_id))))
    assert written == 0
    assert after == before


def test_modern_pastry_has_no_price_observations(db_session):
    # NE_0004's prices are honestly null in the seed data -> nothing to observe.
    rows = list(db_session.scalars(select(PriceObservation).where(PriceObservation.restaurant_id == "NE_0004")))
    assert rows == []
