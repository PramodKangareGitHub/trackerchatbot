"""
Add first profile submitted fields to customer_requirements
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260313_0013_customer_requirement_first_profile"
down_revision = "20260312_0012_hcl_onboarding_pk_change"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_requirements",
        sa.Column("first_profile_submitted", sa.Boolean(), server_default=sa.false()),
    )
    op.add_column(
        "customer_requirements",
        sa.Column("first_profile_submitted_date", sa.DateTime()),
    )
    # Drop the server_default now that existing rows are initialized
    op.alter_column(
        "customer_requirements",
        "first_profile_submitted",
        server_default=None,
        existing_type=sa.Boolean(),
    )


def downgrade() -> None:
    op.drop_column("customer_requirements", "first_profile_submitted_date")
    op.drop_column("customer_requirements", "first_profile_submitted")
