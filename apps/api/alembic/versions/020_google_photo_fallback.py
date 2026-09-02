"""Add verified Google IDs, summary reports, and photo usage guard.

Revision ID: 020_google_photo_fallback
Revises: 019_add_15_restaurants
"""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "020_google_photo_fallback"
down_revision: str | None = "019_add_15_restaurants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("restaurant_external_ids", sa.Column("verification_status", sa.String(32), nullable=False, server_default="unverified"))
    op.add_column("restaurant_external_ids", sa.Column("verified_by", sa.String(255)))
    op.add_column("restaurant_place_stats", sa.Column("place_summary_flag_uri", sa.String(1024)))
    op.add_column("restaurant_place_stats", sa.Column("review_summary_flag_uri", sa.String(1024)))
    op.create_table(
        "external_api_usage",
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("metric", sa.String(64), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("provider", "metric", "period_start"),
    )


def downgrade() -> None:
    op.drop_table("external_api_usage")
    op.drop_column("restaurant_place_stats", "review_summary_flag_uri")
    op.drop_column("restaurant_place_stats", "place_summary_flag_uri")
    op.drop_column("restaurant_external_ids", "verified_by")
    op.drop_column("restaurant_external_ids", "verification_status")
