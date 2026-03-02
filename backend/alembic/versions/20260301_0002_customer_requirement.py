"""
Add customer_requirements table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0002_customer_requirement"
down_revision = "20260301_0001_base"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_requirements",
        sa.Column("unique_job_posting_id", sa.String(length=128), primary_key=True),
        sa.Column("portfolio", sa.String()),
        sa.Column("sub_portfolio", sa.String()),
        sa.Column("tower", sa.String()),
        sa.Column("customer_cio", sa.String()),
        sa.Column("customer_leader", sa.String()),
        sa.Column("customer_vice_president", sa.String()),
        sa.Column("customer_senior_director", sa.String()),
        sa.Column("customer_director", sa.String()),
        sa.Column("customer_hiring_manager", sa.String()),
        sa.Column("customer_band", sa.String()),
        sa.Column("hcl_leader", sa.String()),
        sa.Column("hcl_deliver_spoc", sa.String()),
        sa.Column("job_posting_id", sa.String(), index=True),
        sa.Column("location", sa.String()),
        sa.Column("sub_location", sa.String()),
        sa.Column("requirement_type", sa.String()),
        sa.Column("business_unit", sa.String()),
        sa.Column("customer_job_posting_date", sa.DateTime()),
        sa.Column("number_of_positions", sa.Integer()),
        sa.Column("sell_rate", sa.Float()),
        sa.Column("job_posting_status", sa.String()),
        sa.Column("job_role", sa.String()),
        sa.Column("skill_category", sa.String()),
        sa.Column("primary_skills", sa.String()),
        sa.Column("secondary_skills", sa.String()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String()),
        sa.Column("modified_by", sa.String()),
    )


def downgrade() -> None:
    op.drop_table("customer_requirements")
