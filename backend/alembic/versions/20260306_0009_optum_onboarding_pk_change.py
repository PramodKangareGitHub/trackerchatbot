"""
Change optum_onboarding_status primary key to sap_id and allow null customer_employee_id
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260306_0009_optum_onboarding_pk_change"
down_revision = "20260301_0008_hcl_demand_primary_key_swap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite cannot drop primary keys easily; recreate the table.
    # Capture existing data if present.
    conn = op.get_bind()

    # Clean up any leftovers from a failed prior run
    op.execute("DROP TABLE IF EXISTS optum_onboarding_status_old")

    # Rename existing table
    op.rename_table("optum_onboarding_status", "optum_onboarding_status_old")
    # Drop old indexes that may collide
    op.execute("DROP INDEX IF EXISTS ix_optum_onboarding_status_unique_job_posting_id")
    op.execute("DROP INDEX IF EXISTS ix_optum_onboarding_status_sap_id")

    # Create new table with desired schema
    op.create_table(
        "optum_onboarding_status",
        sa.Column("sap_id", sa.String(length=128), primary_key=True),
        sa.Column(
            "unique_job_posting_id",
            sa.String(length=128),
            sa.ForeignKey("customer_requirements.unique_job_posting_id"),
            nullable=False,
            index=True,
        ),
        sa.Column("customer_employee_id", sa.String(length=128), nullable=True),
        sa.Column(
            "customer_onboarding_status",
            sa.String(length=128),
        ),
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

    # Migrate existing data
    old_rows = conn.execute(sa.text("SELECT * FROM optum_onboarding_status_old")).fetchall()
    if old_rows:
        for row in old_rows:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO optum_onboarding_status (
                        sap_id,
                        unique_job_posting_id,
                        customer_employee_id,
                        customer_onboarding_status,
                        customer_onboarded_date,
                        customer_employee_name,
                        customer_email,
                        customer_login_id,
                        customer_lob,
                        billing_start_date,
                        customer_laptop_required,
                        customer_laptop_status,
                        customer_laptop_serial_no,
                        created_at,
                        modified_at,
                        created_by,
                        modified_by
                    ) VALUES (
                        :sap_id,
                        :unique_job_posting_id,
                        :customer_employee_id,
                        :customer_onboarding_status,
                        :customer_onboarded_date,
                        :customer_employee_name,
                        :customer_email,
                        :customer_login_id,
                        :customer_lob,
                        :billing_start_date,
                        :customer_laptop_required,
                        :customer_laptop_status,
                        :customer_laptop_serial_no,
                        :created_at,
                        :modified_at,
                        :created_by,
                        :modified_by
                    )
                    """
                ),
                {
                    "sap_id": row[2],
                    "unique_job_posting_id": row[1],
                    "customer_employee_id": row[0],
                    "customer_onboarding_status": row[3],
                    "customer_onboarded_date": row[4],
                    "customer_employee_name": row[5],
                    "customer_email": row[6],
                    "customer_login_id": row[7],
                    "customer_lob": row[8],
                    "billing_start_date": row[9],
                    "customer_laptop_required": row[10],
                    "customer_laptop_status": row[11],
                    "customer_laptop_serial_no": row[12],
                    "created_at": row[13],
                    "modified_at": row[14],
                    "created_by": row[15],
                    "modified_by": row[16],
                },
            )

    op.drop_table("optum_onboarding_status_old")


def downgrade() -> None:
    conn = op.get_bind()

    op.rename_table("optum_onboarding_status", "optum_onboarding_status_new")

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

    old_rows = conn.execute(sa.text("SELECT * FROM optum_onboarding_status_new")).fetchall()
    if old_rows:
        for row in old_rows:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO optum_onboarding_status (
                        customer_employee_id,
                        unique_job_posting_id,
                        sap_id,
                        customer_onboarding_status,
                        customer_onboarded_date,
                        customer_employee_name,
                        customer_email,
                        customer_login_id,
                        customer_lob,
                        billing_start_date,
                        customer_laptop_required,
                        customer_laptop_status,
                        customer_laptop_serial_no,
                        created_at,
                        modified_at,
                        created_by,
                        modified_by
                    ) VALUES (
                        :customer_employee_id,
                        :unique_job_posting_id,
                        :sap_id,
                        :customer_onboarding_status,
                        :customer_onboarded_date,
                        :customer_employee_name,
                        :customer_email,
                        :customer_login_id,
                        :customer_lob,
                        :billing_start_date,
                        :customer_laptop_required,
                        :customer_laptop_status,
                        :customer_laptop_serial_no,
                        :created_at,
                        :modified_at,
                        :created_by,
                        :modified_by
                    )
                    """
                ),
                {
                    "customer_employee_id": row[2],
                    "unique_job_posting_id": row[1],
                    "sap_id": row[0],
                    "customer_onboarding_status": row[3],
                    "customer_onboarded_date": row[4],
                    "customer_employee_name": row[5],
                    "customer_email": row[6],
                    "customer_login_id": row[7],
                    "customer_lob": row[8],
                    "billing_start_date": row[9],
                    "customer_laptop_required": row[10],
                    "customer_laptop_status": row[11],
                    "customer_laptop_serial_no": row[12],
                    "created_at": row[13],
                    "modified_at": row[14],
                    "created_by": row[15],
                    "modified_by": row[16],
                },
            )

    op.drop_table("optum_onboarding_status_new")
