"""
Placeholder migration to preserve existing alembic chain for dashboard_order.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250218_0003_dashboard_order"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # No-op placeholder to align history.
    pass


def downgrade():
    # No-op placeholder downgrade.
    pass
