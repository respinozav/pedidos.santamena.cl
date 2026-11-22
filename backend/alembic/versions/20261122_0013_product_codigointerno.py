"""Renombra codigo a codigointerno en productos y agrega secuencia desde 100."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20261122_0013"
down_revision = "20261122_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()

    # 1. Renombrar columna codigo -> codigointerno
    op.alter_column("productos", "codigo", new_column_name="codigointerno", schema=schema)

    # 2. Manejo de secuencia y datos correlativos en PostgreSQL
    if bind.dialect.name == "postgresql":
        seq_name = f'"{schema}"."productos_codigointerno_seq"' if schema else '"productos_codigointerno_seq"'
        table_name = f'"{schema}"."productos"' if schema else '"productos"'

        # Crear secuencia iniciando en 100
        op.execute(sa.text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 100 INCREMENT BY 1"))

        # Actualizar productos existentes que tengan código nulo, no numérico o menor a 100
        op.execute(
            sa.text(
                f"""
                DO $$
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN 
                        SELECT id FROM {table_name} 
                        WHERE codigointerno IS NULL 
                           OR codigointerno !~ '^[0-9]+$' 
                           OR codigointerno::bigint < 100 
                        ORDER BY created_at NULLS LAST, id 
                    LOOP
                        UPDATE {table_name}
                        SET codigointerno = nextval('{seq_name}')::text
                        WHERE id = r.id;
                    END LOOP;
                END $$;
                """
            )
        )

        # Ajustar el valor de la secuencia para que el siguiente valor sea el máximo existente + 1 (mínimo 100)
        op.execute(
            sa.text(
                f"""
                SELECT setval(
                    '{seq_name}',
                    GREATEST(100, COALESCE((SELECT MAX(codigointerno::bigint) FROM {table_name} WHERE codigointerno ~ '^[0-9]+$'), 99) + 1),
                    false
                );
                """
            )
        )


def downgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        seq_name = f'"{schema}"."productos_codigointerno_seq"' if schema else '"productos_codigointerno_seq"'
        op.execute(sa.text(f"DROP SEQUENCE IF EXISTS {seq_name}"))

    op.alter_column("productos", "codigointerno", new_column_name="codigo", schema=schema)
