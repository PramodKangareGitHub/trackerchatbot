"""allow duplicate demand_id across postings

Revision ID: 20260309_0010_allow_duplicate_demand_id
Revises: 20260306_0009_optum_onboarding_pk_change
Create Date: 2026-03-09 00:03:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260309_0010_allow_duplicate_demand_id"
down_revision = "20260306_0009_optum_onboarding_pk_change"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the unique index on demand_id if it exists, then recreate as non-unique.
    try:
        op.drop_index("ix_hcl_demand_demand_id", table_name="hcl_demand")
    except Exception:
        # Index name might differ if created manually; ignore if already gone.
        pass
    op.create_index(
        "ix_hcl_demand_demand_id", "hcl_demand", ["demand_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_hcl_demand_demand_id", table_name="hcl_demand")
    op.create_index(
        "ix_hcl_demand_demand_id", "hcl_demand", ["demand_id"], unique=True
    )
