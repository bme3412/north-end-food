"""Add ingredients + menu_item_ingredients: a canonical Ingredient entity
and a CONTAINS join table, replacing raw-array-only ingredient matching.
Closes intent-build-plan.md Phase 5. menu_items.ingredients stays in place
as a fallback until the normalized path is proven.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010_ingredients"
down_revision: Union[str, Sequence[str], None] = "009_price_observations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ingredients",
        sa.Column("ingredient_id", sa.String(length=64), primary_key=True),
        sa.Column("canonical_name", sa.String(length=255), nullable=False),
        sa.Column("ingredient_category", sa.String(length=64), nullable=True),
        sa.Column("aliases", postgresql.ARRAY(sa.String()), nullable=True),
    )

    op.create_table(
        "menu_item_ingredients",
        sa.Column(
            "menu_item_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("menu_items.menu_item_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "ingredient_id",
            sa.String(length=64),
            sa.ForeignKey("ingredients.ingredient_id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.create_index("ix_menu_item_ingredients_ingredient_id", "menu_item_ingredients", ["ingredient_id"])


def downgrade() -> None:
    op.drop_index("ix_menu_item_ingredients_ingredient_id", table_name="menu_item_ingredients")
    op.drop_table("menu_item_ingredients")
    op.drop_table("ingredients")
