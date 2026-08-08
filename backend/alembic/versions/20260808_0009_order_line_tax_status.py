"""Guarda la condición tributaria en el detalle del pedido."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20260808_0009"
down_revision = "20260808_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema
    op.add_column(
        "detalle_pedidos",
        sa.Column("afecto", sa.Boolean(), nullable=False, server_default=sa.true()),
        schema=schema,
    )
    op.execute(
        sa.text(
            f'UPDATE "{schema}".detalle_pedidos AS detalle '
            f'SET afecto = producto.afecto FROM "{schema}".productos AS producto '
            "WHERE producto.id = detalle.producto_id"
        )
    )


def downgrade() -> None:
    op.drop_column(
        "detalle_pedidos",
        "afecto",
        schema=get_settings().database_schema,
    )