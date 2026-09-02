"""Remove Mother Anna's from the public restaurant catalog.

Revision ID: 022_remove_mother_annas
Revises: 021_seed_verified_google_places
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "022_remove_mother_annas"
down_revision: str | None = "021_seed_verified_google_places"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE restaurants
            SET active = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE restaurant_id = 'NE_0012'
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE restaurants
            SET active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            WHERE restaurant_id = 'NE_0012'
            """
        )
    )
