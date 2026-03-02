"""
Switch primary key to candidate_contact on interviewed_candidate_details
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0005_candidate_contact_pk"
down_revision = "20260301_0004_interviewed_candidate_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Recreate table with candidate_contact as PK
    op.create_table(
        "interviewed_candidate_details_tmp",
        sa.Column("candidate_contact", sa.String(length=64), primary_key=True),
        sa.Column("candidate_name", sa.String(length=255)),
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

    op.execute(
        """
        INSERT INTO interviewed_candidate_details_tmp (
            candidate_contact,
            candidate_name,
            unique_job_posting_id,
            demand_id,
            candidate_type,
            tp_vendor_name,
            candidate_email,
            interview_status,
            initial_screening_status,
            initial_screening_rejected_reason,
            tp1_interview_status,
            tp1_rejected_reason,
            tp2_interview_status,
            tp2_skipped_rejected_reason,
            manager_interview_status,
            manager_skipped_rejected_reason,
            customer_interview_status,
            customer_interview_skipped_rejected_reason,
            candidate_selected_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        )
        SELECT
            candidate_contact,
            candidate_name,
            unique_job_posting_id,
            demand_id,
            candidate_type,
            tp_vendor_name,
            candidate_email,
            interview_status,
            initial_screening_status,
            initial_screening_rejected_reason,
            tp1_interview_status,
            tp1_rejected_reason,
            tp2_interview_status,
            tp2_skipped_rejected_reason,
            manager_interview_status,
            manager_skipped_rejected_reason,
            customer_interview_status,
            customer_interview_skipped_rejected_reason,
            candidate_selected_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        FROM interviewed_candidate_details
        """
    )

    op.drop_table("interviewed_candidate_details")
    op.rename_table("interviewed_candidate_details_tmp", "interviewed_candidate_details")


def downgrade() -> None:
    # Recreate original table with candidate_name as PK
    op.create_table(
        "interviewed_candidate_details_tmp",
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

    op.execute(
        """
        INSERT INTO interviewed_candidate_details_tmp (
            candidate_name,
            unique_job_posting_id,
            demand_id,
            candidate_type,
            tp_vendor_name,
            candidate_contact,
            candidate_email,
            interview_status,
            initial_screening_status,
            initial_screening_rejected_reason,
            tp1_interview_status,
            tp1_rejected_reason,
            tp2_interview_status,
            tp2_skipped_rejected_reason,
            manager_interview_status,
            manager_skipped_rejected_reason,
            customer_interview_status,
            customer_interview_skipped_rejected_reason,
            candidate_selected_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        )
        SELECT
            candidate_name,
            unique_job_posting_id,
            demand_id,
            candidate_type,
            tp_vendor_name,
            candidate_contact,
            candidate_email,
            interview_status,
            initial_screening_status,
            initial_screening_rejected_reason,
            tp1_interview_status,
            tp1_rejected_reason,
            tp2_interview_status,
            tp2_skipped_rejected_reason,
            manager_interview_status,
            manager_skipped_rejected_reason,
            customer_interview_status,
            customer_interview_skipped_rejected_reason,
            candidate_selected_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        FROM interviewed_candidate_details
        """
    )

    op.drop_table("interviewed_candidate_details")
    op.rename_table("interviewed_candidate_details_tmp", "interviewed_candidate_details")
