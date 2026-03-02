"""
Add optum_onboarding_status table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0007_optum_onboarding_status"
down_revision = "20260301_0006_hcl_onboarding_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "optum_onboarding_status",
        sa.Column("customer_employee_id", sa.String(length=128), primary_key=True),
        sa.Column(
            "unique_job_posting_id",
            sa.String(length=128),
            sa.ForeignKey("customer_requirements.unique_job_posting_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "sap_id",
            sa.String(length=128),
            sa.ForeignKey("hcl_onboarding_status.sap_id"),
            nullable=False,
            index=True,
        ),
        sa.Column("customer_onboarding_status", sa.String(length=128)),
        sa.Column("customer_onboarded_date", sa.DateTime()),
        sa.Column("customer_employee_name", sa.String(length=255)),
        sa.Column("customer_email", sa.String(length=255)),
        sa.Column("customer_login_id", sa.String(length=255)),
        sa.Column("customer_lob", sa.String(length=255)),
        sa.Column("billing_start_date", sa.DateTime()),
        sa.Column("customer_laptop_required", sa.String(length=64)),
        sa.Column("customer_laptop_status", sa.String(length=128)),
        sa.Column("customer_laptop_serial_no", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(length=128)),
        sa.Column("modified_by", sa.String(length=128)),
    )


def downgrade() -> None:
    op.drop_table("optum_onboarding_status")
