"""Add restaurants.photo_url for hero photos served from apps/web/public."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_restaurant_photo_url"
down_revision: Union[str, Sequence[str], None] = "002_extractor_model_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("photo_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurants", "photo_url")
