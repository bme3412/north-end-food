"""Add menu_items.search_vector (generated tsvector, GIN indexed) and a
trigram GIN index on raw_description, so free-text search can rank by
relevance (ts_rank + pg_trgm similarity) instead of returning unordered
ILIKE matches. Closes intent-build-plan.md Phase 9.1's missing ranking
half and activates the pg_trgm index that migration 001 created but no
query has ever used. Search, Indexing & Canonicalization Plan, Phase 1.
"""

from typing import Sequence, Union

from alembic import op

from app.models.menu import SEARCH_VECTOR_SQL

revision: str = "011_search_ranking"
down_revision: Union[str, Sequence[str], None] = "010_ingredients"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(f"ALTER TABLE menu_items ADD COLUMN search_vector tsvector GENERATED ALWAYS AS ({SEARCH_VECTOR_SQL}) STORED")
    op.create_index("ix_menu_items_search_vector", "menu_items", ["search_vector"], postgresql_using="gin")
    op.execute("CREATE INDEX ix_menu_items_raw_description_trgm ON menu_items USING gin (raw_description gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_menu_items_raw_description_trgm")
    op.drop_index("ix_menu_items_search_vector", table_name="menu_items")
    op.execute("ALTER TABLE menu_items DROP COLUMN search_vector")
