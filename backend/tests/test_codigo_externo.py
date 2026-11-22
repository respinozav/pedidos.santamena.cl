import unittest
import uuid

from app.models.entities import CodigoExterno
from app.schemas.dto import ExternalCodeInput, ExternalCodeOutput


class TestCodigoExterno(unittest.TestCase):
    def test_codigo_externo_model(self) -> None:
        uid = uuid.uuid4()
        prod_id = uuid.uuid4()
        pct_id = uuid.uuid4()
        entity = CodigoExterno(
            id=uid,
            codigo_externo=1001,
            producto_id=prod_id,
            porcentaje_id=pct_id,
            activo=True,
        )
        self.assertEqual(entity.id, uid)
        self.assertEqual(entity.codigo_externo, 1001)
        self.assertEqual(entity.producto_id, prod_id)
        self.assertEqual(entity.porcentaje_id, pct_id)
        self.assertTrue(entity.activo)

    def test_external_code_input_standard(self) -> None:
        prod_id = uuid.uuid4()
        pct_id = uuid.uuid4()
        payload = ExternalCodeInput(
            codigo_externo=2002,
            producto_id=prod_id,
            porcentaje_id=pct_id,
            activo=True,
        )
        self.assertEqual(payload.codigo_externo, 2002)
        self.assertEqual(payload.producto_id, prod_id)
        self.assertEqual(payload.porcentaje_id, pct_id)

    def test_external_code_input_aliases(self) -> None:
        prod_id = uuid.uuid4()
        pct_id = uuid.uuid4()
        payload = ExternalCodeInput.model_validate(
            {
                "codoexterno": 3003,
                "idproducto": prod_id,
                "idporcentaje": pct_id,
                "activo": False,
            }
        )
        self.assertEqual(payload.codigo_externo, 3003)
        self.assertEqual(payload.producto_id, prod_id)
        self.assertEqual(payload.porcentaje_id, pct_id)
        self.assertFalse(payload.activo)

    def test_external_code_output(self) -> None:
        uid = uuid.uuid4()
        prod_id = uuid.uuid4()
        pct_id = uuid.uuid4()
        output = ExternalCodeOutput(
            id=uid,
            codigo_externo=4004,
            producto_id=prod_id,
            porcentaje_id=pct_id,
            activo=True,
        )
        self.assertEqual(output.id, uid)
        self.assertEqual(output.codigo_externo, 4004)


if __name__ == "__main__":
    unittest.main()
