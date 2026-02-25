"""
Alembic migration for job_posting_sequences table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_0001_job_posting_sequences"
down_revision = "20250218_0003_dashboard_order"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table('job_posting_sequences'):
        op.create_table(
            'job_posting_sequences',
            sa.Column('job_posting_id', sa.String(), primary_key=True),
            sa.Column('last_number', sa.Integer(), nullable=False, server_default='0'),
        )

def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('job_posting_sequences'):
        op.drop_table('job_posting_sequences')
