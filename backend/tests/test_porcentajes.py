from decimal import Decimal
import unittest
import uuid

from app.models.entities import Cliente, Porcentaje, Usuario
from app.schemas.dto import CustomerInput, CustomerOutput, PercentageInput, PercentageOutput, UserInput, UserOutput


class TestPorcentajes(unittest.TestCase):
    def test_porcentaje_model_uuid(self) -> None:
        pct_id = uuid.uuid4()
        pct = Porcentaje(id=pct_id, valor=Decimal("2.00"), nombre="2%", activo=True)
        self.assertIsInstance(pct.id, uuid.UUID)
        self.assertEqual(pct.valor, Decimal("2.00"))
        self.assertEqual(pct.nombre, "2%")
        self.assertTrue(pct.activo)

    def test_percentage_schemas(self) -> None:
        p_in = PercentageInput(valor=Decimal("3.50"), nombre="3.5%")
        self.assertEqual(p_in.valor, Decimal("3.50"))
        self.assertEqual(p_in.nombre, "3.5%")
        self.assertTrue(p_in.activo)

        uid = uuid.uuid4()
        p_out = PercentageOutput(id=uid, valor=Decimal("3.50"), nombre="3.5%", activo=True)
        self.assertEqual(p_out.id, uid)

    def test_customer_schemas_with_percentage(self) -> None:
        pct_id = uuid.uuid4()
        cust_in = CustomerInput(
            nombre="Cliente Prueba",
            porcentaje=Decimal("2.00"),
            porcentaje_id=pct_id,
        )
        self.assertEqual(cust_in.porcentaje_id, pct_id)
        self.assertEqual(cust_in.porcentaje, Decimal("2.00"))

        cust_uid = uuid.uuid4()
        cust_out = CustomerOutput(
            id=cust_uid,
            nombre="Cliente Prueba",
            porcentaje=Decimal("2.00"),
            porcentaje_id=pct_id,
            porcentaje_rel=PercentageOutput(id=pct_id, valor=Decimal("2.00"), nombre="2%", activo=True),
        )
        self.assertEqual(cust_out.porcentaje_id, pct_id)
        self.assertIsNotNone(cust_out.porcentaje_rel)
        self.assertEqual(cust_out.porcentaje_rel.nombre, "2%")

    def test_user_schemas_with_percentage(self) -> None:
        pct_id = uuid.uuid4()
        role_id = uuid.uuid4()
        user_in = UserInput(
            nombre="Admin Test",
            correo="admin@example.com",
            rol_id=role_id,
            porcentaje_id=pct_id,
        )
        self.assertEqual(user_in.porcentaje_id, pct_id)


if __name__ == "__main__":
    unittest.main()
