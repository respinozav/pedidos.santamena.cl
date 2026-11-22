import unittest
import uuid
from decimal import Decimal

from app.models.entities import Categoria, Marca, Producto
from app.schemas.dto import BrandInput, BrandOutput, ProductInput, ProductOutput
from app.services.pricing import customer_product_price
from app.models.entities import Cliente


class TestMarcaModelAndHierarchy(unittest.TestCase):
    def test_marca_model_and_product_relation(self) -> None:
        cat_id = uuid.uuid4()
        marca_id = uuid.uuid4()
        prod_id = uuid.uuid4()

        cat = Categoria(
            id=cat_id,
            nombre="BEBIDAS",
            usa_porcentaje_cliente=False,
            porcentaje=Decimal("10.0"),
        )
        marca = Marca(
            id=marca_id,
            categoria_id=cat_id,
            nombre="COCA COLA",
            activo=True,
        )
        marca.categoria = cat

        prod = Producto(
            id=prod_id,
            marca_id=marca_id,
            codigointerno="100",
            nombre="COCA COLA 1.5L",
            precio=Decimal("1000"),
            cantidad=Decimal("50"),
        )
        prod.marca = marca

        self.assertEqual(prod.marca_id, marca_id)
        self.assertEqual(prod.marca.nombre, "COCA COLA")
        self.assertEqual(prod.categoria.nombre, "BEBIDAS")
        self.assertEqual(prod.categoria_id, cat_id)

        # Test customer_product_price through hierarchy
        customer = Cliente(id=uuid.uuid4(), porcentaje=Decimal("5.0"))
        # Category uses category percentage (10%)
        price = customer_product_price(prod, customer)
        self.assertEqual(price, Decimal("1100.00"))

    def test_brand_input_and_output(self) -> None:
        cat_id = uuid.uuid4()
        brand_id = uuid.uuid4()

        payload = BrandInput(
            categoria_id=cat_id,
            nombre="soprole",
            activo=True,
        )
        self.assertEqual(payload.nombre, "SOPROLE")
        self.assertEqual(payload.categoria_id, cat_id)

        output = BrandOutput(
            id=brand_id,
            categoria_id=cat_id,
            nombre="SOPROLE",
            activo=True,
        )
        self.assertEqual(output.id, brand_id)
        self.assertEqual(output.nombre, "SOPROLE")

    def test_product_input_and_output_hierarchy(self) -> None:
        cat_id = uuid.uuid4()
        brand_id = uuid.uuid4()
        prod_id = uuid.uuid4()

        # ProductInput accepts marca_id (or legacy categoria_id via alias)
        input_dto = ProductInput(
            marca_id=brand_id,
            nombre="LECHE ENTERA",
            precio=Decimal("800"),
            cantidad=Decimal("10.0"),
        )
        self.assertEqual(input_dto.marca_id, brand_id)

        brand_out = BrandOutput(
            id=brand_id,
            categoria_id=cat_id,
            nombre="SOPROLE",
            activo=True,
        )
        output_dto = ProductOutput(
            id=prod_id,
            marca_id=brand_id,
            marca=brand_out,
            codigointerno="101",
            nombre="LECHE ENTERA",
            precio=Decimal("800"),
            cantidad=Decimal("10.0"),
        )
        self.assertEqual(output_dto.marca_id, brand_id)
        self.assertEqual(output_dto.marca.nombre, "SOPROLE")
        self.assertEqual(output_dto.categoria_id, cat_id)
