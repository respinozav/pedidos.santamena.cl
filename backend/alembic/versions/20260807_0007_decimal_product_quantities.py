"""Permite inventario y pedidos en medias unidades."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20260807_0007"
down_revision = "20260805_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema
    op.alter_column(
        "productos",
        "cantidad",
        schema=schema,
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
        postgresql_using="cantidad::numeric(12, 2)",
    )
    op.alter_column(
        "detalle_pedidos",
        "cantidad",
        schema=schema,
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
        postgresql_using="cantidad::numeric(12, 2)",
    )


def downgrade() -> None:
    schema = get_settings().database_schema
    op.alter_column(
        "detalle_pedidos",
        "cantidad",
        schema=schema,
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="CEIL(cantidad)::integer",
    )
    op.alter_column(
        "productos",
        "cantidad",
        schema=schema,
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="CEIL(cantidad)::integer",
    )