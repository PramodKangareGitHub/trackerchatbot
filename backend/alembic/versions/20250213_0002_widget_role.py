"""Add role column to dashboard widgets

Revision ID: 20250213_0002
Revises: 20250112_0001
Create Date: 2026-02-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250213_0002"
down_revision = "20250112_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dashboard_widgets", sa.Column("role", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("dashboard_widgets", "role")
