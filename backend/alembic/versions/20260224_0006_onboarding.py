"""
Alembic migration for employees, hcl_onboardings, customer_onboardings tables
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_0006_onboarding"
down_revision = "20260224_0005_candidates"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('employees'):
        op.create_table(
            'employees',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('sap_employee_id', sa.String()),
            sa.Column('employee_name', sa.String()),
            sa.Column('employee_contact_number', sa.String()),
            sa.Column('employee_hcl_email_id', sa.String()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not inspector.has_table('hcl_onboardings'):
        op.create_table(
            'hcl_onboardings',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('job_posting_id', sa.String(), nullable=False),
            sa.Column('unique_job_posting_id', sa.String(), nullable=False),
            sa.Column('demand_id', sa.String(), nullable=True),
            sa.Column('tag_spoc', sa.String()),
            sa.Column('hcl_fulfillment_spoc', sa.String()),
            sa.Column('customer_leader', sa.String()),
            sa.Column('customer_hiring_manager', sa.String()),
            sa.Column('candidate_name', sa.String()),
            sa.Column('candidate_contact_number', sa.String()),
            sa.Column('candidate_email_id', sa.String()),
            sa.Column('hcl_onboarding_status', sa.String()),
            sa.Column('hire_loss_reason', sa.String()),
            sa.Column('onboarded_date', sa.DateTime()),
            sa.Column('employee_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not inspector.has_table('customer_onboardings'):
        op.create_table(
            'customer_onboardings',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('job_posting_id', sa.String(), nullable=False),
            sa.Column('unique_job_posting_id', sa.String(), nullable=False),
            sa.Column('hcl_fulfillment_spoc', sa.String()),
            sa.Column('customer_leader', sa.String()),
            sa.Column('customer_hiring_manager', sa.String()),
            sa.Column('customer_onboarding_status', sa.String()),
            sa.Column('customer_onboarded_date', sa.DateTime()),
            sa.Column('customer_employee_id', sa.String()),
            sa.Column('customer_employee_name', sa.String()),
            sa.Column('customer_email_id', sa.String()),
            sa.Column('customer_login_id', sa.String()),
            sa.Column('customer_line_of_business', sa.String()),
            sa.Column('billing_start_date', sa.DateTime()),
            sa.Column('customer_laptop_required', sa.String()),
            sa.Column('customer_laptop_status', sa.String()),
            sa.Column('customer_laptop_serial_number', sa.String()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('customer_onboardings'):
        op.drop_table('customer_onboardings')
    if inspector.has_table('hcl_onboardings'):
        op.drop_table('hcl_onboardings')
    if inspector.has_table('employees'):
        op.drop_table('employees')
