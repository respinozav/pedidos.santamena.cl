"""Crea tabla codigo_externo y sus relaciones."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20261122_0012"
down_revision = "20261122_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema

    op.create_table(
        "codigo_externo",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo_externo", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("porcentaje_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("eliminado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["producto_id"], [f"{schema}.productos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["porcentaje_id"], [f"{schema}.porcentajes.id"], ondelete="CASCADE"),
        schema=schema,
    )
    op.create_index("ix_codigo_externo_codigo_externo", "codigo_externo", ["codigo_externo"], schema=schema)
    op.create_index("ix_codigo_externo_producto_id", "codigo_externo", ["producto_id"], schema=schema)
    op.create_index("ix_codigo_externo_porcentaje_id", "codigo_externo", ["porcentaje_id"], schema=schema)


def downgrade() -> None:
    schema = get_settings().database_schema

    op.drop_index("ix_codigo_externo_porcentaje_id", table_name="codigo_externo", schema=schema)
    op.drop_index("ix_codigo_externo_producto_id", table_name="codigo_externo", schema=schema)
    op.drop_index("ix_codigo_externo_codigo_externo", table_name="codigo_externo", schema=schema)
    op.drop_table("codigo_externo", schema=schema)
