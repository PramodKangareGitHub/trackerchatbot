"""
Drop unique constraint on demand_id to allow duplicates across postings.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260311_0011_drop_unique_constraint_on_demand_id"
down_revision = "20260309_0010_allow_duplicate_demand_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Clean up any leftover temp table from a failed prior batch run
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_hcl_demand")
    # SQLite needs table recreation for constraint changes.
    with op.batch_alter_table("hcl_demand", recreate="always") as batch_op:
        # Drop the unique constraint created in 0008
        batch_op.drop_constraint("uq_hcl_demand_demand_id", type_="unique")
        # Drop any existing index with this name (unique or not), then recreate non-unique
        try:
            batch_op.drop_index("ix_hcl_demand_demand_id")
        except Exception:
            pass
        batch_op.create_index("ix_hcl_demand_demand_id", ["demand_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("hcl_demand", recreate="always") as batch_op:
        batch_op.drop_index("ix_hcl_demand_demand_id")
        batch_op.create_unique_constraint("uq_hcl_demand_demand_id", ["demand_id"])
