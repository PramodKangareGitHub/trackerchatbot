"""
Drop deprecated wizard_sessions table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260228_0007_drop_wizard_sessions"
down_revision = "20260224_0006_onboarding"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("wizard_sessions"):
        op.drop_table("wizard_sessions")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("wizard_sessions"):
        op.create_table(
            "wizard_sessions",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="Draft"),
            sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.sql.expression.false()),
            sa.Column("job_posting_unique_id", sa.String(), nullable=True),
            sa.Column("demand_id", sa.String(), nullable=True),
            sa.Column("candidate_application_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
