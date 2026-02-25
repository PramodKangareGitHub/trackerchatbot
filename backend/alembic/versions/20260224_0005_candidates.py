"""
Alembic migration for candidates, candidate_applications, interview_stages, candidate_interviews tables
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_0005_candidates"
down_revision = "20260224_0004_demands"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('candidates'):
        op.create_table(
            'candidates',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('name', sa.String()),
            sa.Column('contact_number', sa.String()),
            sa.Column('email_id', sa.String()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not inspector.has_table('candidate_applications'):
        op.create_table(
            'candidate_applications',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('candidate_id', sa.String(), nullable=False),
            sa.Column('job_posting_id', sa.String(), nullable=False),
            sa.Column('demand_id', sa.String(), nullable=True),
            sa.Column('candidate_source_type', sa.String()),
            sa.Column('tp_vendor_name', sa.String()),
            sa.Column('overall_interview_status', sa.String()),
            sa.Column('initial_screening_status', sa.String()),
            sa.Column('initial_screening_rejection_reason', sa.String()),
            sa.Column('tp1_interview_status', sa.String()),
            sa.Column('tp1_rejection_reason', sa.String()),
            sa.Column('tp2_interview_status', sa.String()),
            sa.Column('tp2_skip_rejection_reason', sa.String()),
            sa.Column('manager_interview_status', sa.String()),
            sa.Column('manager_skip_rejection_reason', sa.String()),
            sa.Column('customer_interview_status', sa.String()),
            sa.Column('customer_interview_skipped_rejected', sa.String()),
            sa.Column('candidate_selected_date', sa.DateTime()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not inspector.has_table('interview_stages'):
        op.create_table(
            'interview_stages',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(), nullable=False, unique=True),
        )

    if not inspector.has_table('candidate_interviews'):
        op.create_table(
            'candidate_interviews',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('candidate_application_id', sa.String(), nullable=False),
            sa.Column('stage_id', sa.Integer(), nullable=False),
            sa.Column('status', sa.String()),
            sa.Column('rejection_reason', sa.String()),
            sa.Column('skipped', sa.String()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('candidate_interviews'):
        op.drop_table('candidate_interviews')
    if inspector.has_table('interview_stages'):
        op.drop_table('interview_stages')
    if inspector.has_table('candidate_applications'):
        op.drop_table('candidate_applications')
    if inspector.has_table('candidates'):
        op.drop_table('candidates')
