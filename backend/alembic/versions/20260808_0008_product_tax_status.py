"""Agrega la condición tributaria a los productos."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20260808_0008"
down_revision = "20260807_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "productos",
        sa.Column("afecto", sa.Boolean(), nullable=False, server_default=sa.true()),
        schema=get_settings().database_schema,
    )


def downgrade() -> None:
    op.drop_column(
        "productos",
        "afecto",
        schema=get_settings().database_schema,
    )