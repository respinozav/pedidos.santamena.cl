"""Agrega campo con_decimal a los clientes."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20260815_0010"
down_revision = "20260808_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clientes",
        sa.Column("con_decimal", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema=get_settings().database_schema,
    )


def downgrade() -> None:
    op.drop_column(
        "clientes",
        "con_decimal",
        schema=get_settings().database_schema,
    )
