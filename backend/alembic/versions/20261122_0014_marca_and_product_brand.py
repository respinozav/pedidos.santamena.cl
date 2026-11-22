"""Crea tabla marcas y migra productos hacia relacion Categoria => Marca => Producto."""

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings


revision = "20261122_0014"
down_revision = "20261122_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()

    # 1. Crear tabla marcas
    op.create_table(
        "marcas",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("categoria_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("eliminado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["categoria_id"], [f"{schema}.categorias.id"], ondelete="CASCADE"),
        schema=schema,
    )
    op.create_index("ix_marcas_categoria_id", "marcas", ["categoria_id"], schema=schema)
    op.create_index("ix_marcas_nombre", "marcas", ["nombre"], schema=schema)
    op.create_index("ix_marcas_nombre_categoria", "marcas", ["nombre", "categoria_id"], schema=schema)

    # 2. Agregar columna marca_id a productos
    op.add_column("productos", sa.Column("marca_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True), schema=schema)
    op.create_foreign_key(
        "fk_productos_marca_id_marcas",
        "productos",
        "marcas",
        ["marca_id"],
        ["id"],
        source_schema=schema,
        referent_schema=schema,
        ondelete="RESTRICT",
    )
    op.create_index("ix_productos_marca_id", "productos", ["marca_id"], schema=schema)

    # 3. Migrar productos existentes en PostgreSQL
    if bind.dialect.name == "postgresql":
        table_prods = f'"{schema}"."productos"' if schema else '"productos"'
        table_cats = f'"{schema}"."categorias"' if schema else '"categorias"'
        table_marcas = f'"{schema}"."marcas"' if schema else '"marcas"'

        # Crear una marca general por categoría y asignar marca_id a los productos
        op.execute(
            sa.text(
                f"""
                DO $$
                DECLARE
                    cat RECORD;
                    new_marca_id uuid;
                BEGIN
                    FOR cat IN SELECT id, nombre FROM {table_cats} LOOP
                        new_marca_id := gen_random_uuid();
                        INSERT INTO {table_marcas} (id, categoria_id, nombre, activo, created_at, updated_at)
                        VALUES (new_marca_id, cat.id, 'GENERAL', true, now(), now());

                        UPDATE {table_prods}
                        SET marca_id = new_marca_id
                        WHERE categoria_id = cat.id;
                    END LOOP;
                END $$;
                """
            )
        )

        # En caso de productos huérfanos o sin categoría previa
        op.execute(
            sa.text(
                f"""
                DO $$
                DECLARE
                    fallback_cat_id uuid;
                    fallback_marca_id uuid;
                BEGIN
                    IF EXISTS (SELECT 1 FROM {table_prods} WHERE marca_id IS NULL) THEN
                        SELECT id INTO fallback_cat_id FROM {table_cats} LIMIT 1;
                        IF fallback_cat_id IS NULL THEN
                            fallback_cat_id := gen_random_uuid();
                            INSERT INTO {table_cats} (id, nombre, usa_porcentaje_cliente, porcentaje, activo, created_at, updated_at)
                            VALUES (fallback_cat_id, 'GENERAL', true, 0, true, now(), now());
                        END IF;
                        fallback_marca_id := gen_random_uuid();
                        INSERT INTO {table_marcas} (id, categoria_id, nombre, activo, created_at, updated_at)
                        VALUES (fallback_marca_id, fallback_cat_id, 'GENERAL', true, now(), now());

                        UPDATE {table_prods}
                        SET marca_id = fallback_marca_id
                        WHERE marca_id IS NULL;
                    END IF;
                END $$;
                """
            )
        )

        # Eliminar constraint de foreign key antigua de categoria_id
        op.execute(
            sa.text(
                f"""
                DO $$
                DECLARE
                    fk_name text;
                BEGIN
                    SELECT conname INTO fk_name
                    FROM pg_constraint
                    WHERE conrelid = '{table_prods}'::regclass
                      AND confrelid = '{table_cats}'::regclass;
                    IF fk_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE {table_prods} DROP CONSTRAINT ' || quote_ident(fk_name);
                    END IF;
                END $$;
                """
            )
        )

        # Eliminar índice e columna categoria_id
        op.execute(sa.text(f"DROP INDEX IF EXISTS \"{schema}\".\"ix_productos_categoria_id\""))
        op.execute(sa.text(f'ALTER TABLE {table_prods} DROP COLUMN IF EXISTS "categoria_id"'))
        op.execute(sa.text(f'ALTER TABLE {table_prods} ALTER COLUMN "marca_id" SET NOT NULL'))


def downgrade() -> None:
    schema = get_settings().database_schema
    bind = op.get_bind()

    # Re-agregar columna categoria_id
    op.add_column("productos", sa.Column("categoria_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True), schema=schema)
    op.create_foreign_key(
        "fk_productos_categoria_id_categorias",
        "productos",
        "categorias",
        ["categoria_id"],
        ["id"],
        source_schema=schema,
        referent_schema=schema,
        ondelete="RESTRICT",
    )
    op.create_index("ix_productos_categoria_id", "productos", ["categoria_id"], schema=schema)

    if bind.dialect.name == "postgresql":
        table_prods = f'"{schema}"."productos"' if schema else '"productos"'
        table_marcas = f'"{schema}"."marcas"' if schema else '"marcas"'
        op.execute(
            sa.text(
                f"""
                UPDATE {table_prods} p
                SET categoria_id = m.categoria_id
                FROM {table_marcas} m
                WHERE p.marca_id = m.id;
                """
            )
        )

    op.drop_constraint("fk_productos_marca_id_marcas", "productos", schema=schema, type_="foreignkey")
    op.drop_index("ix_productos_marca_id", table_name="productos", schema=schema)
    op.drop_column("productos", "marca_id", schema=schema)

    op.drop_index("ix_marcas_nombre_categoria", table_name="marcas", schema=schema)
    op.drop_index("ix_marcas_nombre", table_name="marcas", schema=schema)
    op.drop_index("ix_marcas_categoria_id", table_name="marcas", schema=schema)
    op.drop_table("marcas", schema=schema)
