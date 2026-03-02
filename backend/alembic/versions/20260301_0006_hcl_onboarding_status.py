"""
Add hcl_onboarding_status table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0006_hcl_onboarding_status"
down_revision = "20260301_0005_candidate_contact_pk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hcl_onboarding_status",
        sa.Column("sap_id", sa.String(length=128), primary_key=True),
        sa.Column(
            "unique_job_posting_id",
            sa.String(length=128),
            sa.ForeignKey("customer_requirements.unique_job_posting_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "demand_id",
            sa.String(length=128),
            sa.ForeignKey("hcl_demand.demand_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "candidate_contact",
            sa.String(length=64),
            sa.ForeignKey("interviewed_candidate_details.candidate_contact"),
            nullable=False,
            index=True,
        ),
        sa.Column("candidate_email", sa.String(length=255)),
        sa.Column("hcl_onboarding_status", sa.String(length=128)),
        sa.Column("hire_loss_reason", sa.String()),
        sa.Column("onboarded_date", sa.DateTime()),
        sa.Column("employee_name", sa.String(length=255)),
        sa.Column("employee_hcl_email", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(length=128)),
        sa.Column("modified_by", sa.String(length=128)),
    )


def downgrade() -> None:
    op.drop_table("hcl_onboarding_status")
