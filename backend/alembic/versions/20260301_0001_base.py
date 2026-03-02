"""
Baseline schema after cleanup
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260301_0001_base"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # roles
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=50), nullable=False, unique=True, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_roles_name"),
    )

    # datasets
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(length=36), primary_key=True, index=True),
        sa.Column("original_file_name", sa.String(), nullable=False),
        sa.Column("table_name", sa.String(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("columns_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # dashboards
    op.create_table(
        "dashboards",
        sa.Column("id", sa.String(length=36), primary_key=True, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # dashboard widgets
    op.create_table(
        "dashboard_widgets",
        sa.Column("id", sa.String(length=36), primary_key=True, index=True),
        sa.Column("dashboard_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("widget_type", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # dataset column preferences
    op.create_table(
        "dataset_column_preferences",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("dataset_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("user_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("columns_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("dataset_id", "user_id", name="uq_dataset_user_pref"),
    )

    # pinned questions
    op.create_table(
        "pinned_questions",
        sa.Column("id", sa.String(length=36), primary_key=True, index=True),
        sa.Column("dataset_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("user_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("question", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("dataset_id", "user_id", "question", name="uq_pins_dataset_user_question"),
    )


def downgrade() -> None:
    op.drop_table("pinned_questions")
    op.drop_table("dataset_column_preferences")
    op.drop_table("dashboard_widgets")
    op.drop_table("dashboards")
    op.drop_table("datasets")
    op.drop_table("roles")
    op.drop_table("users")
