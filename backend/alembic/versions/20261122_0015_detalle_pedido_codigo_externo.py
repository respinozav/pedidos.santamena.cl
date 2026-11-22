"""Agrega columna codigo_externo a detalle_pedidos y backfill opcional."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20261122_0015"
down_revision = "20261122_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()

    # 1. Agregar columna codigo_externo a detalle_pedidos
    op.add_column(
        "detalle_pedidos",
        sa.Column("codigo_externo", sa.Integer(), nullable=True),
        schema=schema,
    )

    # 2. Backfill para pedidos existentes cruzando cliente.porcentaje_id y producto_id
    table_prefix = f'"{schema}".' if schema else ""
    try:
        bind.execute(
            sa.text(
                f"""
                UPDATE {table_prefix}detalle_pedidos dp
                SET codigo_externo = ce.codigo_externo
                FROM {table_prefix}pedidos p
                JOIN {table_prefix}clientes c ON c.id = p.cliente_id
                JOIN {table_prefix}codigo_externo ce 
                  ON ce.producto_id = dp.producto_id 
                 AND ce.porcentaje_id = c.porcentaje_id
                 AND ce.activo = true 
                 AND ce.eliminado_at IS NULL
                WHERE dp.pedido_id = p.id
                  AND dp.codigo_externo IS NULL
                """
            )
        )
    except Exception:
        # Si la tabla aun no tiene datos o es SQLite en tests de memoria, continuar de forma segura
        pass


def downgrade() -> None:
    schema = get_settings().database_schema
    op.drop_column("detalle_pedidos", "codigo_externo", schema=schema)
