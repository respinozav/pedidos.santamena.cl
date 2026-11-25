"""Agrega porcentaje 0% a la tabla porcentajes si no existe."""

from decimal import Decimal
import uuid

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20261124_0016"
down_revision = "20261122_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()

    # Insertar 0% si no existe
    table_prefix = f'"{schema}".' if schema else ""
    try:
        bind.execute(
            sa.text(
                f"""
                INSERT INTO {table_prefix}porcentajes (id, valor, nombre, activo, created_at, updated_at)
                SELECT '{uuid.uuid4()}', 0.00, '0%', true, NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM {table_prefix}porcentajes WHERE valor = 0.00 AND eliminado_at IS NULL
                );
                """
            )
        )
    except Exception:
        pass


def downgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()
    table_prefix = f'"{schema}".' if schema else ""
    bind.execute(
        sa.text(f"DELETE FROM {table_prefix}porcentajes WHERE valor = 0.00;")
    )
