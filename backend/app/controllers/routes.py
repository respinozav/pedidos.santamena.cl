from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import AdminUser, DatabaseSession
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import Categoria, Cliente, CodigoExterno, Credito, Direccion, Estado, Porcentaje, Producto, Rol, Usuario
from app.repositories.base import Repository
from app.schemas.dto import (
    AddressInput,
    AddressOutput,
    CategoryInput,
    CategoryOutput,
    CreditOutput,
    CreditPaymentInput,
    CustomerAccessRequest,
    CustomerInput,
    CustomerOutput,
    ExternalCodeInput,
    ExternalCodeOutput,
    OrderCreate,
    OrderCreditCreate,
    OrderOutput,
    OrderStateOutput,
    OrderStatusUpdate,
    PercentageInput,
    PercentageOutput,
    ProductInput,
    ProductOutput,
    ProductPage,
    RoleOutput,
    TokenOutput,
    UserCreate,
    UserLogin,
    UserOutput,
    UserUpdate,
)
from app.services.ordering import CustomerAccessService, OrderService
from app.services.pricing import customer_product_price

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
    statement = select(Usuario).options(selectinload(Usuario.rol), selectinload(Usuario.porcentaje)).order_by(Usuario.nombre)
    return list(database.scalars(statement))


@router.post("/usuarios", response_model=UserOutput, status_code=status.HTTP_201_CREATED, tags=["Usuarios"])
def create_user(payload: UserCreate, database: DatabaseSession, _: AdminUser) -> Usuario:
    role = database.get(Rol, payload.rol_id)
    if not role or not role.activo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rol no disponible")
    if payload.porcentaje_id:
        pct = database.get(Porcentaje, payload.porcentaje_id)
        if not pct or pct.eliminado_at:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Porcentaje no disponible")
    values = payload.model_dump(exclude={"password"})
    entity = Repository(Usuario, database).add(Usuario(**values, password_hash=hash_password(payload.password)))
    database.commit()
    database.refresh(entity, attribute_names=["rol", "porcentaje"])
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
    if payload.porcentaje_id:
        pct = database.get(Porcentaje, payload.porcentaje_id)
        if not pct or pct.eliminado_at:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Porcentaje no disponible")
    values = payload.model_dump(exclude={"password"})
    if payload.password:
        values["password_hash"] = hash_password(payload.password)
    Repository(Usuario, database).update(entity, values)
    database.commit()
    database.refresh(entity, attribute_names=["rol", "porcentaje"])
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


def get_next_codigointerno(database: Session) -> str:
    bind = database.get_bind()
    if bind and bind.dialect.name == "postgresql":
        schema = getattr(get_settings(), "database_schema", "bdsantamena")
        seq_name = f'"{schema}"."productos_codigointerno_seq"' if schema else '"productos_codigointerno_seq"'
        val = database.scalar(text(f"SELECT nextval('{seq_name}')"))
        return str(val)

    rows = database.scalars(select(Producto.codigointerno)).all()
    max_val = 99
    for code in rows:
        if code and code.isdigit():
            num = int(code)
            if num > max_val:
                max_val = num
    return str(max_val + 1)


@router.get("/productos", response_model=ProductPage, tags=["Productos"])
def list_products(
    database: DatabaseSession,
    category_id: UUID | None = None,
    search: str | None = Query(default=None, max_length=180),
    customer_id: UUID | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
) -> ProductPage:
    statement = select(Producto).options(selectinload(Producto.categoria)).where(Producto.eliminado_at.is_(None), Producto.activo.is_(True))
    if category_id:
        statement = statement.where(Producto.categoria_id == category_id)
    if search:
        statement = statement.where(
            Producto.nombre.ilike(f"%{search}%") | Producto.codigointerno.ilike(f"%{search}%")
        )
    customer = database.get(Cliente, customer_id) if customer_id else None
    total = database.scalar(select(func.count()).select_from(statement.subquery())) or 0
    products = database.scalars(statement.order_by(Producto.nombre).offset((page - 1) * page_size).limit(page_size))
    return ProductPage(
        items=[ProductOutput.model_validate(product, from_attributes=True).model_copy(update={"precio_cliente": customer_product_price(product, customer) if customer else None}) for product in products],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/admin/productos", response_model=ProductPage, tags=["Productos"])
def list_admin_products(
    database: DatabaseSession,
    _: AdminUser,
    category_id: UUID | None = None,
    search: str | None = Query(default=None, max_length=180),
    stock_lt: Decimal | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
) -> ProductPage:
    statement = select(Producto).where(Producto.eliminado_at.is_(None))
    if category_id:
        statement = statement.where(Producto.categoria_id == category_id)
    if search:
        statement = statement.where(
            Producto.nombre.ilike(f"%{search}%") | Producto.codigointerno.ilike(f"%{search}%")
        )
    if stock_lt is not None:
        statement = statement.where(Producto.cantidad < stock_lt)
    total = database.scalar(select(func.count()).select_from(statement.subquery())) or 0
    products = database.scalars(statement.order_by(Producto.nombre).offset((page - 1) * page_size).limit(page_size))
    return ProductPage(items=list(products), total=total, page=page, page_size=page_size)


@router.post("/productos", response_model=ProductOutput, status_code=status.HTTP_201_CREATED, tags=["Productos"])
def create_product(payload: ProductInput, database: DatabaseSession, _: AdminUser) -> Producto:
    values = payload.model_dump()
    if not values.get("codigointerno"):
        values["codigointerno"] = get_next_codigointerno(database)

    duplicate = database.scalar(
        select(Producto.id).where(func.lower(Producto.codigointerno) == values["codigointerno"].lower())
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "El código de producto ya existe")
    entity = Repository(Producto, database).add(Producto(**values))
    database.commit()
    return entity


@router.put("/productos/{product_id}", response_model=ProductOutput, tags=["Productos"])
def update_product(product_id: UUID, payload: ProductInput, database: DatabaseSession, _: AdminUser) -> Producto:
    entity = Repository(Producto, database).get(product_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    values = payload.model_dump()
    if not values.get("codigointerno"):
        values["codigointerno"] = entity.codigointerno

    duplicate = database.scalar(
        select(Producto.id).where(
            func.lower(Producto.codigointerno) == values["codigointerno"].lower(),
            Producto.id != product_id,
        )
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "El código de producto ya existe")
    Repository(Producto, database).update(entity, values)
    database.commit()
    return entity


@router.get("/porcentajes", response_model=list[PercentageOutput], tags=["Porcentajes"])
def list_percentages(database: DatabaseSession, active_only: bool = False) -> list[Porcentaje]:
    statement = select(Porcentaje).where(Porcentaje.eliminado_at.is_(None))
    if active_only:
        statement = statement.where(Porcentaje.activo.is_(True))
    return list(database.scalars(statement.order_by(Porcentaje.valor)))


@router.post("/porcentajes", response_model=PercentageOutput, status_code=status.HTTP_201_CREATED, tags=["Porcentajes"])
def create_percentage(payload: PercentageInput, database: DatabaseSession, _: AdminUser) -> Porcentaje:
    duplicate = database.scalar(
        select(Porcentaje.id).where(
            Porcentaje.valor == payload.valor,
            Porcentaje.eliminado_at.is_(None),
        )
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un porcentaje con este valor")
    values = payload.model_dump()
    if not values.get("nombre"):
        norm_val = payload.valor.normalize() if payload.valor % 1 else int(payload.valor)
        values["nombre"] = f"{norm_val}%"
    entity = Repository(Porcentaje, database).add(Porcentaje(**values))
    database.commit()
    return entity


@router.put("/porcentajes/{percentage_id}", response_model=PercentageOutput, tags=["Porcentajes"])
def update_percentage(
    percentage_id: UUID,
    payload: PercentageInput,
    database: DatabaseSession,
    _: AdminUser,
) -> Porcentaje:
    entity = Repository(Porcentaje, database).get(percentage_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Porcentaje no encontrado")
    duplicate = database.scalar(
        select(Porcentaje.id).where(
            Porcentaje.valor == payload.valor,
            Porcentaje.id != percentage_id,
            Porcentaje.eliminado_at.is_(None),
        )
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un porcentaje con este valor")
    values = payload.model_dump()
    if not values.get("nombre"):
        norm_val = payload.valor.normalize() if payload.valor % 1 else int(payload.valor)
        values["nombre"] = f"{norm_val}%"
    Repository(Porcentaje, database).update(entity, values)
    database.commit()
    return entity


@router.delete("/porcentajes/{percentage_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Porcentajes"])
def delete_percentage(percentage_id: UUID, database: DatabaseSession, _: AdminUser) -> None:
    entity = Repository(Porcentaje, database).get(percentage_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Porcentaje no encontrado")
    Repository(Porcentaje, database).soft_delete(entity)
    database.commit()


@router.get("/productos/selector", response_model=list[ProductOutput], tags=["Productos"])
def list_products_for_selector(database: DatabaseSession, _: AdminUser, active_only: bool = True) -> list[Producto]:
    statement = select(Producto).where(Producto.eliminado_at.is_(None))
    if active_only:
        statement = statement.where(Producto.activo.is_(True))
    return list(database.scalars(statement.order_by(Producto.nombre)))


@router.get("/codigos-externos", response_model=list[ExternalCodeOutput], tags=["Codigos Externos"])
def list_external_codes(
    database: DatabaseSession,
    _: AdminUser,
    active_only: bool = False,
    search: str | None = None,
) -> list[CodigoExterno]:
    statement = (
        select(CodigoExterno)
        .options(selectinload(CodigoExterno.producto), selectinload(CodigoExterno.porcentaje))
        .where(CodigoExterno.eliminado_at.is_(None))
    )
    if active_only:
        statement = statement.where(CodigoExterno.activo.is_(True))
    if search:
        search_term = search.strip()
        search_int = None
        try:
            search_int = int(search_term)
        except ValueError:
            pass
        if search_int is not None:
            statement = statement.where(CodigoExterno.codigo_externo == search_int)
        else:
            statement = statement.join(CodigoExterno.producto).where(
                Producto.nombre.ilike(f"%{search_term}%") | Producto.codigointerno.ilike(f"%{search_term}%")
            )
    return list(database.scalars(statement.order_by(CodigoExterno.codigo_externo)))


@router.post(
    "/codigos-externos",
    response_model=ExternalCodeOutput,
    status_code=status.HTTP_201_CREATED,
    tags=["Codigos Externos"],
)
def create_external_code(payload: ExternalCodeInput, database: DatabaseSession, _: AdminUser) -> CodigoExterno:
    product = database.get(Producto, payload.producto_id)
    if not product or product.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    percentage = database.get(Porcentaje, payload.porcentaje_id)
    if not percentage or percentage.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Porcentaje no encontrado")

    duplicate_code = database.scalar(
        select(CodigoExterno.id).where(
            CodigoExterno.codigo_externo == payload.codigo_externo,
            CodigoExterno.eliminado_at.is_(None),
        )
    )
    if duplicate_code:
        raise HTTPException(status.HTTP_409_CONFLICT, "El código externo ya está registrado")

    duplicate_pair = database.scalar(
        select(CodigoExterno.id).where(
            CodigoExterno.producto_id == payload.producto_id,
            CodigoExterno.porcentaje_id == payload.porcentaje_id,
            CodigoExterno.eliminado_at.is_(None),
        )
    )
    if duplicate_pair:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un código externo configurado para este producto y porcentaje",
        )

    entity = Repository(CodigoExterno, database).add(CodigoExterno(**payload.model_dump()))
    database.commit()
    database.refresh(entity, attribute_names=["producto", "porcentaje"])
    return entity


@router.put(
    "/codigos-externos/{external_code_id}",
    response_model=ExternalCodeOutput,
    tags=["Codigos Externos"],
)
def update_external_code(
    external_code_id: UUID,
    payload: ExternalCodeInput,
    database: DatabaseSession,
    _: AdminUser,
) -> CodigoExterno:
    entity = Repository(CodigoExterno, database).get(external_code_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Código externo no encontrado")

    product = database.get(Producto, payload.producto_id)
    if not product or product.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    percentage = database.get(Porcentaje, payload.porcentaje_id)
    if not percentage or percentage.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Porcentaje no encontrado")

    duplicate_code = database.scalar(
        select(CodigoExterno.id).where(
            CodigoExterno.codigo_externo == payload.codigo_externo,
            CodigoExterno.id != external_code_id,
            CodigoExterno.eliminado_at.is_(None),
        )
    )
    if duplicate_code:
        raise HTTPException(status.HTTP_409_CONFLICT, "El código externo ya está registrado")

    duplicate_pair = database.scalar(
        select(CodigoExterno.id).where(
            CodigoExterno.producto_id == payload.producto_id,
            CodigoExterno.porcentaje_id == payload.porcentaje_id,
            CodigoExterno.id != external_code_id,
            CodigoExterno.eliminado_at.is_(None),
        )
    )
    if duplicate_pair:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un código externo configurado para este producto y porcentaje",
        )

    Repository(CodigoExterno, database).update(entity, payload.model_dump())
    database.commit()
    database.refresh(entity, attribute_names=["producto", "porcentaje"])
    return entity


@router.delete("/codigos-externos/{external_code_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Codigos Externos"])
def delete_external_code(external_code_id: UUID, database: DatabaseSession, _: AdminUser) -> None:
    entity = Repository(CodigoExterno, database).get(external_code_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Código externo no encontrado")
    Repository(CodigoExterno, database).soft_delete(entity)
    database.commit()


@router.get("/clientes", response_model=list[CustomerOutput], tags=["Clientes"])
def list_customers(database: DatabaseSession, _: AdminUser) -> list[Cliente]:
    return list(
        database.scalars(
            select(Cliente)
            .options(selectinload(Cliente.direcciones), selectinload(Cliente.porcentaje_rel))
            .where(Cliente.eliminado_at.is_(None))
            .order_by(Cliente.nombre)
        )
    )


@router.post("/clientes", response_model=CustomerOutput, status_code=status.HTTP_201_CREATED, tags=["Clientes"])
def create_customer(payload: CustomerInput, database: DatabaseSession, _: AdminUser) -> Cliente:
    values = payload.model_dump()
    if payload.porcentaje_id:
        pct = database.get(Porcentaje, payload.porcentaje_id)
        if pct and not pct.eliminado_at:
            values["porcentaje"] = pct.valor
    entity = Repository(Cliente, database).add(Cliente(**values))
    database.commit()
    database.refresh(entity, attribute_names=["direcciones", "porcentaje_rel"])
    return entity


@router.put("/clientes/{customer_id}", response_model=CustomerOutput, tags=["Clientes"])
def update_customer(customer_id: UUID, payload: CustomerInput, database: DatabaseSession, _: AdminUser) -> Cliente:
    entity = Repository(Cliente, database).get(customer_id)
    if not entity or entity.eliminado_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado")
    values = payload.model_dump()
    if payload.porcentaje_id:
        pct = database.get(Porcentaje, payload.porcentaje_id)
        if pct and not pct.eliminado_at:
            values["porcentaje"] = pct.valor
    Repository(Cliente, database).update(entity, values)
    database.commit()
    database.refresh(entity, attribute_names=["direcciones", "porcentaje_rel"])
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


@router.get("/pedidos/{order_id}/pdf", tags=["Pedidos"])
def order_pdf(order_id: UUID, database: DatabaseSession, _: AdminUser) -> Response:
    content = OrderService(database).pdf(order_id)
    code = str(order_id).split("-")[0].upper()
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="pedido-{code}.pdf"'})


@router.post("/pedidos/pdf-bulk", tags=["Pedidos"])
def orders_pdf_bulk(order_ids: list[UUID], database: DatabaseSession, _: AdminUser) -> Response:
    content = OrderService(database).pdf_bulk(order_ids)
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="pedidos.pdf"'})


@router.get("/creditos", response_model=list[CreditOutput], tags=["Créditos"])
def list_credits(database: DatabaseSession, _: AdminUser, pagado: bool = False) -> list[Credito]:
    statement = (
        select(Credito)
        .options(selectinload(Credito.cliente), selectinload(Credito.pedido))
        .where(Credito.pagado.is_(pagado))
        .order_by(Credito.fecha_vencimiento.desc())
    )
    return list(database.scalars(statement))


@router.patch("/creditos/{credit_id}/pago", response_model=CreditOutput, tags=["Créditos"])
def pay_credit(credit_id: UUID, payload: CreditPaymentInput, database: DatabaseSession, _: AdminUser) -> Credito:
    credit = database.scalar(
        select(Credito)
        .options(selectinload(Credito.cliente), selectinload(Credito.pedido))
        .where(Credito.id == credit_id)
    )
    if not credit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Crédito no encontrado")
    if credit.pagado:
        raise HTTPException(status.HTTP_409_CONFLICT, "El crédito ya está pagado")
    credit.pagado = True
    credit.fecha_pago = datetime.combine(payload.fecha_pago, datetime.min.time(), tzinfo=UTC)
    database.commit()
    database.refresh(credit)
    return credit


@router.get("/estados", response_model=list[OrderStateOutput], tags=["Pedidos"])
def list_order_states(database: DatabaseSession, _: AdminUser) -> list[Estado]:
    return list(database.scalars(select(Estado).where(Estado.activo.is_(True)).order_by(Estado.nombre)))


@router.patch("/pedidos/{order_id}/estado", response_model=OrderOutput, tags=["Pedidos"])
def update_order_status(order_id: UUID, payload: OrderStatusUpdate, database: DatabaseSession, _: AdminUser) -> object:
    return OrderService(database).change_status(order_id, payload.estado_id, payload.pagado, payload.dias_credito)


@router.post("/pedidos/{order_id}/credito", response_model=OrderOutput, status_code=status.HTTP_201_CREATED, tags=["Créditos"])
def assign_order_credit(order_id: UUID, payload: OrderCreditCreate, database: DatabaseSession, _: AdminUser) -> object:
    return OrderService(database).assign_credit(order_id, payload.dias_credito)