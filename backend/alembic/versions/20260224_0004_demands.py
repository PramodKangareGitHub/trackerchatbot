"""
Alembic migration for demands table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_0004_demands"
down_revision = "20260224_0003_job_postings"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table('demands'):
        op.create_table(
            'demands',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('job_posting_id', sa.String(), nullable=False),
            sa.Column('unique_job_posting_id', sa.String(), nullable=False),
            sa.Column('tag_spoc', sa.String()),
            sa.Column('tsc_spoc', sa.String()),
            sa.Column('demand_id', sa.String()),
            sa.Column('demand_created_date', sa.DateTime()),
            sa.Column('demand_status', sa.String()),
            sa.Column('demand_approved_date', sa.DateTime()),
            sa.Column('number_of_positions', sa.Integer()),
            sa.Column('tag_first_profile_sourced_date', sa.DateTime()),
            sa.Column('tsc_first_profile_sourced_date', sa.DateTime()),
            sa.Column('tp_profiles_requested', sa.Integer()),
            sa.Column('tp_vendor_name', sa.String()),
            sa.Column('tp_profiles_requested_date', sa.DateTime()),
            sa.Column('tp_first_profile_sourced_date', sa.DateTime()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('demands'):
        op.drop_table('demands')
