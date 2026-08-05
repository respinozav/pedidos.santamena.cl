from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import AdminUser, DatabaseSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import Categoria, Cliente, Direccion, Estado, Producto, Rol, Usuario
from app.repositories.base import Repository
from app.schemas.dto import (
    AddressInput,
    AddressOutput,
    CategoryInput,
    CategoryOutput,
    CustomerAccessRequest,
    CustomerInput,
    CustomerOutput,
    OrderCreate,
    OrderOutput,
    OrderStateOutput,
    OrderStatusUpdate,
    ProductInput,
    ProductOutput,
    RoleOutput,
    TokenOutput,
    UserCreate,
    UserLogin,
    UserOutput,
    UserUpdate,
)
from app.services.ordering import CustomerAccessService, OrderService

router = APIRouter(prefix="/api")


@router.post("/login", response_model=TokenOutput, tags=["Autenticacion"])
def login(payload: UserLogin, database: DatabaseSession) -> TokenOutput:
    user = database.scalar(select(Usuario).where(Usuario.correo == payload.correo, Usuario.activo.is_(True)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales invalidas")
    return TokenOutput(access_token=create_access_token(user.id, user.rol.nombre))


@router.get("/roles", response_model=list[RoleOutput], tags=["Usuarios"])
def list_roles(database: DatabaseSession, _: AdminUser) -> list[Rol]:
    return list(database.scalars(select(Rol).where(Rol.activo.is_(True)).order_by(Rol.nombre)))


@router.get("/usuarios", response_model=list[UserOutput], tags=["Usuarios"])
def list_users(database: DatabaseSession, _: AdminUser) -> list[Usuario]:
    statement = select(Usuario).options(selectinload(Usuario.rol)).order_by(Usuario.nombre)
    return list(database.scalars(statement))


@router.post("/usuarios", response_model=UserOutput, status_code=status.HTTP_201_CREATED, tags=["Usuarios"])
def create_user(payload: UserCreate, database: DatabaseSession, _: AdminUser) -> Usuario:
    role = database.get(Rol, payload.rol_id)
    if not role or not role.activo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rol no disponible")
    values = payload.model_dump(exclude={"password"})
    entity = Repository(Usuario, database).add(Usuario(**values, password_hash=hash_password(payload.password)))
    database.commit()
    database.refresh(entity, attribute_names=["rol"])
    return entity


@router.put("/usuarios/{user_id}", response_model=UserOutput, tags=["Usuarios"])
def update_user(user_id: UUID, payload: UserUpdate, database: DatabaseSession, current_user: AdminUser) -> Usuario:
    entity = Repository(Usuario, database).get(user_id)
    if not entity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if entity.id == current_user.id and not payload.activo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes desactivar tu propio usuario")
    role = database.get(Rol, payload.rol_id)
    if not role or not role.activo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rol no disponible")
    values = payload.model_dump(exclude={"password"})
    if payload.password:
        values["password_hash"] = hash_password(payload.password)
    Repository(Usuario, database).update(entity, values)
    database.commit()
    database.refresh(entity, attribute_names=["rol"])
    return entity


@router.post("/clientes/acceso", response_model=CustomerOutput, tags=["Acceso cliente"])
def customer_access(payload: CustomerAccessRequest, database: DatabaseSession) -> Cliente:
    return CustomerAccessService(database).authenticate(payload.identificador)


@router.get("/categorias", response_model=list[CategoryOutput], tags=["Categorias"])
def list_categories(database: DatabaseSession, active_only: bool = True) -> list[Categoria]:
    statement = select(Categoria).where(Categoria.eliminado_at.is_(None))
    if active_only:
        statement = statement.where(Categoria.activo.is_(True))
    return list(database.scalars(statement.order_by(Categoria.nombre)))


@router.post("/categorias", response_model=CategoryOutput, status_code=status.HTTP_201_CREATED, tags=["Categorias"])
def create_category(payload: CategoryInput, database: DatabaseSession, _: AdminUser) -> Categoria:
    entity = Repository(Categoria, database).add(Categoria(**payload.model_dump()))
    database.commit()
    return entity


@router.put("/categorias/{category_id}", response_model=CategoryOutput, tags=["Categorias"])
def update_category(category_id: UUID, payload: CategoryInput, database: DatabaseSession, _: AdminUser) -> Categoria:
    entity = Repository(Categoria, database).get(category_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria no encontrada")
    Repository(Categoria, database).update(entity, payload.model_dump())
    database.commit()
    return entity


@router.delete("/categorias/{category_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Categorias"])
def delete_category(category_id: UUID, database: DatabaseSession, _: AdminUser) -> None:
    entity = Repository(Categoria, database).get(category_id)
    if not entity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria no encontrada")
    Repository(Categoria, database).soft_delete(entity)
    database.commit()


@router.get("/productos", response_model=list[ProductOutput], tags=["Productos"])
def list_products(
    database: DatabaseSession,
    category_id: UUID | None = None,
    search: str | None = Query(default=None, max_length=180),
    customer_id: UUID | None = None,
) -> list[ProductOutput]:
    statement = select(Producto).where(Producto.eliminado_at.is_(None), Producto.activo.is_(True))
    if category_id:
        statement = statement.where(Producto.categoria_id == category_id)
    if search:
        statement = statement.where(Producto.nombre.ilike(f"%{search}%"))
    customer = database.get(Cliente, customer_id) if customer_id else None
    multiplier = 1 + (customer.porcentaje / 100) if customer else None
    return [ProductOutput.model_validate(product, from_attributes=True).model_copy(update={"precio_cliente": product.precio * multiplier if multiplier else None}) for product in database.scalars(statement.order_by(Producto.nombre))]


@router.get("/admin/productos", response_model=list[ProductOutput], tags=["Productos"])
def list_admin_products(database: DatabaseSession, _: AdminUser) -> list[Producto]:
    statement = select(Producto).where(Producto.eliminado_at.is_(None)).order_by(Producto.nombre)
    return list(database.scalars(statement))


@router.post("/productos", response_model=ProductOutput, status_code=status.HTTP_201_CREATED, tags=["Productos"])
def create_product(payload: ProductInput, database: DatabaseSession, _: AdminUser) -> Producto:
    duplicate = database.scalar(select(Producto.id).where(func.lower(Producto.codigo) == payload.codigo.lower()))
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "El código de producto ya existe")
    entity = Repository(Producto, database).add(Producto(**payload.model_dump()))
    database.commit()
    return entity


@router.put("/productos/{product_id}", response_model=ProductOutput, tags=["Productos"])
def update_product(product_id: UUID, payload: ProductInput, database: DatabaseSession, _: AdminUser) -> Producto:
    entity = Repository(Producto, database).get(product_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    duplicate = database.scalar(select(Producto.id).where(func.lower(Producto.codigo) == payload.codigo.lower(), Producto.id != product_id))
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "El código de producto ya existe")
    Repository(Producto, database).update(entity, payload.model_dump())
    database.commit()
    return entity


@router.get("/clientes", response_model=list[CustomerOutput], tags=["Clientes"])
def list_customers(database: DatabaseSession, _: AdminUser) -> list[Cliente]:
    return list(database.scalars(select(Cliente).options(selectinload(Cliente.direcciones)).where(Cliente.eliminado_at.is_(None))))


@router.post("/clientes", response_model=CustomerOutput, status_code=status.HTTP_201_CREATED, tags=["Clientes"])
def create_customer(payload: CustomerInput, database: DatabaseSession, _: AdminUser) -> Cliente:
    entity = Repository(Cliente, database).add(Cliente(**payload.model_dump()))
    database.commit()
    return entity


@router.put("/clientes/{customer_id}", response_model=CustomerOutput, tags=["Clientes"])
def update_customer(customer_id: UUID, payload: CustomerInput, database: DatabaseSession, _: AdminUser) -> Cliente:
    entity = Repository(Cliente, database).get(customer_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado")
    Repository(Cliente, database).update(entity, payload.model_dump())
    database.commit()
    return entity


@router.post("/clientes/{customer_id}/direcciones", response_model=AddressOutput, status_code=status.HTTP_201_CREATED, tags=["Clientes"])
def add_address(customer_id: UUID, payload: AddressInput, database: DatabaseSession, _: AdminUser) -> Direccion:
    customer = database.get(Cliente, customer_id)
    if not customer or customer.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado")
    existing_addresses = list(database.scalars(select(Direccion).where(Direccion.cliente_id == customer_id)))
    values = payload.model_dump()
    if payload.principal or not any(address.principal and address.activo for address in existing_addresses):
        for address in existing_addresses:
            address.principal = False
        values["principal"] = True
        values["activo"] = True
    entity = Repository(Direccion, database).add(Direccion(cliente_id=customer_id, **values))
    database.commit()
    return entity


@router.put("/clientes/{customer_id}/direcciones/{address_id}", response_model=AddressOutput, tags=["Clientes"])
def update_address(
    customer_id: UUID,
    address_id: UUID,
    payload: AddressInput,
    database: DatabaseSession,
    _: AdminUser,
) -> Direccion:
    address = database.get(Direccion, address_id)
    if not address or address.cliente_id != customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Direccion no encontrada")
    addresses = list(database.scalars(select(Direccion).where(Direccion.cliente_id == customer_id)))
    if payload.principal:
        for item in addresses:
            item.principal = item.id == address_id
        payload_values = payload.model_dump()
        payload_values["activo"] = True
    else:
        if address.principal and not any(item.id != address_id and item.principal and item.activo for item in addresses):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Debe existir una direccion principal activa")
        payload_values = payload.model_dump()
    Repository(Direccion, database).update(address, payload_values)
    database.commit()
    return address


@router.post("/clientes/{customer_id}/pedidos", response_model=OrderOutput, status_code=status.HTTP_201_CREATED, tags=["Pedidos"])
def create_order(customer_id: UUID, payload: OrderCreate, database: DatabaseSession) -> object:
    return OrderService(database).create(customer_id, payload)


@router.get("/clientes/{customer_id}/pedidos", response_model=list[OrderOutput], tags=["Pedidos"])
def customer_orders(customer_id: UUID, database: DatabaseSession, state_id: UUID | None = None) -> list[object]:
    return OrderService(database).list_for_customer(customer_id, state_id)


@router.get("/clientes/{customer_id}/pedidos/historicos", response_model=list[OrderOutput], tags=["Pedidos"])
def customer_order_history(customer_id: UUID, database: DatabaseSession) -> list[object]:
    return OrderService(database).list_for_customer(customer_id, None)


@router.get("/pedidos", response_model=list[OrderOutput], tags=["Pedidos"])
def list_orders(database: DatabaseSession, _: AdminUser) -> list[object]:
    return OrderService(database).list_all()


@router.get("/estados", response_model=list[OrderStateOutput], tags=["Pedidos"])
def list_order_states(database: DatabaseSession, _: AdminUser) -> list[Estado]:
    return list(database.scalars(select(Estado).where(Estado.activo.is_(True)).order_by(Estado.nombre)))


@router.patch("/pedidos/{order_id}/estado", response_model=OrderOutput, tags=["Pedidos"])
def update_order_status(order_id: UUID, payload: OrderStatusUpdate, database: DatabaseSession, _: AdminUser) -> object:
    return OrderService(database).change_status(order_id, payload.estado_id)