"""
Swap primary key to unique_job_posting_id and make sap_id optional (but unique).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260312_0012_hcl_onboarding_pk_change"
down_revision = "20260311_0011_drop_unique_constraint_on_demand_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hcl_onboarding_status_new",
        sa.Column("sap_id", sa.String(length=128), nullable=True),
        sa.Column("unique_job_posting_id", sa.String(length=128), nullable=False),
        sa.Column("demand_id", sa.String(length=128), nullable=False),
        sa.Column("candidate_contact", sa.String(length=64), nullable=False),
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
        sa.ForeignKeyConstraint(["unique_job_posting_id"], ["customer_requirements.unique_job_posting_id"]),
        sa.ForeignKeyConstraint(["demand_id"], ["hcl_demand.demand_id"]),
        sa.ForeignKeyConstraint(["candidate_contact"], ["interviewed_candidate_details.candidate_contact"]),
        sa.PrimaryKeyConstraint("unique_job_posting_id", name="pk_hcl_onboarding_status"),
        sa.UniqueConstraint("sap_id", name="uq_hcl_onboarding_status_sap_id"),
    )

    op.execute(
        """
        INSERT INTO hcl_onboarding_status_new (
            sap_id,
            unique_job_posting_id,
            demand_id,
            candidate_contact,
            candidate_email,
            hcl_onboarding_status,
            hire_loss_reason,
            onboarded_date,
            employee_name,
            employee_hcl_email,
            created_at,
            modified_at,
            created_by,
            modified_by
        )
        SELECT
            sap_id,
            unique_job_posting_id,
            demand_id,
            candidate_contact,
            candidate_email,
            hcl_onboarding_status,
            hire_loss_reason,
            onboarded_date,
            employee_name,
            employee_hcl_email,
            created_at,
            modified_at,
            created_by,
            modified_by
        FROM hcl_onboarding_status
        """
    )

    op.drop_table("hcl_onboarding_status")
    op.rename_table("hcl_onboarding_status_new", "hcl_onboarding_status")

    op.create_index(
        "ix_hcl_onboarding_status_unique_job_posting_id",
        "hcl_onboarding_status",
        ["unique_job_posting_id"],
        unique=True,
    )
    op.create_index(
        "ix_hcl_onboarding_status_demand_id",
        "hcl_onboarding_status",
        ["demand_id"],
        unique=False,
    )
    op.create_index(
        "ix_hcl_onboarding_status_candidate_contact",
        "hcl_onboarding_status",
        ["candidate_contact"],
        unique=False,
    )


def downgrade() -> None:
    op.create_table(
        "hcl_onboarding_status_old",
        sa.Column("sap_id", sa.String(length=128), nullable=False),
        sa.Column("unique_job_posting_id", sa.String(length=128), nullable=False),
        sa.Column("demand_id", sa.String(length=128), nullable=False),
        sa.Column("candidate_contact", sa.String(length=64), nullable=False),
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
        sa.ForeignKeyConstraint(["unique_job_posting_id"], ["customer_requirements.unique_job_posting_id"]),
        sa.ForeignKeyConstraint(["demand_id"], ["hcl_demand.demand_id"]),
        sa.ForeignKeyConstraint(["candidate_contact"], ["interviewed_candidate_details.candidate_contact"]),
        sa.PrimaryKeyConstraint("sap_id", name="pk_hcl_onboarding_status"),
    )

    op.execute(
        """
        INSERT INTO hcl_onboarding_status_old (
            sap_id,
            unique_job_posting_id,
            demand_id,
            candidate_contact,
            candidate_email,
            hcl_onboarding_status,
            hire_loss_reason,
            onboarded_date,
            employee_name,
            employee_hcl_email,
            created_at,
            modified_at,
            created_by,
            modified_by
        )
        SELECT
            COALESCE(sap_id, 'TEMP_' || ROW_NUMBER() OVER (ORDER BY unique_job_posting_id)),
            unique_job_posting_id,
            demand_id,
            candidate_contact,
            candidate_email,
            hcl_onboarding_status,
            hire_loss_reason,
            onboarded_date,
            employee_name,
            employee_hcl_email,
            created_at,
            modified_at,
            created_by,
            modified_by
        FROM hcl_onboarding_status
        """
    )

    op.drop_table("hcl_onboarding_status")
    op.rename_table("hcl_onboarding_status_old", "hcl_onboarding_status")

    op.create_index(
        "ix_hcl_onboarding_status_unique_job_posting_id",
        "hcl_onboarding_status",
        ["unique_job_posting_id"],
        unique=False,
    )
    op.create_index(
        "ix_hcl_onboarding_status_demand_id",
        "hcl_onboarding_status",
        ["demand_id"],
        unique=False,
    )
    op.create_index(
        "ix_hcl_onboarding_status_candidate_contact",
        "hcl_onboarding_status",
        ["candidate_contact"],
        unique=False,
    )
