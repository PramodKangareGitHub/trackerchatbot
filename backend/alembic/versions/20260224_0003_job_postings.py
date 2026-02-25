"""
Alembic migration for job_postings table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_0003_job_postings"
down_revision = "20260224_0002_wizard_sessions"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table('job_postings'):
        op.create_table(
            'job_postings',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('job_posting_id', sa.String(), nullable=False),
            sa.Column('unique_job_posting_id', sa.String(), nullable=False, unique=True, index=True),
            sa.Column('portfolio', sa.String()),
            sa.Column('sub_portfolio', sa.String()),
            sa.Column('tower', sa.String()),
            sa.Column('business_unit', sa.String()),
            sa.Column('location', sa.String()),
            sa.Column('sub_location', sa.String()),
            sa.Column('number_of_positions', sa.Integer()),
            sa.Column('requirement_type', sa.String()),
            sa.Column('customer_job_posting_date', sa.DateTime()),
            sa.Column('job_role', sa.String()),
            sa.Column('skill_category', sa.String()),
            sa.Column('primary_skills', sa.String()),
            sa.Column('secondary_skills', sa.String()),
            sa.Column('customer_cio', sa.String()),
            sa.Column('customer_leader', sa.String()),
            sa.Column('customer_vice_president', sa.String()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('job_postings'):
        op.drop_table('job_postings')
