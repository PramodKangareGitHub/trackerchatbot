"""Add user scoping to pins and column preferences table

Revision ID: 20250112_0001
Revises: None
Create Date: 2026-01-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20250112_0001"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(bind, name: str) -> bool:
    insp = inspect(bind)
    return name in insp.get_table_names()


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)

    # Ensure dataset_column_preferences exists
    if not _has_table(bind, "dataset_column_preferences"):
        op.create_table(
            "dataset_column_preferences",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("dataset_id", sa.String(length=36), nullable=False, index=True),
            sa.Column("user_id", sa.String(length=36), nullable=False, index=True),
            sa.Column("columns_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.UniqueConstraint("dataset_id", "user_id", name="uq_dataset_user_pref"),
        )

    # Upgrade pinned_questions to be user-scoped
    if _has_table(bind, "pinned_questions"):
        cols = {c["name"] for c in insp.get_columns("pinned_questions")}
        if "user_id" not in cols:
            # SQLite needs batch_alter_table to alter nullability
            with op.batch_alter_table("pinned_questions") as batch:
                batch.add_column(sa.Column("user_id", sa.String(length=36), nullable=True))

            op.execute(
                "UPDATE pinned_questions SET user_id = COALESCE(user_id, 'legacy-' || id)"
            )

            with op.batch_alter_table("pinned_questions") as batch:
                batch.alter_column(
                    "user_id",
                    existing_type=sa.String(length=36),
                    nullable=False,
                )
        uniques = {uc["name"] for uc in insp.get_unique_constraints("pinned_questions")}
        if "uq_pins_dataset_user_question" not in uniques:
            with op.batch_alter_table("pinned_questions") as batch:
                batch.create_unique_constraint(
                    "uq_pins_dataset_user_question",
                    ["dataset_id", "user_id", "question"],
                )
    else:
        op.create_table(
            "pinned_questions",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("dataset_id", sa.String(length=36), nullable=False, index=True),
            sa.Column("user_id", sa.String(length=36), nullable=False, index=True),
            sa.Column("question", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint(
                "dataset_id", "user_id", "question", name="uq_pins_dataset_user_question"
            ),
        )


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)

    if _has_table(bind, "dataset_column_preferences"):
        op.drop_table("dataset_column_preferences")

    if _has_table(bind, "pinned_questions"):
        uniques = {uc["name"] for uc in insp.get_unique_constraints("pinned_questions")}
        if "uq_pins_dataset_user_question" in uniques:
            op.drop_constraint(
                "uq_pins_dataset_user_question",
                "pinned_questions",
                type_="unique",
            )
        cols = {c["name"] for c in insp.get_columns("pinned_questions")}
        if "user_id" in cols:
            op.drop_column("pinned_questions", "user_id")
        # Note: we don't restore old unique; downgrade leaves table without user scoping
