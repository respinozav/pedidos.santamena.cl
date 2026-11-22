import unittest
import uuid
from decimal import Decimal
from unittest.mock import MagicMock

from app.controllers.routes import get_next_codigointerno
from app.models.entities import Producto
from app.schemas.dto import ProductInput, ProductOutput


class TestProductoCodigoInterno(unittest.TestCase):
    def test_producto_model_codigointerno_and_codigo_property(self) -> None:
        uid = uuid.uuid4()
        cat_id = uuid.uuid4()
        prod = Producto(
            id=uid,
            categoria_id=cat_id,
            codigointerno="100",
            nombre="MANZANA",
            precio=Decimal("1500"),
            cantidad=Decimal("10"),
        )
        self.assertEqual(prod.codigointerno, "100")
        self.assertEqual(prod.codigo, "100")

        # Setter via property
        prod.codigo = "101"
        self.assertEqual(prod.codigointerno, "101")
        self.assertEqual(prod.codigo, "101")

    def test_product_input_optional_codigointerno_and_alias(self) -> None:
        cat_id = uuid.uuid4()
        # Without codigointerno (creación automática)
        payload = ProductInput(
            categoria_id=cat_id,
            nombre="PLÁTANO",
            precio=Decimal("1200"),
            cantidad=Decimal("5.0"),
        )
        self.assertIsNone(payload.codigointerno)

        # With alias 'codigo'
        payload_with_alias = ProductInput.model_validate(
            {
                "categoria_id": cat_id,
                "codigo": "abc-100",
                "nombre": "PLÁTANO",
                "precio": Decimal("1200"),
                "cantidad": Decimal("5.0"),
            }
        )
        self.assertEqual(payload_with_alias.codigointerno, "ABC-100")

    def test_product_output_syncs_codigo(self) -> None:
        cat_id = uuid.uuid4()
        prod_id = uuid.uuid4()
        output = ProductOutput(
            id=prod_id,
            categoria_id=cat_id,
            codigointerno="105",
            nombre="NARANJA",
            precio=Decimal("990"),
            cantidad=Decimal("20.0"),
        )
        self.assertEqual(output.codigointerno, "105")
        self.assertEqual(output.codigo, "105")

    def test_get_next_codigointerno_starts_at_100_when_empty(self) -> None:
        mock_db = MagicMock()
        mock_db.get_bind.return_value.dialect.name = "sqlite"
        mock_db.scalars.return_value.all.return_value = []

        next_code = get_next_codigointerno(mock_db)
        self.assertEqual(next_code, "100")

    def test_get_next_codigointerno_increments_from_max(self) -> None:
        mock_db = MagicMock()
        mock_db.get_bind.return_value.dialect.name = "sqlite"
        mock_db.scalars.return_value.all.return_value = ["100", "101", "104", "TEXTO", None]

        next_code = get_next_codigointerno(mock_db)
        self.assertEqual(next_code, "105")
