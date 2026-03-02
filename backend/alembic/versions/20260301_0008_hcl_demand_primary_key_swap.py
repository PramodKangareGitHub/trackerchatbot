"""
Make unique_job_posting_id the primary key for hcl_demand and keep demand_id unique
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0008_hcl_demand_primary_key_swap"
down_revision = "20260301_0007_optum_onboarding_status"
branch_labels = None
depends_on = None


TABLE_NAME = "hcl_demand"
TEMP_TABLE = f"{TABLE_NAME}_old_pk"


def upgrade() -> None:
    # Rename existing table
    op.rename_table(TABLE_NAME, TEMP_TABLE)

    # Recreate table with new PK/unique constraints
    op.create_table(
        TABLE_NAME,
        sa.Column("demand_id", sa.String(length=128), nullable=True),
        sa.Column("unique_job_posting_id", sa.String(length=128), nullable=False),
        sa.Column("tag_spoc", sa.String(length=255)),
        sa.Column("tsc_spoc", sa.String(length=255)),
        sa.Column("demand_created_date", sa.DateTime()),
        sa.Column("demand_status", sa.String(length=128)),
        sa.Column("demand_approved_date", sa.DateTime()),
        sa.Column("tag_first_profile_sourced_date", sa.DateTime()),
        sa.Column("tsc_first_profile_sourced_date", sa.DateTime()),
        sa.Column("tp_profiles_requested", sa.Integer()),
        sa.Column("tp_vendor_name", sa.String(length=255)),
        sa.Column("tp_profiles_requested_date", sa.DateTime()),
        sa.Column("tp_first_profile_sourced_date", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(length=128)),
        sa.Column("modified_by", sa.String(length=128)),
        sa.PrimaryKeyConstraint("unique_job_posting_id", name="pk_hcl_demand"),
        sa.UniqueConstraint("demand_id", name="uq_hcl_demand_demand_id"),
        sa.ForeignKeyConstraint(
            ["unique_job_posting_id"],
            ["customer_requirements.unique_job_posting_id"],
        ),
    )

    # Copy data into the new table
    op.execute(
        """
        INSERT INTO hcl_demand (
            demand_id,
            unique_job_posting_id,
            tag_spoc,
            tsc_spoc,
            demand_created_date,
            demand_status,
            demand_approved_date,
            tag_first_profile_sourced_date,
            tsc_first_profile_sourced_date,
            tp_profiles_requested,
            tp_vendor_name,
            tp_profiles_requested_date,
            tp_first_profile_sourced_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        )
        SELECT
            demand_id,
            unique_job_posting_id,
            tag_spoc,
            tsc_spoc,
            demand_created_date,
            demand_status,
            demand_approved_date,
            tag_first_profile_sourced_date,
            tsc_first_profile_sourced_date,
            tp_profiles_requested,
            tp_vendor_name,
            tp_profiles_requested_date,
            tp_first_profile_sourced_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        FROM hcl_demand_old_pk;
        """
    )

    # Drop the old table
    op.drop_table(TEMP_TABLE)


def downgrade() -> None:
    # Revert to old schema: demand_id as PK, unique_job_posting_id non-PK
    op.rename_table(TABLE_NAME, TEMP_TABLE)

    op.create_table(
        TABLE_NAME,
        sa.Column("demand_id", sa.String(length=128), nullable=False),
        sa.Column("unique_job_posting_id", sa.String(length=128), nullable=False),
        sa.Column("tag_spoc", sa.String(length=255)),
        sa.Column("tsc_spoc", sa.String(length=255)),
        sa.Column("demand_created_date", sa.DateTime()),
        sa.Column("demand_status", sa.String(length=128)),
        sa.Column("demand_approved_date", sa.DateTime()),
        sa.Column("tag_first_profile_sourced_date", sa.DateTime()),
        sa.Column("tsc_first_profile_sourced_date", sa.DateTime()),
        sa.Column("tp_profiles_requested", sa.Integer()),
        sa.Column("tp_vendor_name", sa.String(length=255)),
        sa.Column("tp_profiles_requested_date", sa.DateTime()),
        sa.Column("tp_first_profile_sourced_date", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(length=128)),
        sa.Column("modified_by", sa.String(length=128)),
        sa.PrimaryKeyConstraint("demand_id", name="pk_hcl_demand"),
        sa.ForeignKeyConstraint(
            ["unique_job_posting_id"],
            ["customer_requirements.unique_job_posting_id"],
        ),
    )

    op.execute(
        """
        INSERT INTO hcl_demand (
            demand_id,
            unique_job_posting_id,
            tag_spoc,
            tsc_spoc,
            demand_created_date,
            demand_status,
            demand_approved_date,
            tag_first_profile_sourced_date,
            tsc_first_profile_sourced_date,
            tp_profiles_requested,
            tp_vendor_name,
            tp_profiles_requested_date,
            tp_first_profile_sourced_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        )
        SELECT
            demand_id,
            unique_job_posting_id,
            tag_spoc,
            tsc_spoc,
            demand_created_date,
            demand_status,
            demand_approved_date,
            tag_first_profile_sourced_date,
            tsc_first_profile_sourced_date,
            tp_profiles_requested,
            tp_vendor_name,
            tp_profiles_requested_date,
            tp_first_profile_sourced_date,
            created_at,
            modified_at,
            created_by,
            modified_by
        FROM hcl_demand_old_pk;
        """
    )

    op.drop_table(TEMP_TABLE)
