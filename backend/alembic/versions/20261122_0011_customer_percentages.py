"""Crea tabla porcentajes y relaciona con clientes y usuarios."""

from decimal import Decimal
import uuid

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20261122_0011"
down_revision = "20260815_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema

    # 1. Crear tabla porcentajes
    op.create_table(
        "porcentajes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("valor", sa.Numeric(5, 2), nullable=False),
        sa.Column("nombre", sa.String(50), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("eliminado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        schema=schema,
    )
    op.create_index("ix_porcentajes_valor", "porcentajes", ["valor"], unique=True, schema=schema)

    # 2. Agregar columna porcentaje_id a clientes y crear foreign key
    op.add_column(
        "clientes",
        sa.Column("porcentaje_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        schema=schema,
    )
    op.create_foreign_key(
        "fk_clientes_porcentaje_id",
        "clientes",
        "porcentajes",
        ["porcentaje_id"],
        ["id"],
        source_schema=schema,
        referent_schema=schema,
        ondelete="SET NULL",
    )
    op.create_index("ix_clientes_porcentaje_id", "clientes", ["porcentaje_id"], schema=schema)

    # 3. Agregar columna porcentaje_id a usuarios y crear foreign key
    op.add_column(
        "usuarios",
        sa.Column("porcentaje_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        schema=schema,
    )
    op.create_foreign_key(
        "fk_usuarios_porcentaje_id",
        "usuarios",
        "porcentajes",
        ["porcentaje_id"],
        ["id"],
        source_schema=schema,
        referent_schema=schema,
        ondelete="SET NULL",
    )
    op.create_index("ix_usuarios_porcentaje_id", "usuarios", ["porcentaje_id"], schema=schema)

    # 4. Insertar datos iniciales: 2%, 3%, 3.5%
    porcentajes_table = sa.table(
        "porcentajes",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("valor", sa.Numeric(5, 2)),
        sa.column("nombre", sa.String(50)),
        sa.column("activo", sa.Boolean()),
        schema=schema,
    )
    op.bulk_insert(
        porcentajes_table,
        [
            {"id": uuid.uuid4(), "valor": Decimal("2.00"), "nombre": "2%", "activo": True},
            {"id": uuid.uuid4(), "valor": Decimal("3.00"), "nombre": "3%", "activo": True},
            {"id": uuid.uuid4(), "valor": Decimal("3.50"), "nombre": "3.5%", "activo": True},
        ],
    )

    # 5. Relacionar clientes existentes que ya tengan estos valores
    bind = op.get_bind()
    bind.execute(
        sa.text(
            f"""
            UPDATE "{schema}"."clientes" c
            SET "porcentaje_id" = p."id"
            FROM "{schema}"."porcentajes" p
            WHERE c."porcentaje" = p."valor" AND c."porcentaje_id" IS NULL
            """
        )
    )


def downgrade() -> None:
    schema = get_settings().database_schema

    op.drop_constraint("fk_usuarios_porcentaje_id", "usuarios", type_="foreignkey", schema=schema)
    op.drop_index("ix_usuarios_porcentaje_id", table_name="usuarios", schema=schema)
    op.drop_column("usuarios", "porcentaje_id", schema=schema)

    op.drop_constraint("fk_clientes_porcentaje_id", "clientes", type_="foreignkey", schema=schema)
    op.drop_index("ix_clientes_porcentaje_id", table_name="clientes", schema=schema)
    op.drop_column("clientes", "porcentaje_id", schema=schema)

    op.drop_index("ix_porcentajes_valor", table_name="porcentajes", schema=schema)
    op.drop_table("porcentajes", schema=schema)
