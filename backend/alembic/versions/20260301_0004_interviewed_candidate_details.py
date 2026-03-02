"""
Add interviewed_candidate_details table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0004_interviewed_candidate_details"
down_revision = "20260301_0003_hcl_demand"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interviewed_candidate_details",
        sa.Column("candidate_name", sa.String(length=255), primary_key=True),
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
        sa.Column("candidate_type", sa.String(length=128)),
        sa.Column("tp_vendor_name", sa.String(length=255)),
        sa.Column("candidate_contact", sa.String(length=64)),
        sa.Column("candidate_email", sa.String(length=255)),
        sa.Column("interview_status", sa.String(length=128)),
        sa.Column("initial_screening_status", sa.String(length=128)),
        sa.Column("initial_screening_rejected_reason", sa.String()),
        sa.Column("tp1_interview_status", sa.String(length=128)),
        sa.Column("tp1_rejected_reason", sa.String()),
        sa.Column("tp2_interview_status", sa.String(length=128)),
        sa.Column("tp2_skipped_rejected_reason", sa.String()),
        sa.Column("manager_interview_status", sa.String(length=128)),
        sa.Column("manager_skipped_rejected_reason", sa.String()),
        sa.Column("customer_interview_status", sa.String(length=128)),
        sa.Column("customer_interview_skipped_rejected_reason", sa.String()),
        sa.Column("candidate_selected_date", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(length=128)),
        sa.Column("modified_by", sa.String(length=128)),
    )


def downgrade() -> None:
    op.drop_table("interviewed_candidate_details")
