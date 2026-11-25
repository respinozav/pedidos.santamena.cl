import unittest
import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.entities import (
    Categoria,
    Cliente,
    CodigoExterno,
    Direccion,
    Estado,
    Marca,
    Pedido,
    Porcentaje,
    Producto,
)
from app.schemas.dto import OrderCreate, OrderLineInput
from app.services.ordering import OrderService


class TestPorcentajeFiltering(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        # Seed states
        self.estado_inicial = Estado(id=uuid.uuid4(), nombre="Pedido", activo=True)
        self.db.add(self.estado_inicial)

        # Seed categories and brand
        self.categoria = Categoria(id=uuid.uuid4(), nombre="TABACOS", activo=True)
        self.db.add(self.categoria)
        self.marca = Marca(id=uuid.uuid4(), categoria_id=self.categoria.id, nombre="KENT", activo=True)
        self.db.add(self.marca)

        # Seed percentages: 0%, 2%, 3%
        self.pct_0 = Porcentaje(id=uuid.uuid4(), valor=Decimal("0.00"), nombre="0%", activo=True)
        self.pct_2 = Porcentaje(id=uuid.uuid4(), valor=Decimal("2.00"), nombre="2%", activo=True)
        self.pct_3 = Porcentaje(id=uuid.uuid4(), valor=Decimal("3.00"), nombre="3%", activo=True)
        self.db.add_all([self.pct_0, self.pct_2, self.pct_3])

        # Seed products
        self.prod_zero = Producto(
            id=uuid.uuid4(),
            marca_id=self.marca.id,
            codigointerno="100",
            nombre="Producto Universal 0%",
            precio=Decimal("1000.00"),
            cantidad=Decimal("100.00"),
            activo=True,
        )
        self.prod_two = Producto(
            id=uuid.uuid4(),
            marca_id=self.marca.id,
            codigointerno="101",
            nombre="Producto Especial 2%",
            precio=Decimal("2000.00"),
            cantidad=Decimal("100.00"),
            activo=True,
        )
        self.prod_three = Producto(
            id=uuid.uuid4(),
            marca_id=self.marca.id,
            codigointerno="102",
            nombre="Producto Exclusivo 3%",
            precio=Decimal("3000.00"),
            cantidad=Decimal("100.00"),
            activo=True,
        )
        self.db.add_all([self.prod_zero, self.prod_two, self.prod_three])

        # Seed external codes mapping products to percentages
        self.code_zero = CodigoExterno(
            id=uuid.uuid4(),
            codigo_externo=50001,
            producto_id=self.prod_zero.id,
            porcentaje_id=self.pct_0.id,
            activo=True,
        )
        self.code_two = CodigoExterno(
            id=uuid.uuid4(),
            codigo_externo=50002,
            producto_id=self.prod_two.id,
            porcentaje_id=self.pct_2.id,
            activo=True,
        )
        self.code_three = CodigoExterno(
            id=uuid.uuid4(),
            codigo_externo=50003,
            producto_id=self.prod_three.id,
            porcentaje_id=self.pct_3.id,
            activo=True,
        )
        self.db.add_all([self.code_zero, self.code_two, self.code_three])

        # Seed customers
        self.cliente_dos = Cliente(
            id=uuid.uuid4(),
            rut="11.111.111-1",
            nombre="Cliente Dos Por Ciento",
            porcentaje=Decimal("2.00"),
            porcentaje_id=self.pct_2.id,
            activo=True,
        )
        self.cliente_tres = Cliente(
            id=uuid.uuid4(),
            rut="22.222.222-2",
            nombre="Cliente Tres Por Ciento",
            porcentaje=Decimal("3.00"),
            porcentaje_id=self.pct_3.id,
            activo=True,
        )
        self.db.add_all([self.cliente_dos, self.cliente_tres])

        # Seed addresses
        self.dir_dos = Direccion(
            id=uuid.uuid4(),
            cliente_id=self.cliente_dos.id,
            direccion="Calle Dos 123",
            comuna="Santiago",
            principal=True,
            activo=True,
        )
        self.dir_tres = Direccion(
            id=uuid.uuid4(),
            cliente_id=self.cliente_tres.id,
            direccion="Calle Tres 456",
            comuna="Providencia",
            principal=True,
            activo=True,
        )
        self.db.add_all([self.dir_dos, self.dir_tres])

        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_customer_filtering_in_query(self) -> None:
        from app.controllers.routes import list_products

        # Cliente con 2% debe ver productos con 2% y 0% (prod_zero y prod_two), pero no prod_three
        page_dos = list_products(database=self.db, customer_id=self.cliente_dos.id, page=1, page_size=10)
        visible_ids_dos = {item.id for item in page_dos.items}
        self.assertIn(self.prod_zero.id, visible_ids_dos)
        self.assertIn(self.prod_two.id, visible_ids_dos)
        self.assertNotIn(self.prod_three.id, visible_ids_dos)

        # Cliente con 3% debe ver productos con 3% y 0% (prod_zero y prod_three), pero no prod_two
        page_tres = list_products(database=self.db, customer_id=self.cliente_tres.id, page=1, page_size=10)
        visible_ids_tres = {item.id for item in page_tres.items}
        self.assertIn(self.prod_zero.id, visible_ids_tres)
        self.assertIn(self.prod_three.id, visible_ids_tres)
        self.assertNotIn(self.prod_two.id, visible_ids_tres)

    def test_order_creation_rejects_unauthorized_percentage_product(self) -> None:
        service = OrderService(self.db)
        payload = OrderCreate(
            direccion_id=self.dir_dos.id,
            productos=[
                OrderLineInput(producto_id=self.prod_three.id, cantidad=Decimal("1.0")),
            ],
        )
        with self.assertRaises(HTTPException) as ctx:
            service.create(self.cliente_dos.id, payload)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("no está disponible para su porcentaje asignado", ctx.exception.detail)

    def test_order_creation_accepts_allowed_products_and_sets_ext_code(self) -> None:
        service = OrderService(self.db)
        payload = OrderCreate(
            direccion_id=self.dir_dos.id,
            productos=[
                OrderLineInput(producto_id=self.prod_zero.id, cantidad=Decimal("2.0")),
                OrderLineInput(producto_id=self.prod_two.id, cantidad=Decimal("1.0")),
            ],
        )
        order = service.create(self.cliente_dos.id, payload)
        self.assertIsNotNone(order.id)
        self.assertEqual(len(order.detalles), 2)
        ext_codes_by_prod = {d.producto_id: d.codigo_externo for d in order.detalles}
        self.assertEqual(ext_codes_by_prod[self.prod_zero.id], 50001)
        self.assertEqual(ext_codes_by_prod[self.prod_two.id], 50002)


if __name__ == "__main__":
    unittest.main()
