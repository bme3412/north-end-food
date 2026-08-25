"""Data-only migration: add "four cheese" / "four cheese pizza" to the
White Pizza canonical dish's alias list.

seed_data.py already has these aliases (see the code change alongside
migration 011's dish_match_clause work), but seed.py's seed(reset=True)
is destructive -- not something to run against a live database just to
pick up a two-string data fix. This patches already-seeded databases
(production included) in place via the same `alembic upgrade head` step
that already runs on every deploy (apps/api/Dockerfile's CMD), so no
manual production access is needed. A no-op if the row doesn't exist yet
(fresh databases get the aliases from seed_data.py directly).
"""

from typing import Sequence, Union

from alembic import op

revision: str = "012_white_pizza_aliases"
down_revision: Union[str, Sequence[str], None] = "011_search_ranking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ALIASES = ["four cheese", "four cheese pizza"]


def upgrade() -> None:
    op.execute(
        "UPDATE canonical_dishes "
        "SET aliases = ARRAY(SELECT DISTINCT unnest(coalesce(aliases, ARRAY[]::varchar[]) || ARRAY['four cheese', 'four cheese pizza'])) "
        "WHERE canonical_dish_id = 'WHITE_PIZZA'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE canonical_dishes "
        "SET aliases = ARRAY(SELECT a FROM unnest(aliases) AS a WHERE a NOT IN ('four cheese', 'four cheese pizza')) "
        "WHERE canonical_dish_id = 'WHITE_PIZZA'"
    )
