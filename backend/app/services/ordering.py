from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.entities import Cliente, DetallePedido, Direccion, Estado, Pedido, Producto
from app.repositories.base import Repository
from app.schemas.dto import OrderCreate


class OrderService:
    def __init__(self, database: Session):
        self.database = database

    def create(self, customer_id: UUID, payload: OrderCreate) -> Pedido:
        customer = self.database.get(Cliente, customer_id)
        address = self.database.get(Direccion, payload.direccion_id)
        if not customer or not customer.activo or not address or address.cliente_id != customer_id or not address.activo:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Cliente o direccion invalida")

        product_ids = [line.producto_id for line in payload.productos]
        products = {product.id: product for product in self.database.scalars(select(Producto).where(Producto.id.in_(product_ids)))}
        if len(products) != len(set(product_ids)):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Uno o mas productos no existen")

        details: list[DetallePedido] = []
        subtotal = Decimal("0")
        multiplier = Decimal("1") + customer.porcentaje / Decimal("100")
        for line in payload.productos:
            product = products[line.producto_id]
            if not product.activo or product.cantidad < line.cantidad:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Stock insuficiente: {product.codigo}")
            applied_price = (product.precio * multiplier).quantize(Decimal("0.01"))
            line_total = applied_price * line.cantidad
            product.cantidad -= line.cantidad
            subtotal += line_total
            details.append(DetallePedido(producto_id=product.id, codigo_producto=product.codigo, nombre_producto=product.nombre, precio_unitario=applied_price, cantidad=line.cantidad, subtotal=line_total))

        initial_state = self.database.scalar(select(Estado).where(Estado.nombre == "Pedido", Estado.activo.is_(True)))
        if not initial_state:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Estado inicial no configurado")
        order = Pedido(cliente_id=customer_id, direccion_id=address.id, estado_id=initial_state.id, subtotal=subtotal, total=subtotal, detalles=details)
        self.database.add(order)
        self.database.commit()
        return self.get(order.id)

    def get(self, order_id: UUID) -> Pedido:
        order = self.database.scalar(select(Pedido).options(selectinload(Pedido.detalles), selectinload(Pedido.estado), selectinload(Pedido.cliente), selectinload(Pedido.direccion)).where(Pedido.id == order_id))
        if not order:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
        return order

    def list_for_customer(self, customer_id: UUID, state_id: UUID | None = None) -> list[Pedido]:
        statement = select(Pedido).options(selectinload(Pedido.detalles), selectinload(Pedido.estado), selectinload(Pedido.cliente), selectinload(Pedido.direccion)).where(Pedido.cliente_id == customer_id)
        if state_id:
            statement = statement.where(Pedido.estado_id == state_id)
        return list(self.database.scalars(statement.order_by(Pedido.created_at.desc())))

    def list_all(self) -> list[Pedido]:
        statement = select(Pedido).options(selectinload(Pedido.detalles), selectinload(Pedido.estado), selectinload(Pedido.cliente), selectinload(Pedido.direccion))
        return list(self.database.scalars(statement.order_by(Pedido.created_at.desc())))

    def change_status(self, order_id: UUID, next_state_id: UUID) -> Pedido:
        order = self.get(order_id)
        next_state = self.database.get(Estado, next_state_id)
        if not next_state or not next_state.activo:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Estado no disponible")
        transitions = {"Pedido": {"Despachado", "Cancelado"}, "Despachado": {"Entregado", "Cancelado"}}
        if next_state.nombre not in transitions.get(order.estado.nombre, set()):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Transicion de estado no permitida")
        order.estado_id = next_state.id
        self.database.commit()
        return self.get(order.id)


class CustomerAccessService:
    def __init__(self, database: Session):
        self.database = database

    def authenticate(self, identifier: str) -> Cliente:
        identifier = identifier.strip()
        customer = self.database.scalar(
            select(Cliente).where(
                Cliente.activo.is_(True),
                or_(Cliente.rut == identifier, Cliente.celular == identifier, Cliente.nombre.ilike(identifier)),
            )
        )
        if not customer:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cliente no autorizado")
        return customer