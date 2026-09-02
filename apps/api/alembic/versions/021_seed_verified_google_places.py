"""Seed the manually reviewed Google Places IDs.

Revision ID: 021_seed_verified_google_places
Revises: 020_google_photo_fallback
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "021_seed_verified_google_places"
down_revision: str | None = "020_google_photo_fallback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Approved in place_candidates.csv after manual review on 2026-09-01.  Only the
# stable Place ID is persisted; Google photo references and image URLs remain
# ephemeral as required by the Places API terms.
APPROVED_PLACE_IDS = (
    ("NE_0001", "ChIJKRXowbtz44kRORvv6Mx_MDw"),
    ("NE_0002", "ChIJCe7kLY9w44kR55gvVv3g8zs"),
    ("NE_0003", "ChIJb4wUsI5w44kRnERe7ywQaJA"),
    ("NE_0004", "ChIJT6uL2Yhw44kRQC4VpTehlhs"),
    ("NE_0005", "ChIJEbGG2ohw44kRhzf2NJIl-tc"),
    ("NE_0006", "ChIJVbrdD4lw44kRdZLKJo0e02o"),
    ("NE_0007", "ChIJcRpJ3cVx44kRw6Kz5WQgucc"),
    ("NE_0008", "ChIJAXXx0Yhw44kRgOgYa9xlDyw"),
    ("NE_0009", "ChIJCTK0bYlw44kRZYlFMM9e3jg"),
    ("NE_0010", "ChIJRQc854hw44kRFkYEHlm02PE"),
    ("NE_0011", "ChIJv7k_M4lw44kRuVhaTg8i9UQ"),
    ("NE_0013", "ChIJdZQcKIxw44kRYfAqgZLzx1c"),
    ("NE_0014", "ChIJGVLrEIlw44kRQ7FhbmC7U0Y"),
    ("NE_0015", "ChIJscjVEolw44kRPaXB6YwsWWM"),
    ("NE_0016", "ChIJF8K6Kolw44kR6nzo7j0RIFc"),
    ("NE_0017", "ChIJOW4E0iBx44kRGPwnBeo0a5U"),
    ("NE_0018", "ChIJh5s-F4lw44kRVNNe4L7moqU"),
    ("NE_0019", "ChIJg8XoS4lw44kROxekMoVdI2M"),
    ("NE_0020", "ChIJK1BB8zFx44kRkHcLfb-rPl8"),
    ("NE_0021", "ChIJl81gJolw44kRtjTHVqZYVZQ"),
    ("NE_0022", "ChIJq7mL4Yhw44kRJEtyP4HzWsM"),
    ("NE_0023", "ChIJu6XLsYtw44kRhV1wXhHwgo8"),
    ("NE_0024", "ChIJC70W2Nhx44kRgBUmQLBi6a0"),
    ("NE_0025", "ChIJMx_bcYlw44kRpCQWPuurowA"),
    ("NE_0026", "ChIJs0kxSjWo4okR6109vVboQ64"),
    ("NE_0027", "ChIJSQ-HS4lw44kRA0iC6zNgsbU"),
    ("NE_0028", "ChIJZw_RIolw44kRkWTqTEB5d_4"),
    ("NE_0029", "ChIJmQw72ohw44kRQnu2OPjRG_A"),
    ("NE_0030", "ChIJb2UK34hw44kRZ7E1siPgMqU"),
    ("NE_0031", "ChIJbyGIIYlw44kRgPsk38Af8pU"),
    ("NE_0032", "ChIJgSIAgIlw44kR5x0O4QVgepo"),
    ("NE_0033", "ChIJu_m-cIlw44kRjniMYiCrUWM"),
    ("NE_0034", "ChIJGwg4zohw44kR2JOE0zpR_Wo"),
    ("NE_0035", "ChIJHQsP2ohw44kRU4Yc15zYmTM"),
    ("NE_0036", "ChIJ5XsCIIpw44kRpFvybDduFTg"),
    ("NE_0037", "ChIJ6buuSBFx44kRBQu9m3Aaw5I"),
    ("NE_0038", "ChIJyehqNe9x44kRU12jOb5EiEE"),
    ("NE_0039", "ChIJp7fvcwBx44kRRQxNtz-52B0"),
    ("NE_0040", "ChIJ-yAK0Yhw44kRjcGbWEoOTbE"),
    ("NE_0041", "ChIJDfKYHxhx44kRn5tN5e2OhVU"),
    ("NE_0042", "ChIJwaPFs4lw44kRO9DMMbKI0xs"),
    ("NE_0043", "ChIJuRRQ_Ytw44kRpn5Wtsehg_0"),
    ("NE_0044", "ChIJTwh8xYhw44kRMcq03uNuWLk"),
    ("NE_0045", "ChIJrXdV2Ihw44kRbTBB66LkiNg"),
)


def upgrade() -> None:
    connection = op.get_bind()
    delete_stale = sa.text(
        """
        DELETE FROM restaurant_external_ids
        WHERE provider = 'google_places'
          AND restaurant_id = :restaurant_id
          AND external_id <> :place_id
        """
    )
    upsert_verified = sa.text(
        """
        INSERT INTO restaurant_external_ids (
            restaurant_id,
            provider,
            external_id,
            verification_status,
            verified_by,
            verified_at
        ) SELECT
            restaurants.restaurant_id,
            'google_places',
            :place_id,
            'verified',
            'Brendan',
            CURRENT_TIMESTAMP
        FROM restaurants
        WHERE restaurant_id = :restaurant_id
        ON CONFLICT (provider, external_id) DO UPDATE SET
            restaurant_id = EXCLUDED.restaurant_id,
            verification_status = EXCLUDED.verification_status,
            verified_by = EXCLUDED.verified_by,
            verified_at = EXCLUDED.verified_at
        """
    )

    for restaurant_id, place_id in APPROVED_PLACE_IDS:
        parameters = {"restaurant_id": restaurant_id, "place_id": place_id}
        connection.execute(delete_stale, parameters)
        connection.execute(upsert_verified, parameters)


def downgrade() -> None:
    connection = op.get_bind()
    revoke_verification = sa.text(
        """
        UPDATE restaurant_external_ids
        SET verification_status = 'unverified',
            verified_by = NULL,
            verified_at = NULL
        WHERE provider = 'google_places'
          AND restaurant_id = :restaurant_id
          AND external_id = :place_id
          AND verified_by = 'Brendan'
        """
    )
    for restaurant_id, place_id in APPROVED_PLACE_IDS:
        connection.execute(
            revoke_verification,
            {"restaurant_id": restaurant_id, "place_id": place_id},
        )
