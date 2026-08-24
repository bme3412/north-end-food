"""Widen extractor_model so provenance notes fit."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_extractor_model_text"
down_revision: Union[str, Sequence[str], None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "menu_snapshots",
        "extractor_model",
        existing_type=sa.String(length=128),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "menu_snapshots",
        "extractor_model",
        existing_type=sa.Text(),
        type_=sa.String(length=128),
        existing_nullable=True,
    )
