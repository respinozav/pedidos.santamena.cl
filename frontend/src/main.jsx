import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Boxes, CheckCircle2, ClipboardList, Eye, FolderTree, Hash, LayoutDashboard, LogOut, MapPin, Menu, Package, Pencil, Percent, Plus, Save, Search, Settings, ShoppingBag, Tag, Users, X } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import { api, setAdminToken } from "./services/api";
import Swal from "sweetalert2";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });
const configuredInactivityMinutes = Number(import.meta.env.VITE_SESSION_INACTIVITY_MINUTES ?? 10);
const sessionInactivityMilliseconds = (Number.isFinite(configuredInactivityMinutes) && configuredInactivityMinutes > 0 ? configuredInactivityMinutes : 10) * 60 * 1000;
const sessionWarningMilliseconds = 60 * 1000;

function SessionInactivityGuard({ children, onTimeout }) {
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const expiresAt = useRef(Date.now() + sessionInactivityMilliseconds);
  const timedOut = useRef(false);

  useEffect(() => {
    const resetInactivity = () => {
      expiresAt.current = Date.now() + sessionInactivityMilliseconds;
      setSecondsRemaining(null);
    };
    const checkInactivity = () => {
      const millisecondsRemaining = expiresAt.current - Date.now();
      if (millisecondsRemaining <= 0) {
        if (!timedOut.current) {
          timedOut.current = true;
          onTimeout();
        }
        return;
      }
      setSecondsRemaining(millisecondsRemaining <= sessionWarningMilliseconds ? Math.ceil(millisecondsRemaining / 1000) : null);
    };
    const activityEvents = ["pointerdown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetInactivity, { passive: true }));
    const timer = window.setInterval(checkInactivity, 250);
    checkInactivity();
    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetInactivity));
    };
  }, [onTimeout]);

  return <>{children}{secondsRemaining !== null && <div className="session-warning-backdrop" role="presentation"><section className="session-warning" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title" aria-describedby="session-warning-description"><div className="session-countdown" aria-live="assertive">{secondsRemaining}</div><div><p className="eyebrow">SESION INACTIVA</p><h2 id="session-warning-title">Tu sesión está por cerrarse</h2><p id="session-warning-description">Se cerrará en {secondsRemaining} {secondsRemaining === 1 ? "segundo" : "segundos"}. Usa la aplicación para continuar.</p></div></section></div>}</>;
}

function productImageSource(imageBase64) {
  if (!imageBase64) return null;
  return imageBase64.startsWith("http") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
}

function BrandMark() {
  return <span className="brand-mark"><img src="/santa-mena-logo.jpg" alt="Santa Mena" /></span>;
}

function OrderProduct({ line }) {
  return <span className="order-product"><strong>{line.nombre_producto}</strong><small>{line.codigo_producto}</small></span>;
}

function QuantitySelector({ cantidad, onCantidadChange, permiteMediaUnidad = false }) {
  const [halfMode, setHalfMode] = useState(false);
  const step = halfMode ? 0.5 : 1;

  function toggleHalfMode() {
    if (halfMode) onCantidadChange(Math.ceil(Number(cantidad)));
    setHalfMode(!halfMode);
  }

  return <div className="quantity-selector" role="group" aria-label="Selector de cantidad">
    <button className="btn btn-outline-secondary" type="button" onClick={() => onCantidadChange(Math.max(0, Number(cantidad) - step))} aria-label={`Restar ${step}`}>-</button>
    <output aria-live="polite">{Number(cantidad)}</output>
    <button className="btn btn-outline-secondary" type="button" onClick={() => onCantidadChange(Number(cantidad) + step)} aria-label={`Sumar ${step}`}>+</button>
    {permiteMediaUnidad && <button className={`btn half-unit-button ${halfMode ? "btn-primary" : "btn-outline-secondary"}`} type="button" onClick={toggleHalfMode} aria-pressed={halfMode} aria-label={halfMode ? "Modo media unidad" : "Permitir medias unidades"} title={halfMode ? "Modo media unidad" : "Permitir medias unidades"}>½</button>}
  </div>;
}

function Access({ onAccess, onAdminAccess }) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const { data } = await api.post("/clientes/acceso", { identificador: identifier });
      onAccess(data);
    } catch {
      setError("No encontramos un cliente activo con ese dato.");
    }
  }

  return <main className="access-shell"><section className="access-brand"><h1>Pedidos simples.<br />Despachos claros.</h1><p>Haz tu pedido y revisa su estado desde un solo lugar.</p></section><form className="access-form" onSubmit={submit}>
    <div className="access-form-heading"><BrandMark /><p className="eyebrow">PORTAL DE CLIENTES</p><h2>Realiza tu pedido</h2><p>Ingresa con tu RUT, celular o razón social.</p></div>
    <label htmlFor="identifier" className="form-label">Identificador</label>
    <input id="identifier" className="form-control form-control-lg" placeholder="Ej. 12.345.678-9" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
    {error && <p className="text-danger mt-3 mb-0">{error}</p>}
    <button className="btn btn-primary btn-lg w-100 mt-4">Continuar</button>
    <button className="btn btn-link w-100 mt-3" type="button" onClick={onAdminAccess}>Acceso administrador</button>
  </form></main>;
}

function AdminAccess({ onLogin, onCustomerAccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/login", { correo: email, password });
      setAdminToken(data.access_token);
      onLogin();
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="access-shell"><section className="access-brand"><h1>Gestiona cada pedido con control.</h1><p>Catálogo, clientes y despachos en una vista operativa.</p></section><form className="access-form" onSubmit={submit}>
    <div className="access-form-heading"><BrandMark /><p className="eyebrow">ADMINISTRACION</p><h2>Bienvenido</h2><p>Ingresa con tus credenciales para continuar.</p></div>
    <label htmlFor="admin-email" className="form-label">Correo</label>
    <input id="admin-email" className="form-control form-control-lg" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
    <label htmlFor="admin-password" className="form-label mt-3">Contraseña</label>
    <input id="admin-password" className="form-control form-control-lg" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
    {error && <p className="text-danger mt-3 mb-0">{error}</p>}
    <button className="btn btn-primary btn-lg w-100 mt-4" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
    <button className="btn btn-link w-100 mt-3" type="button" onClick={onCustomerAccess}>Volver a pedidos</button>
  </form></main>;
}

function BrandManager({ categories, brands = [], onReload }) {
  const [items, setItems] = useState(brands);
  const [loading, setLoading] = useState(!brands.length);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    categoria_id: "",
    nombre: "",
    activo: true,
  });

  async function loadData() {
    setLoading(true);
    try {
      const { data } = await api.get("/marcas");
      setItems(data);
      if (onReload) onReload();
    } catch {
      setError("No fue posible cargar las marcas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setEditingItem(null);
    setForm({
      categoria_id: categories.find((c) => c.activo)?.id ?? (categories[0]?.id || ""),
      nombre: "",
      activo: true,
    });
    setError("");
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({
      categoria_id: item.categoria_id,
      nombre: item.nombre,
      activo: item.activo,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveBrand(event) {
    event.preventDefault();
    if (!form.categoria_id) {
      setError("Selecciona una categoría.");
      return;
    }
    if (!form.nombre.trim()) {
      setError("Ingresa el nombre de la marca.");
      return;
    }
    setSaving(true);
    const payload = {
      categoria_id: form.categoria_id,
      nombre: form.nombre.trim().toUpperCase(),
      activo: form.activo,
    };
    try {
      if (editingItem) {
        await api.put(`/marcas/${editingItem.id}`, payload);
        setNotice("Marca actualizada correctamente.");
      } else {
        await api.post("/marcas", payload);
        setNotice("Marca agregada correctamente.");
      }
      setModalOpen(false);
      setEditingItem(null);
      setError("");
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible guardar la marca. Revisa que no esté duplicada en la misma categoría.");
    } finally {
      setSaving(false);
    }
  }

  const categoryName = (catId) => categories.find((c) => c.id === catId)?.nombre ?? "-";

  return (
    <>
      <header className="admin-topbar">
        <div className="topbar-title">
          <p className="eyebrow mb-1">CATALOGO</p>
          <h1>Marcas</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-date d-none d-sm-inline">Gestión de Marcas</span>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} />
            Nueva marca
          </button>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-summary">
          <div>
            <p className="eyebrow">INVENTARIO</p>
            <h2>Marcas por Categoría</h2>
            <p>Estructura anidada: Categoría &rarr; Marca &rarr; Producto.</p>
          </div>
          <div className="summary-metric">
            <span>{items.length}</span>
            <small>Marcas registradas</small>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Listado de marcas</h2>
              <p>Marcas activas e inactivas organizadas por categoría.</p>
            </div>
            <span className="panel-count">{items.length} registros</span>
          </div>
          {notice && (
            <div className="alert alert-success alert-dismissible fade show mt-3 category-notice">
              <CheckCircle2 size={18} />
              {notice}
              <button className="btn-close" type="button" onClick={() => setNotice("")} />
            </div>
          )}
          {error && !modalOpen && <div className="alert alert-danger mt-3">{error}</div>}
          {loading ? (
            <p className="mt-4 text-secondary">Cargando marcas...</p>
          ) : (
            <div className="brand-table mt-4">
              <div className="brand-table-head">
                <span>Marca</span>
                <span>Categoría</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {items.length ? (
                items.map((item) => (
                  <div className="brand-row" key={item.id}>
                    <div className="category-name">
                      <span className="category-icon">
                        <Tag size={18} />
                      </span>
                      <strong>{item.nombre}</strong>
                    </div>
                    <span className="brand-category">{item.categoria?.nombre || categoryName(item.categoria_id)}</span>
                    <span className={item.activo ? "status-active" : "status-inactive"}>
                      {item.activo ? "Activa" : "Inactiva"}
                    </span>
                    <div className="d-flex gap-1">
                      <button
                        className="icon-button category-edit"
                        onClick={() => openEdit(item)}
                        aria-label={`Editar ${item.nombre}`}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-secondary p-4 mb-0">Aún no hay marcas registradas. Agrega la primera para comenzar.</p>
              )}
            </div>
          )}
        </section>
      </div>
      {modalOpen && (
        <div className="modal-backdrop-custom">
          <form className="category-modal" onSubmit={saveBrand} role="dialog" aria-modal="true">
            <header>
              <div>
                <p className="eyebrow">MARCA</p>
                <h2>{editingItem ? "Editar marca" : "Nueva marca"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar modal"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              {error && <div className="alert alert-danger mb-3">{error}</div>}
              <div>
                <label className="form-label" htmlFor="brand-category">
                  Categoría
                </label>
                <select
                  id="brand-category"
                  className="form-select"
                  value={form.categoria_id}
                  onChange={(event) => setField("categoria_id", event.target.value)}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {categories
                    .filter((c) => c.activo || c.id === form.categoria_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="form-label" htmlFor="brand-name">
                  Nombre de la marca
                </label>
                <input
                  id="brand-name"
                  className="form-control"
                  value={form.nombre}
                  onChange={(event) => setField("nombre", event.target.value.toUpperCase())}
                  maxLength="120"
                  required
                  placeholder="Ej: COLUN, SOPROLE, COCA COLA..."
                  autoFocus
                />
              </div>
              <div className="status-toggle mt-3">
                <div>
                  <strong>Marca activa</strong>
                  <small>Las marcas inactivas no pueden asociarse a nuevos productos.</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(event) => setField("activo", event.target.checked)}
                  />
                  <span />
                </label>
              </div>
            </div>
            <footer>
              <button type="button" className="btn btn-light" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : <><Save size={17} />{editingItem ? "Guardar cambios" : "Crear marca"}</>}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function ProductManager({ brands = [], categories = [] }) {
  const blankProduct = {
    marca_id: "",
    codigointerno: "",
    codigo: "",
    nombre: "",
    precio: "",
    cantidad: "0",
    imagen_url: "",
    afecto: true,
    activo: true,
  };
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [stockThreshold, setStockThreshold] = useState("");
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(blankProduct);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const imageSource = (value) =>
    value ? `data:image/jpeg;base64,${value}` : null;
  const brandName = (id) =>
    brands.find((brand) => brand.id === id)?.nombre ?? "Sin marca";

  async function loadProducts() {
    try {
      const { data } = await api.get("/admin/productos", {
        params: {
          brand_id: selectedBrand || undefined,
          search: productSearch.trim() || undefined,
          stock_lt: stockThreshold === "" ? undefined : Number(stockThreshold),
          page,
          page_size: 10,
        },
      });
      setProducts(data.items);
      setTotalProducts(data.total);
    } catch {
      setError("No fue posible cargar los productos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadProducts, 200);
    return () => clearTimeout(timer);
  }, [selectedBrand, productSearch, stockThreshold, page]);

  useEffect(() => {
    const table = document.querySelector(".product-table");
    if (!table) return undefined;
    const filters = document.createElement("div");
    filters.className = "product-filters mt-4";
    const brandSelect = document.createElement("select");
    brandSelect.className = "form-select";
    brandSelect.setAttribute("aria-label", "Filtrar por marca");
    brandSelect.append(new Option("Todas las marcas", ""));
    brands.forEach((brand) =>
      brandSelect.append(new Option(brand.nombre, brand.id)),
    );
    const searchField = document.createElement("div");
    searchField.className = "product-search";
    const searchInput = document.createElement("input");
    searchInput.className = "form-control";
    searchInput.placeholder = "Buscar por nombre o código";
    searchInput.setAttribute("aria-label", "Buscar producto por nombre o código");
    searchField.append(searchInput);
    const stockField = document.createElement("div");
    stockField.className = "product-stock-filter";
    const stockLabel = document.createElement("label");
    stockLabel.htmlFor = "product-stock-threshold";
    stockLabel.textContent = "Stock <";
    const stockInput = document.createElement("input");
    stockInput.id = "product-stock-threshold";
    stockInput.className = "form-control";
    stockInput.type = "number";
    stockInput.placeholder = "Sin límite";
    stockInput.setAttribute(
      "aria-label",
      "Filtrar productos con stock menor a",
    );
    stockField.append(stockLabel, stockInput);
    filters.append(brandSelect, searchField, stockField);
    table.before(filters);
    function filterProducts() {
      setSelectedBrand(brandSelect.value);
      setProductSearch(searchInput.value);
      setStockThreshold(stockInput.value);
      setPage(1);
    }
    brandSelect.addEventListener("change", filterProducts);
    searchInput.addEventListener("input", filterProducts);
    stockInput.addEventListener("input", filterProducts);
    return () => {
      brandSelect.removeEventListener("change", filterProducts);
      searchInput.removeEventListener("input", filterProducts);
      stockInput.removeEventListener("input", filterProducts);
      filters.remove();
    };
  }, [brands, loading]);

  useEffect(() => {
    document.querySelectorAll(".product-table .product-row").forEach((row) => {
      row.children[3]?.classList.toggle(
        "stock-critical",
        Number(row.children[3]?.textContent) <= 0,
      );
    });
  }, [products]);

  useEffect(() => {
    const table = document.querySelector(".product-table");
    if (!table || totalProducts <= 10) return undefined;
    const totalPages = Math.ceil(totalProducts / 10);
    const pager = document.createElement("nav");
    pager.className = "product-pagination";
    pager.setAttribute("aria-label", "Paginación de productos");
    const summary = document.createElement("small");
    summary.textContent = `Página ${page} de ${totalPages} · ${totalProducts} productos`;
    const previous = document.createElement("button");
    previous.className = "btn btn-outline-primary btn-sm";
    previous.type = "button";
    previous.textContent = "Anterior";
    previous.disabled = page === 1;
    const next = document.createElement("button");
    next.className = "btn btn-primary btn-sm";
    next.type = "button";
    next.textContent = "Siguiente";
    next.disabled = page === totalPages;
    const goPrevious = () => setPage((current) => Math.max(1, current - 1));
    const goNext = () =>
      setPage((current) => Math.min(totalPages, current + 1));
    previous.addEventListener("click", goPrevious);
    next.addEventListener("click", goNext);
    pager.append(summary, previous, next);
    table.after(pager);
    return () => {
      previous.removeEventListener("click", goPrevious);
      next.removeEventListener("click", goNext);
      pager.remove();
    };
  }, [page, totalProducts]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openProduct(current = null) {
    setProduct(current);
    setForm(
      current
        ? {
            ...current,
            marca_id: current.marca_id || current.marca?.id || "",
            codigointerno: current.codigointerno || current.codigo || "",
            codigo: current.codigointerno || current.codigo || "",
            precio: String(current.precio),
            cantidad: String(current.cantidad),
            imagen_url: current.imagen_url ?? "",
          }
        : {
            ...blankProduct,
            marca_id:
              brands.find((brand) => brand.activo)?.id ?? (brands[0]?.id || ""),
          },
    );
    setError("");
  }

  function attachImage(event) {
    const [file] = event.target.files;
    if (!file) return;
    if (file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name)) {
      setError("Adjunta solo una imagen JPG.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen JPG no puede superar 5 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setField("imagen_url", String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  }

  async function saveProduct(event) {
    event.preventDefault();
    const payload = {
      ...form,
      nombre: form.nombre.trim().toUpperCase(),
      precio: Number(form.precio),
      cantidad: Number(form.cantidad),
      imagen_url: form.imagen_url || null,
    };
    if (!product) {
      delete payload.codigointerno;
      delete payload.codigo;
    }
    if (!payload.marca_id) {
      setError("Selecciona una marca.");
      return;
    }
    setSaving(true);
    try {
      if (product) {
        await api.put(`/productos/${product.id}`, payload);
        setNotice("Producto actualizado correctamente.");
      } else {
        await api.post("/productos", payload);
        setNotice("Producto agregado correctamente.");
      }
      setProduct(null);
      setForm(blankProduct);
      setError("");
      await loadProducts();
    } catch {
      setError(
        "No fue posible guardar el producto. Revisa sus datos.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <div className="topbar-title">
          <p className="eyebrow mb-1">CATALOGO</p>
          <h1>Productos</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-date d-none d-sm-inline">
            Gestión de Productos
          </span>
          <button className="btn btn-primary" onClick={() => openProduct()}>
            <Plus size={18} />
            Nuevo producto
          </button>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-summary">
          <div>
            <p className="eyebrow">INVENTARIO</p>
            <h2>Controla tus Productos</h2>
            <p>
              Gestiona precios, disponibilidad y stock para los pedidos de
              clientes.
            </p>
          </div>
          <div className="summary-metric">
            <span>{products.length}</span>
            <small>Productos registrados</small>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Listado de productos</h2>
              <p>Productos activos e inactivos del catálogo.</p>
            </div>
            <span className="panel-count">{products.length} registros</span>
          </div>
          {notice && (
            <div className="alert alert-success alert-dismissible fade show mt-3 category-notice">
              <CheckCircle2 size={18} />
              {notice}
              <button
                className="btn-close"
                type="button"
                onClick={() => setNotice("")}
              />
            </div>
          )}
          {error && <div className="alert alert-danger mt-3">{error}</div>}
          {loading ? (
            <p className="mt-4 text-secondary">Cargando productos...</p>
          ) : (
            <div className="product-table mt-4">
              <div className="product-table-head">
                <span>Producto</span>
                <span className="d-none d-md-block">Marca</span>
                <span>Precio</span>
                <span>Stock</span>
                <span>Tributación</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {products.map((item) => (
                <div className="product-row" key={item.id}>
                  <div className="product-name">
                    <span className="product-thumb">
                      {imageSource(item.imagen_url) ? (
                        <img src={imageSource(item.imagen_url)} alt="" />
                      ) : (
                        <Package size={18} />
                      )}
                    </span>
                    <div>
                      <strong>{item.nombre}</strong>
                      <small>#{item.codigointerno || item.codigo}</small>
                    </div>
                  </div>
                  <span className="d-none d-md-block product-category">
                    {item.marca?.nombre || brandName(item.marca_id)}
                  </span>
                  <strong>{money.format(item.precio)}</strong>
                  <span>{Number(item.cantidad)}</span>
                  <span className={item.afecto ? "tax-status tax-status-taxable" : "tax-status tax-status-exempt"}>
                    {item.afecto ? "Afecto" : "Exento"}
                  </span>
                  <span
                    className={
                      item.activo ? "status-active" : "status-inactive"
                    }
                  >
                    {item.activo ? "Activo" : "Inactivo"}
                  </span>
                  <button
                    className="icon-button category-edit"
                    onClick={() => openProduct(item)}
                    aria-label={`Editar ${item.nombre}`}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {(product || form.marca_id) && (
        <div className="modal-backdrop-custom">
          <form className="category-modal product-modal" onSubmit={saveProduct}>
            <header>
              <div>
                <p className="eyebrow">CATALOGO</p>
                <h2>{product ? "Editar producto" : "Nuevo producto"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setProduct(null);
                  setForm(blankProduct);
                }}
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              <div className="product-form-grid">
                <div className="product-form-wide">
                  <label
                    className="form-label"
                    htmlFor="product-brand-select"
                  >
                    Marca
                  </label>
                  <select
                    id="product-brand-select"
                    className="form-select"
                    value={form.marca_id}
                    onChange={(event) =>
                      setField("marca_id", event.target.value)
                    }
                    required
                  >
                    <option value="">Selecciona una marca</option>
                    {brands
                      .filter(
                        (brand) =>
                          brand.activo || brand.id === form.marca_id,
                      )
                      .map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.nombre} {brand.categoria?.nombre ? `(${brand.categoria.nombre})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="product-code-base64">
                    Código Interno
                  </label>
                  <input
                    id="product-code-base64"
                    className="form-control"
                    value={
                      product
                        ? (form.codigointerno || form.codigo || "")
                        : "Automático (desde 100)"
                    }
                    disabled
                    readOnly
                  />
                  <small className="form-text text-muted">
                    {product
                      ? "Correlativo asignado automáticamente"
                      : "Correlativo asignado desde 100"}
                  </small>
                </div>
                <div>
                  <label className="form-label" htmlFor="product-stock-base64">
                    Stock
                  </label>
                  <input
                    id="product-stock-base64"
                    className="form-control"
                    type="number"
                    step="0.5"
                    value={form.cantidad}
                    onChange={(event) =>
                      setField("cantidad", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="product-form-wide">
                  <label className="form-label" htmlFor="product-name-base64">
                    Nombre
                  </label>
                  <input
                    id="product-name-base64"
                    className="form-control"
                    value={form.nombre}
                    onChange={(event) =>
                      setField("nombre", event.target.value.toUpperCase())
                    }
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="product-price-base64">
                    Precio base
                  </label>
                  <input
                    id="product-price-base64"
                    className="form-control"
                    type="number"
                    min="1"
                    value={form.precio}
                    onChange={(event) => setField("precio", event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="product-tax-status">
                    Condición tributaria
                  </label>
                  <select
                    id="product-tax-status"
                    className="form-select"
                    value={form.afecto ? "afecto" : "exento"}
                    onChange={(event) =>
                      setField("afecto", event.target.value === "afecto")
                    }
                  >
                    <option value="afecto">Afecto</option>
                    <option value="exento">Exento</option>
                  </select>
                </div>
                <div className="product-form-wide">
                  <label className="form-label" htmlFor="product-image-base64">
                    Imagen JPG
                  </label>
                  <input
                    id="product-image-base64"
                    className="form-control"
                    type="file"
                    accept=".jpg,.jpeg,image/jpeg"
                    onChange={attachImage}
                  />
                  <small className="form-text">
                    Solo JPG, máximo 5 MB. Se guarda en Base64.
                  </small>
                </div>
              </div>
              {imageSource(form.imagen_url) && (
                <div className="image-preview">
                  <img src={imageSource(form.imagen_url)} alt="Vista previa" />
                  <button
                    className="btn btn-link btn-sm"
                    type="button"
                    onClick={() => setField("imagen_url", "")}
                  >
                    Quitar imagen
                  </button>
                </div>
              )}
              <div className="status-toggle">
                <div>
                  <strong>Producto disponible</strong>
                  <small>
                    Los productos inactivos no aparecen a los clientes.
                  </small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(event) =>
                      setField("activo", event.target.checked)
                    }
                  />
                  <span />
                </label>
              </div>
            </div>
            <footer>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  setProduct(null);
                  setForm(blankProduct);
                }}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save size={17} />
                    Guardar producto
                  </>
                )}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function UserManager() {
  const blankUser = {
    nombre: "",
    correo: "",
    password: "",
    rol_id: "",
    activo: true,
  };
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(blankUser);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      const [{ data: userData }, { data: roleData }] = await Promise.all([
        api.get("/usuarios"),
        api.get("/roles"),
      ]);
      setUsers(userData);
      setRoles(roleData);
    } catch {
      setError("No fue posible cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openUser(current = null) {
    setUser(current);
    setForm(
      current
        ? {
            nombre: current.nombre,
            correo: current.correo,
            password: "",
            rol_id: current.rol_id,
            activo: current.activo,
          }
        : { ...blankUser, rol_id: roles[0]?.id ?? "" },
    );
    setError("");
  }

  async function saveUser(event) {
    event.preventDefault();
    if (!user && form.password.length < 8) {
      setError("La clave debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      nombre: form.nombre.trim(),
      correo: form.correo.trim(),
    };
    if (user && !payload.password) delete payload.password;
    try {
      if (user) {
        await api.put(`/usuarios/${user.id}`, payload);
        setNotice("Usuario actualizado correctamente.");
      } else {
        await api.post("/usuarios", payload);
        setNotice("Usuario agregado correctamente.");
      }
      setUser(null);
      setForm(blankUser);
      setError("");
      await loadUsers();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ??
          "No fue posible guardar el usuario. Revisa el correo y los datos ingresados.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <div className="topbar-title">
          <p className="eyebrow mb-1">CONFIGURACION</p>
          <h1>Usuarios</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-date d-none d-sm-inline">
            Gestión de usuarios
          </span>
          <button className="btn btn-primary" onClick={() => openUser()}>
            <Plus size={18} />
            Nuevo usuario
          </button>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-summary">
          <div>
            <p className="eyebrow">ACCESOS</p>
            <h2>Administra tus usuarios</h2>
            <p>Controla los accesos, roles y estado de cada cuenta.</p>
          </div>
          <div className="summary-metric">
            <span>{users.length}</span>
            <small>Usuarios registrados</small>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Listado de usuarios</h2>
              <p>Usuarios activos e inactivos de la plataforma.</p>
            </div>
            <span className="panel-count">{users.length} registros</span>
          </div>
          {notice && (
            <div className="alert alert-success alert-dismissible fade show mt-3 category-notice">
              <CheckCircle2 size={18} />
              {notice}
              <button
                className="btn-close"
                type="button"
                onClick={() => setNotice("")}
              />
            </div>
          )}
          {error && <div className="alert alert-danger mt-3">{error}</div>}
          {loading ? (
            <p className="mt-4 text-secondary">Cargando usuarios...</p>
          ) : (
            <div className="user-table mt-4">
              <div className="user-table-head">
                <span>Usuario</span>
                <span>Rol</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {users.length ? (
                users.map((item) => (
                  <div className="user-row" key={item.id}>
                    <div className="user-name">
                      <span className="user-avatar">
                        {item.nombre.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{item.nombre}</strong>
                        <small>{item.correo}</small>
                      </div>
                    </div>
                    <span className="user-role">{item.rol.nombre}</span>
                    <span
                      className={
                        item.activo ? "status-active" : "status-inactive"
                      }
                    >
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                    <button
                      className="icon-button category-edit"
                      onClick={() => openUser(item)}
                      aria-label={`Editar ${item.nombre}`}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-secondary p-4 mb-0">
                  Aún no hay usuarios registrados.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      {(user || form.rol_id) && (
        <div className="modal-backdrop-custom">
          <form className="category-modal" onSubmit={saveUser}>
            <header>
              <div>
                <p className="eyebrow">CONFIGURACION</p>
                <h2>{user ? "Editar usuario" : "Nuevo usuario"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setUser(null);
                  setForm(blankUser);
                }}
                aria-label="Cerrar formulario"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              <label className="form-label" htmlFor="user-name">
                Nombre
              </label>
              <input
                id="user-name"
                className="form-control"
                value={form.nombre}
                onChange={(event) => setField("nombre", event.target.value)}
                maxLength="150"
                required
                autoFocus
              />
              <label className="form-label mt-3" htmlFor="user-email">
                Correo
              </label>
              <input
                id="user-email"
                className="form-control"
                type="email"
                value={form.correo}
                onChange={(event) => setField("correo", event.target.value)}
                required
              />
              <label className="form-label mt-3" htmlFor="user-password">
                {user ? "Nueva clave" : "Clave"}
              </label>
              <input
                id="user-password"
                className="form-control"
                type="password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                minLength="8"
                required={!user}
              />
              {user && (
                <small className="form-text">
                  Déjala vacía para mantener la clave actual.
                </small>
              )}
              <label className="form-label mt-3" htmlFor="user-role">
                Rol
              </label>
              <select
                id="user-role"
                className="form-select"
                value={form.rol_id}
                onChange={(event) => setField("rol_id", event.target.value)}
                required
              >
                <option value="">Selecciona un rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nombre}
                  </option>
                ))}
              </select>
              <div className="status-toggle">
                <div>
                  <strong>Usuario activo</strong>
                  <small>
                    Los usuarios inactivos no pueden iniciar sesión.
                  </small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(event) =>
                      setField("activo", event.target.checked)
                    }
                  />
                  <span />
                </label>
              </div>
            </div>
            <footer>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  setUser(null);
                  setForm(blankUser);
                }}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save size={17} />
                    Guardar usuario
                  </>
                )}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}



function CustomerManager() {
  const blankCustomer = { rut: "", nombre: "", celular: "", correo: "", porcentaje: "0", porcentaje_id: "", con_decimal: false, activo: true };
  const blankAddress = { direccion: "", comuna: "", principal: false, activo: true };
  const [customers, setCustomers] = useState([]);
  const [percentages, setPercentages] = useState([]);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addressCustomer, setAddressCustomer] = useState(null);
  const [form, setForm] = useState(blankCustomer);
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [addressNotice, setAddressNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadCustomers() {
    try {
      const [customersRes, percentagesRes] = await Promise.all([
        api.get("/clientes"),
        api.get("/porcentajes"),
      ]);
      setCustomers(customersRes.data);
      setPercentages(percentagesRes.data);
      return customersRes.data;
    } catch {
      setError("No fue posible cargar los datos.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCustomers(); }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCustomer(customer = null) {
    setSelectedCustomer(customer);
    let initialPorcentajeId = "";
    if (customer) {
      if (customer.porcentaje_id) {
        initialPorcentajeId = customer.porcentaje_id;
      } else {
        const match = percentages.find((p) => Number(p.valor) === Number(customer.porcentaje));
        if (match) initialPorcentajeId = match.id;
      }
    }
    setForm(
      customer
        ? {
            rut: customer.rut ?? "",
            nombre: customer.nombre ?? "",
            celular: customer.celular ?? "",
            correo: customer.correo ?? "",
            porcentaje: String(customer.porcentaje),
            porcentaje_id: initialPorcentajeId,
            con_decimal: Boolean(customer.con_decimal),
            activo: customer.activo,
          }
        : blankCustomer
    );
    setError("");
    setCustomerFormOpen(true);
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (![form.rut, form.nombre, form.celular].some((value) => value.trim())) {
      setError("Indica al menos RUT, nombre o celular.");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      rut: form.rut.trim() || null,
      nombre: form.nombre.trim() || null,
      celular: form.celular.trim() || null,
      correo: form.correo.trim() || null,
      porcentaje: Number(form.porcentaje),
      porcentaje_id: form.porcentaje_id || null,
      con_decimal: Boolean(form.con_decimal),
    };
    try {
      if (selectedCustomer) await api.put(`/clientes/${selectedCustomer.id}`, payload);
      else await api.post("/clientes", payload);
      setNotice(selectedCustomer ? "Cliente actualizado correctamente." : "Cliente agregado correctamente.");
      setCustomerFormOpen(false);
      setSelectedCustomer(null);
      setForm(blankCustomer);
      setError("");
      await loadCustomers();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  function openAddresses(customer) {
    setAddressCustomer(customer);
    setAddressForm(blankAddress);
    setAddressNotice("");
    setError("");
  }

  async function refreshAddressCustomer() {
    const data = await loadCustomers();
    setAddressCustomer(data.find((item) => item.id === addressCustomer.id) ?? null);
  }

  async function saveAddress(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/clientes/${addressCustomer.id}/direcciones`, addressForm);
      setAddressForm(blankAddress);
      setAddressNotice("Dirección agregada correctamente.");
      setNotice("Dirección agregada correctamente.");
      setError("");
      await refreshAddressCustomer();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible agregar la dirección.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAddress(address, updates) {
    setSaving(true);
    try {
      await api.put(`/clientes/${addressCustomer.id}/direcciones/${address.id}`, { ...address, ...updates });
      setError("");
      await refreshAddressCustomer();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible actualizar la dirección.");
    } finally {
      setSaving(false);
    }
  }

  return <><header className="admin-topbar"><div className="topbar-title"><p className="eyebrow mb-1">CONFIGURACION</p><h1>Clientes</h1></div><div className="topbar-actions"><span className="topbar-date d-none d-sm-inline">Gestión de clientes</span><button className="btn btn-primary" onClick={() => openCustomer()}><Plus size={18} />Nuevo cliente</button></div></header><div className="admin-content"><section className="admin-summary"><div><p className="eyebrow">CLIENTES</p><h2>Administra tus clientes</h2><p>Gestiona sus datos, descuento y direcciones de despacho.</p></div><div className="summary-metric"><span>{customers.length}</span><small>Clientes registrados</small></div></section><section className="content-panel"><div className="panel-heading"><div><h2>Listado de clientes</h2><p>Clientes activos e inactivos registrados en la plataforma.</p></div><span className="panel-count">{customers.length} registros</span></div>{notice && <div className="alert alert-success alert-dismissible fade show mt-3 category-notice"><CheckCircle2 size={18} />{notice}<button className="btn-close" type="button" onClick={() => setNotice("")} /></div>}{error && !customerFormOpen && !addressCustomer && <div className="alert alert-danger mt-3">{error}</div>}{loading ? <p className="mt-4 text-secondary">Cargando clientes...</p> : <div className="customer-table mt-4"><div className="customer-table-head"><span>RUT</span><span>Nombre</span><span>Celular</span><span className="customer-email">Correo</span><span>%</span><span>Decimal</span><span>Activo</span><span>Acciones</span></div>{customers.length ? customers.map((customer) => <div className="customer-row" key={customer.id}><span>{customer.rut || "-"}</span><strong>{customer.nombre || "-"}</strong><span>{customer.celular || "-"}</span><span className="customer-email">{customer.correo || "-"}</span><span>{customer.porcentaje_rel?.nombre || `${Number(customer.porcentaje)}%`}</span><span>{customer.con_decimal ? "Sí" : "No"}</span><span className={customer.activo ? "status-active" : "status-inactive"}>{customer.activo ? "Activo" : "Inactivo"}</span><div className="customer-actions"><button className="icon-button category-edit" type="button" onClick={() => openAddresses(customer)} aria-label="Gestionar direcciones"><MapPin size={16} /></button><button className="icon-button category-edit" type="button" onClick={() => openCustomer(customer)} aria-label="Editar cliente"><Pencil size={16} /></button></div></div>) : <p className="text-secondary p-4 mb-0">Aún no hay clientes registrados.</p>}</div>}</section></div>{customerFormOpen && <div className="modal-backdrop-custom"><form className="category-modal product-modal" onSubmit={saveCustomer}><header><div><p className="eyebrow">CONFIGURACION</p><h2>{selectedCustomer ? "Editar cliente" : "Nuevo cliente"}</h2></div><button type="button" className="icon-button" onClick={() => { setCustomerFormOpen(false); setSelectedCustomer(null); setForm(blankCustomer); }} aria-label="Cerrar formulario"><X size={19} /></button></header><div className="modal-body-custom">{error && <div className="alert alert-danger mb-3">{error}</div>}<p className="form-text mt-0">Completa al menos uno: RUT, nombre o celular.</p><div className="product-form-grid"><div><label className="form-label" htmlFor="customer-rut-new">RUT</label><input id="customer-rut-new" className="form-control" value={form.rut} onChange={(event) => setField("rut", event.target.value)} /></div><div><label className="form-label" htmlFor="customer-name-new">Nombre</label><input id="customer-name-new" className="form-control" value={form.nombre} onChange={(event) => setField("nombre", event.target.value)} /></div><div><label className="form-label" htmlFor="customer-phone-new">Celular</label><input id="customer-phone-new" className="form-control" value={form.celular} onChange={(event) => setField("celular", event.target.value)} /></div><div><label className="form-label" htmlFor="customer-email-new">Correo</label><input id="customer-email-new" className="form-control" type="email" value={form.correo} onChange={(event) => setField("correo", event.target.value)} /></div><div><label className="form-label" htmlFor="customer-percentage-new">Porcentaje</label><select id="customer-percentage-new" className="form-select" value={form.porcentaje_id || ""} onChange={(event) => { const selectedId = event.target.value; const pct = percentages.find((p) => p.id === selectedId); setField("porcentaje_id", selectedId); setField("porcentaje", pct ? String(pct.valor) : "0"); }} required><option value="">Selecciona un porcentaje</option>{percentages.filter((p) => p.activo || p.id === form.porcentaje_id).map((p) => <option key={p.id} value={p.id}>{p.nombre || `${Number(p.valor)}%`}</option>)}</select></div></div><div className="status-toggle"><div><strong>Permitir decimales (½ unidad)</strong><small>Habilita el botón de media unidad en el portal de pedidos.</small></div><label className="switch"><input type="checkbox" checked={form.con_decimal} onChange={(event) => setField("con_decimal", event.target.checked)} /><span /></label></div><div className="status-toggle"><div><strong>Cliente activo</strong><small>Los clientes inactivos no pueden acceder al portal.</small></div><label className="switch"><input type="checkbox" checked={form.activo} onChange={(event) => setField("activo", event.target.checked)} /><span /></label></div></div><footer><button className="btn btn-light" type="button" onClick={() => { setCustomerFormOpen(false); setSelectedCustomer(null); setForm(blankCustomer); }}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : <><Save size={17} />Guardar cliente</>}</button></footer></form></div>}{addressCustomer && <div className="modal-backdrop-custom"><form className="category-modal product-modal" onSubmit={saveAddress}><header><div><p className="eyebrow">DIRECCIONES</p><h2>{addressCustomer.nombre || addressCustomer.rut || "Cliente"}</h2></div><button type="button" className="icon-button" onClick={() => setAddressCustomer(null)} aria-label="Cerrar direcciones"><X size={19} /></button></header><div className="modal-body-custom">{error && <div className="alert alert-danger mb-3">{error}</div>}<div className="address-table"><div className="address-table-head"><span>Dirección</span><span>Comuna</span><span>Principal</span><span>Activo</span></div>{addressCustomer.direcciones?.map((address) => <div className="address-row" key={address.id}><span>{address.direccion}</span><span>{address.comuna || "-"}</span><label className="switch"><input type="checkbox" checked={address.principal} disabled={saving} onChange={(event) => updateAddress(address, { principal: event.target.checked })} /><span /></label><label className="switch"><input type="checkbox" checked={address.activo} disabled={saving || address.principal} onChange={(event) => updateAddress(address, { activo: event.target.checked })} /><span /></label></div>)}{!addressCustomer.direcciones?.length && <p className="text-secondary py-3 mb-0">Aún no hay direcciones.</p>}</div><div className="address-form"><div><label className="form-label" htmlFor="new-address">Dirección</label><input id="new-address" className="form-control" value={addressForm.direccion} onChange={(event) => setAddressForm((current) => ({ ...current, direccion: event.target.value }))} required /></div><div><label className="form-label" htmlFor="new-district">Comuna</label><input id="new-district" className="form-control" value={addressForm.comuna} onChange={(event) => setAddressForm((current) => ({ ...current, comuna: event.target.value }))} /></div><label className="switch address-principal"><input type="checkbox" checked={addressForm.principal} onChange={(event) => setAddressForm((current) => ({ ...current, principal: event.target.checked }))} /><span /></label><label className="switch address-active"><input type="checkbox" checked={addressForm.activo} onChange={(event) => setAddressForm((current) => ({ ...current, activo: event.target.checked }))} /><span /></label></div></div><footer><button className="btn btn-light" type="button" onClick={() => setAddressCustomer(null)}>Cerrar</button><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : <><Plus size={17} />Agregar dirección</>}</button></footer></form></div>}</>;
}

function PercentageManager() {
  const blankPercentage = { valor: "", nombre: "", activo: true };
  const [percentages, setPercentages] = useState([]);
  const [percentageFormOpen, setPercentageFormOpen] = useState(false);
  const [selectedPercentage, setSelectedPercentage] = useState(null);
  const [form, setForm] = useState(blankPercentage);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadPercentages() {
    try {
      const { data } = await api.get("/porcentajes");
      setPercentages(data);
      return data;
    } catch {
      setError("No fue posible cargar los porcentajes.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPercentages(); }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openPercentage(percentage = null) {
    setSelectedPercentage(percentage);
    setForm(
      percentage
        ? {
            valor: String(percentage.valor),
            nombre: percentage.nombre ?? "",
            activo: percentage.activo,
          }
        : blankPercentage
    );
    setError("");
    setPercentageFormOpen(true);
  }

  async function savePercentage(event) {
    event.preventDefault();
    if (form.valor === "" || Number.isNaN(Number(form.valor))) {
      setError("Indica un valor numérico para el porcentaje.");
      return;
    }
    const numVal = Number(form.valor);
    if (numVal < 0 || numVal > 100) {
      setError("El porcentaje debe estar entre 0 y 100.");
      return;
    }
    setSaving(true);
    const payload = {
      valor: numVal,
      nombre: form.nombre.trim() || `${numVal}%`,
      activo: Boolean(form.activo),
    };
    try {
      if (selectedPercentage) {
        await api.put(`/porcentajes/${selectedPercentage.id}`, payload);
      } else {
        await api.post("/porcentajes", payload);
      }
      setNotice(selectedPercentage ? "Porcentaje actualizado correctamente." : "Porcentaje agregado correctamente.");
      setPercentageFormOpen(false);
      setSelectedPercentage(null);
      setForm(blankPercentage);
      setError("");
      await loadPercentages();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible guardar el porcentaje.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(percentage) {
    setSaving(true);
    try {
      await api.put(`/porcentajes/${percentage.id}`, {
        valor: percentage.valor,
        nombre: percentage.nombre,
        activo: !percentage.activo,
      });
      setNotice(`Porcentaje ${!percentage.activo ? "activado" : "deshabilitado"} correctamente.`);
      await loadPercentages();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible cambiar el estado del porcentaje.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <div className="topbar-title">
          <p className="eyebrow mb-1">CONFIGURACION</p>
          <h1>Porcentajes</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-date d-none d-sm-inline">Gestión de porcentajes</span>
          <button className="btn btn-primary" onClick={() => openPercentage()}>
            <Plus size={18} />
            Nuevo porcentaje
          </button>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-summary">
          <div>
            <p className="eyebrow">DESCUENTOS / MARGEN</p>
            <h2>Administra tus porcentajes</h2>
            <p>Configura los porcentajes disponibles para asignar a los clientes.</p>
          </div>
          <div className="summary-metric">
            <span>{percentages.length}</span>
            <small>Porcentajes registrados</small>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Listado de porcentajes</h2>
              <p>Porcentajes activos y deshabilitados para selección en clientes.</p>
            </div>
            <span className="panel-count">{percentages.length} registros</span>
          </div>
          {notice && (
            <div className="alert alert-success alert-dismissible fade show mt-3 category-notice">
              <CheckCircle2 size={18} />
              {notice}
              <button className="btn-close" type="button" onClick={() => setNotice("")} />
            </div>
          )}
          {error && !percentageFormOpen && <div className="alert alert-danger mt-3">{error}</div>}
          {loading ? (
            <p className="mt-4 text-secondary">Cargando porcentajes...</p>
          ) : (
            <div className="percentage-table mt-4">
              <div className="percentage-table-head">
                <span>Valor</span>
                <span>Nombre / Etiqueta</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {percentages.length ? (
                percentages.map((item) => (
                  <div className="percentage-row" key={item.id}>
                    <strong>{Number(item.valor)}%</strong>
                    <span>{item.nombre || `${Number(item.valor)}%`}</span>
                    <label className="switch" title={item.activo ? "Deshabilitar" : "Habilitar"}>
                      <input
                        type="checkbox"
                        checked={item.activo}
                        disabled={saving}
                        onChange={() => toggleActive(item)}
                      />
                      <span />
                    </label>
                    <button
                      className="icon-button category-edit"
                      onClick={() => openPercentage(item)}
                      aria-label={`Editar ${item.nombre || item.valor}`}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-secondary p-4 mb-0">Aún no hay porcentajes registrados.</p>
              )}
            </div>
          )}
        </section>
      </div>
      {percentageFormOpen && (
        <div className="modal-backdrop-custom">
          <form className="category-modal" onSubmit={savePercentage}>
            <header>
              <div>
                <p className="eyebrow">CONFIGURACION</p>
                <h2>{selectedPercentage ? "Editar porcentaje" : "Nuevo porcentaje"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setPercentageFormOpen(false);
                  setSelectedPercentage(null);
                  setForm(blankPercentage);
                }}
                aria-label="Cerrar formulario"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              {error && <div className="alert alert-danger mb-3">{error}</div>}
              <div className="product-form-grid">
                <div>
                  <label className="form-label" htmlFor="percentage-valor">Valor (%)</label>
                  <input
                    id="percentage-valor"
                    className="form-control"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.valor}
                    onChange={(event) => setField("valor", event.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="percentage-nombre">Nombre / Etiqueta (opcional)</label>
                  <input
                    id="percentage-nombre"
                    className="form-control"
                    placeholder="Ej: 2% o Descuento Especial"
                    value={form.nombre}
                    onChange={(event) => setField("nombre", event.target.value)}
                  />
                </div>
              </div>
              <div className="status-toggle mt-3">
                <div>
                  <strong>Porcentaje activo</strong>
                  <small>Solo los porcentajes activos aparecen en el combobox de clientes.</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(event) => setField("activo", event.target.checked)}
                  />
                  <span />
                </label>
              </div>
            </div>
            <footer>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  setPercentageFormOpen(false);
                  setSelectedPercentage(null);
                  setForm(blankPercentage);
                }}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : <><Save size={17} />Guardar porcentaje</>}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function ExternalCodeManager() {
  const blankForm = { codigo_externo: "", producto_id: "", porcentaje_id: "", activo: true };
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [percentages, setPercentages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [codesRes, prodsRes, pctsRes] = await Promise.all([
        api.get("/codigos-externos"),
        api.get("/productos/selector"),
        api.get("/porcentajes"),
      ]);
      setItems(codesRes.data);
      setProducts(prodsRes.data);
      setPercentages(pctsRes.data);
      return codesRes.data;
    } catch {
      setError("No fue posible cargar los códigos externos.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setSelectedItem(null);
    setForm(blankForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(item) {
    setSelectedItem(item);
    setForm({
      codigo_externo: String(item.codigo_externo),
      producto_id: item.producto_id,
      porcentaje_id: item.porcentaje_id,
      activo: item.activo,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!form.codigo_externo || Number.isNaN(Number(form.codigo_externo)) || Number(form.codigo_externo) <= 0) {
      setError("Indica un código externo numérico entero positivo.");
      return;
    }
    if (!form.producto_id) {
      setError("Selecciona un producto.");
      return;
    }
    if (!form.porcentaje_id) {
      setError("Selecciona un porcentaje.");
      return;
    }
    setSaving(true);
    const payload = {
      codigo_externo: parseInt(form.codigo_externo, 10),
      producto_id: form.producto_id,
      porcentaje_id: form.porcentaje_id,
      activo: Boolean(form.activo),
    };
    try {
      if (selectedItem) {
        await api.put(`/codigos-externos/${selectedItem.id}`, payload);
      } else {
        await api.post("/codigos-externos", payload);
      }
      setNotice(selectedItem ? "Código externo modificado correctamente." : "Código externo creado correctamente.");
      setModalOpen(false);
      setSelectedItem(null);
      setForm(blankForm);
      setError("");
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible guardar el código externo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setSaving(true);
    try {
      await api.put(`/codigos-externos/${item.id}`, {
        codigo_externo: item.codigo_externo,
        producto_id: item.producto_id,
        porcentaje_id: item.porcentaje_id,
        activo: !item.activo,
      });
      setNotice(`Código externo ${!item.activo ? "activado" : "desactivado"} correctamente.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible cambiar el estado del código externo.");
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const codeMatch = String(item.codigo_externo).includes(term);
    const prodNameMatch = item.producto?.nombre?.toLowerCase().includes(term);
    const prodCodeMatch = (item.producto?.codigointerno || item.producto?.codigo || "")
      .toLowerCase()
      .includes(term);
    return codeMatch || prodNameMatch || prodCodeMatch;
  });

  return (
    <>
      <header className="admin-topbar">
        <div className="topbar-title">
          <p className="eyebrow mb-1">CONFIGURACION</p>
          <h1>Código Externo</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-date d-none d-sm-inline">Gestión de códigos externos</span>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} />
            Nuevo código externo
          </button>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-summary">
          <div>
            <p className="eyebrow">INTEGRACION / CATALOGO</p>
            <h2>Administra los códigos externos</h2>
            <p>Asocia códigos numéricos externos a cada combinación de producto y porcentaje.</p>
          </div>
          <div className="summary-metric">
            <span>{items.length}</span>
            <small>Códigos registrados</small>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Listado de códigos externos</h2>
              <p>Códigos asociados a productos y porcentajes para integración externa.</p>
            </div>
            <span className="panel-count">{filteredItems.length} de {items.length} registros</span>
          </div>
          <div className="mt-3">
            <div className="search-field" style={{ maxWidth: "340px" }}>
              <Search size={18} />
              <input
                className="form-control"
                placeholder="Buscar por código o producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {notice && (
            <div className="alert alert-success alert-dismissible fade show mt-3 category-notice">
              <CheckCircle2 size={18} />
              {notice}
              <button className="btn-close" type="button" onClick={() => setNotice("")} />
            </div>
          )}
          {error && !modalOpen && <div className="alert alert-danger mt-3">{error}</div>}
          {loading ? (
            <p className="mt-4 text-secondary">Cargando códigos externos...</p>
          ) : (
            <div className="external-code-table mt-4">
              <div className="external-code-table-head">
                <span>Cód. Externo</span>
                <span>Producto</span>
                <span>Porcentaje</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <div className="external-code-row" key={item.id}>
                    <strong>#{item.codigo_externo}</strong>
                    <div>
                      <strong>{item.producto?.nombre || "Producto desconocido"}</strong>
                      <small className="text-secondary d-block">#{item.producto?.codigointerno || item.producto?.codigo || ""}</small>
                    </div>
                    <span>{item.porcentaje?.nombre || (item.porcentaje ? `${Number(item.porcentaje.valor)}%` : "-")}</span>
                    <label className="switch" title={item.activo ? "Desactivar" : "Activar"}>
                      <input
                        type="checkbox"
                        checked={item.activo}
                        disabled={saving}
                        onChange={() => toggleActive(item)}
                      />
                      <span />
                    </label>
                    <button
                      className="icon-button category-edit"
                      onClick={() => openEdit(item)}
                      aria-label={`Editar código externo ${item.codigo_externo}`}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-secondary p-4 mb-0">
                  {items.length ? "No se encontraron coincidencias para la búsqueda." : "Aún no hay códigos externos registrados."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      {modalOpen && (
        <div className="modal-backdrop-custom">
          <form className="category-modal" onSubmit={saveItem}>
            <header>
              <div>
                <p className="eyebrow">CONFIGURACION</p>
                <h2>{selectedItem ? "Modificar código externo" : "Nuevo código externo"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedItem(null);
                  setForm(blankForm);
                }}
                aria-label="Cerrar formulario"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              {error && <div className="alert alert-danger mb-3">{error}</div>}
              <div className="product-form-grid">
                <div>
                  <label className="form-label" htmlFor="external-code-val">Código Externo</label>
                  <input
                    id="external-code-val"
                    className="form-control"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ej: 1001"
                    value={form.codigo_externo}
                    onChange={(event) => setField("codigo_externo", event.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="external-code-pct">Porcentaje</label>
                  <select
                    id="external-code-pct"
                    className="form-select"
                    value={form.porcentaje_id}
                    onChange={(event) => setField("porcentaje_id", event.target.value)}
                    required
                  >
                    <option value="">Selecciona un porcentaje</option>
                    {percentages
                      .filter((p) => p.activo || p.id === form.porcentaje_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre || `${Number(p.valor)}%`}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="product-form-wide">
                  <label className="form-label" htmlFor="external-code-prod">Producto</label>
                  <select
                    id="external-code-prod"
                    className="form-select"
                    value={form.producto_id}
                    onChange={(event) => setField("producto_id", event.target.value)}
                    required
                  >
                    <option value="">Selecciona un producto</option>
                    {products
                      .filter((prod) => prod.activo || prod.id === form.producto_id)
                      .map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          #{prod.codigointerno || prod.codigo} - {prod.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="status-toggle mt-3">
                <div>
                  <strong>Código externo activo</strong>
                  <small>Desactiva para inhabilitar temporalmente este código externo.</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(event) => setField("activo", event.target.checked)}
                  />
                  <span />
                </label>
              </div>
            </div>
            <footer>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedItem(null);
                  setForm(blankForm);
                }}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : <><Save size={17} />{selectedItem ? "Guardar cambios" : "Crear código externo"}</>}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function AdminOrderManager() {
  const [orders, setOrders] = useState([]);
  const [states, setStates] = useState([]);
  const [filters, setFilters] = useState({ estado: "Pedido", codigo: "", cliente: "", desde: "", hasta: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingState, setUpdatingState] = useState(false);
  const [deliveryPayment, setDeliveryPayment] = useState(null);
  const [creditDays, setCreditDays] = useState("");
  const [creditOrder, setCreditOrder] = useState(null);
  const [selectedOrdersForPdf, setSelectedOrdersForPdf] = useState(new Set());

  async function loadOrders() {
    try {
      const [{ data: ordersData }, { data: statesData }] = await Promise.all([api.get("/pedidos"), api.get("/estados")]);
      setOrders(ordersData);
      setStates(statesData);
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  function availableTransitions(order) {
    const transitions = { Pedido: ["Despachado", "Cancelado"], Despachado: ["Entregado", "Cancelado"] };
    return transitions[order.estado.nombre] ?? [];
  }

  async function changeOrderStatus() {
    if (!confirmation) return;
    const nextState = states.find((state) => state.nombre === confirmation.nextState);
    if (!nextState) {
      setError("No fue posible identificar el estado seleccionado.");
      setConfirmation(null);
      return;
    }
    if (confirmation.nextState === "Entregado" && deliveryPayment === null) {
      setError("Indica si el cliente pagó el pedido.");
      return;
    }
    if (confirmation.nextState === "Entregado" && !deliveryPayment && (!Number.isInteger(Number(creditDays)) || Number(creditDays) < 1 || Number(creditDays) > 365)) {
      setError("Indica una cantidad válida de días de crédito entre 1 y 365.");
      return;
    }
    setUpdatingState(true);
    try {
      const payload = { estado_id: nextState.id };
      if (confirmation.nextState === "Entregado") {
        payload.pagado = deliveryPayment;
        if (!deliveryPayment) payload.dias_credito = Number(creditDays);
      }
      const { data } = await api.patch(`/pedidos/${confirmation.order.id}/estado`, payload);
      setOrders((current) => current.map((order) => order.id === data.id ? data : order));
      setSelectedOrder(data);
      setNotice(`Pedido ${data.id.slice(0, 8).toUpperCase()} actualizado a ${data.estado.nombre}.`);
      setError("");
      setConfirmation(null);
      setDeliveryPayment(null);
      setCreditDays("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible actualizar el estado del pedido.");
      setConfirmation(null);
    } finally {
      setUpdatingState(false);
    }
  }

  async function assignOrderCredit() {
    if (!creditOrder || !Number.isInteger(Number(creditDays)) || Number(creditDays) < 1 || Number(creditDays) > 365) {
      setError("Indica una cantidad válida de días de crédito entre 1 y 365.");
      return;
    }
    setUpdatingState(true);
    try {
      const { data } = await api.post(`/pedidos/${creditOrder.id}/credito`, {
        dias_credito: Number(creditDays),
      });
      setOrders((current) => current.map((order) => order.id === data.id ? data : order));
      setSelectedOrder(data);
      setNotice(`Crédito asignado al pedido ${data.id.slice(0, 8).toUpperCase()}.`);
      setError("");
      setCreditOrder(null);
      setCreditDays("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible asignar el crédito al pedido.");
    } finally {
      setUpdatingState(false);
    }
  }

  async function exportOrderPdf(order) {
    const code = order.id.slice(0, 8).toUpperCase();
    const { data } = await api.get(`/pedidos/${order.id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedido-${code}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handlePdfCheckbox(orderId, checked) {
    setSelectedOrdersForPdf((current) => {
      const updated = new Set(current);
      if (checked) {
        updated.add(orderId);
      } else {
        updated.delete(orderId);
      }
      return updated;
    });
  }

  async function exportSelectedPdfs() {
    if (selectedOrdersForPdf.size === 0) return;
    try {
      const { data } = await api.post("/pedidos/pdf-bulk", Array.from(selectedOrdersForPdf), { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pedidos.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No fue posible exportar los PDFs seleccionados.");
    }
  }

  useEffect(() => {
    if (!selectedOrder) return undefined;
    const actions = document.querySelector(".admin-app .order-detail-modal .order-state-actions");
    if (!actions || actions.querySelector(".export-order-pdf")) return undefined;
    const button = document.createElement("button");
    button.className = "btn btn-outline-primary export-order-pdf";
    button.type = "button";
    button.textContent = "Exportar PDF";
    const exportPdf = () => exportOrderPdf(selectedOrder);
    button.addEventListener("click", exportPdf);
    actions.prepend(button);
    return () => {
      button.removeEventListener("click", exportPdf);
      button.remove();
    };
  }, [selectedOrder]);

  useEffect(() => {
    const messageText = notice || error;
    if (!selectedOrder || !messageText) return undefined;
    const body = document.querySelector(".admin-app .order-detail-modal .modal-body-custom");
    if (!body || body.querySelector(".order-detail-notice")) return undefined;
    const alert = document.createElement("div");
    alert.className = `alert alert-${notice ? "success" : "danger"} order-detail-notice`;
    alert.setAttribute("role", notice ? "status" : "alert");
    const message = document.createElement("span");
    message.textContent = messageText;
    const dismiss = document.createElement("button");
    dismiss.className = "btn-close";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Cerrar mensaje");
    const dismissMessage = () => {
      setNotice("");
      setError("");
    };
    dismiss.addEventListener("click", dismissMessage);
    alert.append(message, dismiss);
    body.prepend(alert);
    return () => {
      dismiss.removeEventListener("click", dismissMessage);
      alert.remove();
    };
  }, [selectedOrder, notice, error]);

  const visibleOrders = orders.filter((order) => {
    const code = filters.codigo.trim().toUpperCase();
    const customerName = filters.cliente.trim().toLocaleUpperCase("es-CL");
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    const from = filters.desde ? new Date(`${filters.desde}T00:00:00`) : null;
    const to = filters.hasta ? new Date(`${filters.hasta}T23:59:59.999`) : null;
    return order.estado.nombre === filters.estado
      && (!code || order.id.slice(0, 8).toUpperCase().includes(code))
      && (!customerName || (order.cliente.nombre ?? "").toLocaleUpperCase("es-CL").includes(customerName))
      && (!from || (createdAt && createdAt >= from))
      && (!to || (createdAt && createdAt <= to));
  });

  const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" });
  return (
    <>
      <header className="admin-topbar">
        <div className="topbar-title">
          <p className="eyebrow mb-1">OPERACION</p>
          <h1>Pedidos</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-date d-none d-sm-inline">
            Seguimiento de pedidos
          </span>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-summary">
          <div>
            <p className="eyebrow">PEDIDOS</p>
            <h2>Controla todos los pedidos</h2>
            <p>
              Consulta solicitudes de todos tus clientes y revisa su detalle.
            </p>
          </div>
          <div className="summary-metric">
            <span>{visibleOrders.length}</span>
            <small>Pedidos visibles</small>
          </div>
        </section>
        <section className="content-panel">
          <div className="panel-heading">
            <div>
              <h2>Listado de pedidos</h2>
              <p>Filtra por estado, pedido, cliente o rango de fechas.</p>
            </div>
            <span className="panel-count">{visibleOrders.length} pedidos</span>
          </div>
          <div className="order-history-filters admin-order-filters">
            <label>
              Estado
              <select
                className="form-select"
                value={filters.estado}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    estado: event.target.value,
                  }))
                }
              >
                <option>Pedido</option>
                <option>Despachado</option>
                <option>Entregado</option>
                <option>Cancelado</option>
              </select>
            </label>
            <label>
              Pedido
              <input
                className="form-control"
                type="search"
                placeholder="Ej. 4CB969B1"
                value={filters.codigo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    codigo: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Cliente
              <input
                className="form-control"
                type="search"
                placeholder="Nombre del cliente"
                value={filters.cliente}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    cliente: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Desde
              <input
                className="form-control"
                type="date"
                value={filters.desde}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    desde: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Hasta
              <input
                className="form-control"
                type="date"
                value={filters.hasta}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    hasta: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="btn btn-primary mt-auto"
              type="button"
              disabled={selectedOrdersForPdf.size === 0}
              onClick={exportSelectedPdfs}
            >
              Exportar PDF
            </button>
          </div>
          {notice && (
            <div className="alert alert-success mt-3 mb-0 category-notice">
              <CheckCircle2 size={18} />
              {notice}
              <button
                className="btn-close"
                type="button"
                onClick={() => setNotice("")}
              />
            </div>
          )}
          {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
          {loading ? (
            <p className="mt-4 text-secondary">Cargando pedidos...</p>
          ) : (
            <div className="admin-order-table mt-4">
              <div className="admin-order-head">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Fecha</span>
                <span>Estado</span>
                <span>Total</span>
                <span>Acciones</span>
                <span>Exportar PDF</span>
              </div>
              {visibleOrders.map((order) => (
                <article className="admin-order-row" key={order.id}>
                  <div>
                    <strong>Pedido {order.id.slice(0, 8).toUpperCase()}</strong>
                    <small>{order.detalles.length} productos</small>
                  </div>
                  <div>
                    <strong>
                      {order.cliente.nombre ||
                        order.cliente.rut ||
                        order.cliente.celular ||
                        "Cliente"}
                    </strong>
                    <small>
                      {order.cliente.rut ||
                        order.cliente.celular ||
                        "Sin identificador"}
                    </small>
                  </div>
                  <span>
                    {order.created_at
                      ? dateFormatter.format(new Date(order.created_at))
                      : "-"}
                  </span>
                  <span
                    className={`order-status order-${order.estado.nombre.toLowerCase()}`}
                  >
                    {order.estado.nombre}
                  </span>
                  <strong>{money.format(order.total)}</strong>
                  <button
                    className="icon-button category-edit"
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    aria-label={`Ver detalle del pedido ${order.id.slice(0, 8).toUpperCase()}`}
                  >
                    <Eye size={16} />
                  </button>
                  <input
                    className="form-check-input pdf-checkbox"
                    type="checkbox"
                    checked={selectedOrdersForPdf.has(order.id)}
                    onChange={(event) => handlePdfCheckbox(order.id, event.target.checked)}
                    aria-label={`Seleccionar pedido ${order.id.slice(0, 8).toUpperCase()} para PDF`}
                  />
                </article>
              ))}
              {!visibleOrders.length && (
                <p className="history-filter-empty">
                  No hay pedidos que coincidan con los filtros.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      {selectedOrder && (
        <div className="modal-backdrop-custom">
          <section
            className="category-modal product-modal order-detail-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p className="eyebrow">PEDIDO</p>
                <h2>Detalle del pedido</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Cerrar detalle"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              <div className="order-detail-meta">
                <span>Pedido {selectedOrder.id.slice(0, 8).toUpperCase()}</span>
                <span>
                  {selectedOrder.cliente.nombre ||
                    selectedOrder.cliente.rut ||
                    "Cliente"}
                </span>
                <span>
                  {selectedOrder.created_at
                    ? dateFormatter.format(new Date(selectedOrder.created_at))
                    : ""}
                </span>
              </div>
              <div className="order-detail-lines">
                <div>
                  <span>Producto</span>
                  <span>Tributación</span>
                  <span>Cantidad</span>
                  <span>Precio</span>
                  <span>Subtotal</span>
                </div>
                {selectedOrder.detalles.map((line) => (
                  <div key={line.producto_id}>
                    <OrderProduct line={line} />
                    <span className={line.afecto ? "tax-status tax-status-taxable" : "tax-status tax-status-exempt"}>{line.afecto ? "Afecto" : "Exento"}</span>
                    <span>{Number(line.cantidad)}</span>
                    <span>{money.format(line.precio_unitario)}</span>
                    <strong>{money.format(line.subtotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="order-detail-total">
                <strong>Total</strong>
                <strong>{money.format(selectedOrder.total)}</strong>
              </div>
            </div>
            <footer>
              <div className="order-state-actions">
                {selectedOrder.estado.nombre === "Entregado" && (
                  <button
                    className="btn btn-outline-primary"
                    type="button"
                    disabled={selectedOrder.tiene_credito}
                    onClick={() => {
                      setCreditDays("");
                      setError("");
                      setCreditOrder(selectedOrder);
                    }}
                  >
                    {selectedOrder.tiene_credito ? "Crédito asignado" : "Agregar crédito"}
                  </button>
                )}
                {availableTransitions(selectedOrder).map((nextState) => (
                  <button
                    className={
                      nextState === "Cancelado"
                        ? "btn btn-outline-danger"
                        : "btn btn-primary"
                    }
                    type="button"
                    key={nextState}
                    onClick={() => {
                      setDeliveryPayment(null);
                      setCreditDays("");
                      setConfirmation({ order: selectedOrder, nextState });
                    }}
                  >
                    {nextState === "Despachado"
                      ? "Despachar"
                      : nextState === "Entregado"
                        ? "Entregar"
                        : "Cancelar pedido"}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => setSelectedOrder(null)}
              >
                Cerrar
              </button>
            </footer>
          </section>
        </div>
      )}
      {confirmation && (
        <div className="modal-backdrop-custom">
          <section
            className="category-modal confirmation-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p className="eyebrow">CONFIRMAR ACCION</p>
                <h2>
                  {confirmation.nextState === "Entregado"
                    ? "¿Cliente pagó su pedido?"
                    : "¿Cambiar estado del pedido?"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setConfirmation(null)}
                aria-label="Cerrar confirmación"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              <p>
                El pedido{" "}
                <strong>
                  {confirmation.order.id.slice(0, 8).toUpperCase()}
                </strong>{" "}
                cambiará de <strong>{confirmation.order.estado.nombre}</strong>{" "}
                a <strong>{confirmation.nextState}</strong>.
              </p>
              {confirmation.nextState === "Entregado" ? (
                <>
                  <div className="payment-choice">
                    <button
                      type="button"
                      className={
                        deliveryPayment === true
                          ? "btn btn-primary"
                          : "btn btn-outline-primary"
                      }
                      onClick={() => {
                        setDeliveryPayment(true);
                        setCreditDays("");
                      }}
                    >
                      Sí, pagó
                    </button>
                    <button
                      type="button"
                      className={
                        deliveryPayment === false
                          ? "btn btn-primary"
                          : "btn btn-outline-primary"
                      }
                      onClick={() => setDeliveryPayment(false)}
                    >
                      No, queda a crédito
                    </button>
                  </div>
                  {deliveryPayment === false && (
                    <div className="mt-3">
                      <label className="form-label" htmlFor="credit-days">
                        Días de crédito
                      </label>
                      <input
                        id="credit-days"
                        className="form-control"
                        type="number"
                        min="1"
                        max="365"
                        step="1"
                        value={creditDays}
                        onChange={(event) => setCreditDays(event.target.value)}
                        required
                        autoFocus
                      />
                      <small className="form-text">
                        El vencimiento se calcula desde la fecha de entrega.
                      </small>
                    </div>
                  )}
                </>
              ) : (
                <p className="mb-0">
                  Esta acción actualizará el estado visible para el cliente.
                </p>
              )}
            </div>
            <footer>
              <button
                className="btn btn-light"
                type="button"
                disabled={updatingState}
                onClick={() => setConfirmation(null)}
              >
                Volver
              </button>
              <button
                className={
                  confirmation.nextState === "Cancelado"
                    ? "btn btn-danger"
                    : "btn btn-primary"
                }
                type="button"
                disabled={updatingState}
                onClick={changeOrderStatus}
              >
                {updatingState
                  ? "Actualizando..."
                  : confirmation.nextState === "Entregado"
                    ? "Finalizar entrega"
                    : "Confirmar cambio"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {creditOrder && (
        <div className="modal-backdrop-custom">
          <section
            className="category-modal confirmation-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p className="eyebrow">ASIGNAR CRÉDITO</p>
                <h2>Crédito para pedido entregado</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCreditOrder(null)}
                aria-label="Cerrar asignación de crédito"
              >
                <X size={19} />
              </button>
            </header>
            <div className="modal-body-custom">
              {error && <div className="alert alert-danger">{error}</div>}
              <p>
                Asignar crédito al pedido <strong>{creditOrder.id.slice(0, 8).toUpperCase()}</strong>.
              </p>
              <label className="form-label" htmlFor="delivered-credit-days">
                Días de crédito
              </label>
              <input
                id="delivered-credit-days"
                className="form-control"
                type="number"
                min="1"
                max="365"
                step="1"
                value={creditDays}
                onChange={(event) => setCreditDays(event.target.value)}
                required
                autoFocus
              />
              <small className="form-text">
                El vencimiento se calcula desde la fecha de asignación.
              </small>
            </div>
            <footer>
              <button
                className="btn btn-light"
                type="button"
                disabled={updatingState}
                onClick={() => setCreditOrder(null)}
              >
                Volver
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={updatingState}
                onClick={assignOrderCredit}
              >
                {updatingState ? "Asignando..." : "Asignar crédito"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function CreditManager() {
  const [credits, setCredits] = useState([]);
  const [paidFilter, setPaidFilter] = useState("pending");
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCredits() {
    setLoading(true);
    try {
      const { data } = await api.get("/creditos", { params: { pagado: paidFilter === "paid" } });
      setCredits(data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible cargar los créditos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCredits(); }, [paidFilter]);

  async function confirmPayment() {
    if (!selectedCredit || !paymentDate) return;
    setSaving(true);
    try {
      await api.patch(`/creditos/${selectedCredit.id}/pago`, { fecha_pago: paymentDate });
      setNotice(`Crédito del pedido ${selectedCredit.pedido.id.slice(0, 8).toUpperCase()} marcado como pagado.`);
      setSelectedCredit(null);
      await loadCredits();
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? "No fue posible registrar el pago.");
      setSelectedCredit(null);
    } finally {
      setSaving(false);
    }
  }

  const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "short" });
  const customerName = (credit) => credit.cliente.nombre || credit.cliente.rut || credit.cliente.celular || "Cliente";
  const dueDays = (credit) => Math.max(0, Math.ceil((new Date(credit.fecha_vencimiento) - new Date()) / 86_400_000));

  return <><header className="admin-topbar"><div className="topbar-title"><p className="eyebrow mb-1">COBRANZAS</p><h1>Créditos</h1></div><div className="topbar-actions"><span className="topbar-date d-none d-sm-inline">Seguimiento de cuentas por cobrar</span></div></header><div className="admin-content"><section className="admin-summary"><div><p className="eyebrow">CRÉDITOS</p><h2>{paidFilter === "pending" ? "Créditos pendientes" : "Historial de créditos pagados"}</h2><p>Controla los plazos de pago registrados al entregar los pedidos.</p></div><div className="summary-metric"><span>{credits.length}</span><small>{paidFilter === "pending" ? "Pendientes de pago" : "Pagados"}</small></div></section><section className="content-panel"><div className="panel-heading"><div><h2>Listado de créditos</h2><p>Consulta vencimientos y registra pagos recibidos.</p></div><span className="panel-count">{credits.length} registros</span></div><div className="credit-filters"><label htmlFor="credit-status">Vista</label><select id="credit-status" className="form-select" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}><option value="pending">Pendientes</option><option value="paid">Historial pagados</option></select></div>{notice && <div className="alert alert-success mt-3 mb-0 category-notice"><CheckCircle2 size={18} />{notice}<button className="btn-close" type="button" onClick={() => setNotice("")} /></div>}{error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}{loading ? <p className="mt-4 text-secondary">Cargando créditos...</p> : <div className="credit-table mt-4"><div className="credit-table-head"><span>Cliente</span><span>Pedido</span><span>Días crédito</span><span>Entrega</span><span>Días al vencimiento</span><span>Vencimiento</span><span>{paidFilter === "paid" ? "Fecha pago" : "Acciones"}</span></div>{credits.length ? credits.map((credit) => <article className="credit-row" key={credit.id}><div><strong>{customerName(credit)}</strong><small>{credit.cliente.rut || credit.cliente.celular || "Sin identificador"}</small></div><strong>#{credit.pedido.id.slice(0, 8).toUpperCase()}</strong><span>{credit.dias_credito}</span><span>{dateFormatter.format(new Date(credit.fecha_entrega))}</span><span>{paidFilter === "pending" ? dueDays(credit) : "-"}</span><span>{dateFormatter.format(new Date(credit.fecha_vencimiento))}</span>{paidFilter === "paid" ? <span>{credit.fecha_pago ? dateFormatter.format(new Date(credit.fecha_pago)) : "-"}</span> : <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => { setPaymentDate(new Date().toISOString().slice(0, 10)); setSelectedCredit(credit); }}>Marcar pagado</button>}</article>) : <p className="history-filter-empty">No hay créditos {paidFilter === "pending" ? "pendientes" : "pagados"}.</p>}</div>}</section></div>{selectedCredit && <div className="modal-backdrop-custom"><section className="category-modal confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="credit-payment-title"><header><div><p className="eyebrow">REGISTRAR PAGO</p><h2 id="credit-payment-title">¿Confirmar pago del crédito?</h2></div><button className="icon-button" type="button" onClick={() => setSelectedCredit(null)} aria-label="Cerrar confirmación"><X size={19} /></button></header><div className="modal-body-custom"><p>El crédito del pedido <strong>#{selectedCredit.pedido.id.slice(0, 8).toUpperCase()}</strong> quedará marcado como pagado.</p><label className="form-label" htmlFor="credit-payment-date">Fecha de pago</label><input id="credit-payment-date" className="form-control" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></div><footer><button className="btn btn-light" type="button" disabled={saving} onClick={() => setSelectedCredit(null)}>No</button><button className="btn btn-primary" type="button" disabled={saving || !paymentDate} onClick={confirmPayment}>{saving ? "Guardando..." : "Sí, marcar pagado"}</button></footer></section></div>}</>;
}

function AdminSalesDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({ desde: monthStart, hasta: today });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/pedidos").then(({ data }) => setOrders(data)).catch((requestError) => setError(requestError.response?.data?.detail ?? "No fue posible cargar los indicadores.")).finally(() => setLoading(false));
  }, []);

  const salesOrders = orders.filter((order) => {
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    const from = filters.desde ? new Date(`${filters.desde}T00:00:00`) : null;
    const to = filters.hasta ? new Date(`${filters.hasta}T23:59:59.999`) : null;
    return order.estado.nombre !== "Cancelado" && (!from || (createdAt && createdAt >= from)) && (!to || (createdAt && createdAt <= to));
  });
  const totalSales = salesOrders.reduce((total, order) => total + Number(order.total), 0);
  const totalUnits = salesOrders.reduce((total, order) => total + order.detalles.reduce((sum, line) => sum + Number(line.cantidad), 0), 0);
  const customerRanking = Object.values(salesOrders.reduce((ranking, order) => {
    const id = order.cliente.id;
    const name = order.cliente.nombre || order.cliente.rut || order.cliente.celular || "Cliente";
    ranking[id] ??= { id, name, orders: 0, total: 0 };
    ranking[id].orders += 1;
    ranking[id].total += Number(order.total);
    return ranking;
  }, {})).sort((first, second) => second.total - first.total).slice(0, 10);
  const productRanking = Object.values(salesOrders.reduce((ranking, order) => {
    order.detalles.forEach((line) => {
      ranking[line.producto_id] ??= { id: line.producto_id, name: line.nombre_producto, units: 0, total: 0 };
      ranking[line.producto_id].units += Number(line.cantidad);
      ranking[line.producto_id].total += Number(line.subtotal);
    });
    return ranking;
  }, {})).sort((first, second) => second.units - first.units || second.total - first.total).slice(0, 10);
  const maxCustomerTotal = customerRanking[0]?.total ?? 1;
  const maxProductUnits = productRanking[0]?.units ?? 1;

  return <><header className="admin-topbar"><div className="topbar-title"><p className="eyebrow mb-1">ANALÍTICA</p><h1>Dashboard</h1></div><div className="topbar-actions"><span className="topbar-date d-none d-sm-inline">Resumen comercial</span></div></header><div className="admin-content dashboard-content"><section className="dashboard-hero"><div><p className="eyebrow">VENTAS</p><h2>Visión comercial</h2><p>Ventas y comportamiento de compra durante el periodo seleccionado.</p></div><div className="dashboard-date-filters"><label>Desde<input className="form-control" type="date" value={filters.desde} max={filters.hasta || undefined} onChange={(event) => setFilters((current) => ({ ...current, desde: event.target.value }))} /></label><label>Hasta<input className="form-control" type="date" value={filters.hasta} min={filters.desde || undefined} max={today} onChange={(event) => setFilters((current) => ({ ...current, hasta: event.target.value }))} /></label></div></section>{error && <div className="alert alert-danger">{error}</div>}{loading ? <p className="text-secondary">Cargando indicadores...</p> : <><section className="dashboard-metrics"><article><span>VENTAS TOTALES</span><strong>{money.format(totalSales)}</strong><small>{salesOrders.length} pedidos no cancelados</small></article><article><span>CLIENTE PRINCIPAL</span><strong>{customerRanking[0]?.name || "Sin compras"}</strong><small>{customerRanking[0] ? money.format(customerRanking[0].total) : "-"}</small></article><article><span>PRODUCTO LÍDER</span><strong>{productRanking[0]?.name || "Sin ventas"}</strong><small>{productRanking[0] ? `${productRanking[0].units} unidades vendidas` : "-"}</small></article><article><span>UNIDADES VENDIDAS</span><strong>{totalUnits}</strong><small>En el periodo seleccionado</small></article></section><section className="dashboard-grid"><section className="content-panel dashboard-ranking"><div className="panel-heading"><div><h2>Clientes con más compras</h2><p>Ordenados de mayor a menor monto comprado.</p></div><span className="panel-count">{customerRanking.length} clientes</span></div>{customerRanking.length ? <ol className="ranking-list">{customerRanking.map((customer, index) => <li key={customer.id}><span className="ranking-position">{index + 1}</span><div className="ranking-main"><strong>{customer.name}</strong><small>{customer.orders} pedido{customer.orders === 1 ? "" : "s"}</small><i><b style={{ width: `${(customer.total / maxCustomerTotal) * 100}%` }} /></i></div><strong className="ranking-value">{money.format(customer.total)}</strong></li>)}</ol> : <p className="history-filter-empty">No hay compras en el periodo seleccionado.</p>}</section><section className="content-panel dashboard-ranking"><div className="panel-heading"><div><h2>Productos más vendidos</h2><p>Ordenados por cantidad de unidades vendidas.</p></div><span className="panel-count">{productRanking.length} productos</span></div>{productRanking.length ? <ol className="ranking-list">{productRanking.map((product, index) => <li key={product.id}><span className="ranking-position">{index + 1}</span><div className="ranking-main"><strong>{product.name}</strong><small>{product.units} unidades · {money.format(product.total)}</small><i><b style={{ width: `${(product.units / maxProductUnits) * 100}%` }} /></i></div><strong className="ranking-value">{product.units}</strong></li>)}</ol> : <p className="history-filter-empty">No hay ventas de productos en el periodo seleccionado.</p>}</section></section></>}</div></>;
}

function AdminDashboard({ onLogout }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editUsesCustomerPercentage, setEditUsesCustomerPercentage] = useState(true);
  const [editPercentage, setEditPercentage] = useState("0");
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState("summary");
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [brands, setBrands] = useState([]);

  async function loadBrands() {
    try {
      const { data } = await api.get("/marcas");
      setBrands(data);
    } catch {
      // ignore
    }
  }

  async function loadCategories() {
    try {
      const { data } = await api.get("/categorias", { params: { active_only: false } });
      setCategories(data);
    } catch {
      setError("No fue posible cargar las categorías.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
    loadBrands();
  }, []);

  async function createCategory(event) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/categorias", { nombre: name.trim(), activo: true });
      setName("");
      setError("");
      await loadCategories();
      setNotice("Categoría agregada correctamente.");
    } catch {
      setError("No fue posible crear la categoría. Revisa que el nombre no esté repetido.");
    }
  }

  function openEdit(category) {
    setEditingCategory(category);
    setEditName(category.nombre);
    setEditActive(category.activo);
    setEditUsesCustomerPercentage(category.usa_porcentaje_cliente);
    setEditPercentage(String(category.porcentaje ?? 0));
    setError("");
  }

  async function updateCategory(event) {
    event.preventDefault();
    if (!editingCategory || !editName.trim()) return;
    setSaving(true);
    try {
      await api.put(`/categorias/${editingCategory.id}`, {
        nombre: editName.trim(),
        usa_porcentaje_cliente: editUsesCustomerPercentage,
        porcentaje: editUsesCustomerPercentage ? 0 : Number(editPercentage),
        activo: editActive,
      });
      setEditingCategory(null);
      setError("");
      await loadCategories();
      setNotice("Categoría actualizada correctamente.");
    } catch {
      setError("No fue posible actualizar la categoría. Revisa que el nombre no esté repetido.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    setAdminToken(null);
    onLogout();
  }

  const navigation = [
    [LayoutDashboard, "Dashboard", "summary", true],
    [FolderTree, "Categorías", "categories", true],
    [Tag, "Marcas", "brands", true],
    [Package, "Productos", "products", true],
    [ClipboardList, "Pedidos", "orders", true],
    [ClipboardList, "Créditos", "credits", true],
  ];

  return <main className="admin-app"><aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}><div className="sidebar-brand"><BrandMark /><span>Santa Mena</span><button className="sidebar-close d-lg-none" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div><p className="sidebar-label">OPERACION</p><nav className="sidebar-nav">{navigation.map(([Icon, label, key, enabled]) => <button key={label} className={section === key ? "active" : ""} disabled={!enabled} onClick={() => { setSection(key); setMenuOpen(false); }}><Icon size={19} /><span>{label}</span>{!enabled && <small>Pronto</small>}</button>)}<div className="sidebar-configuration"><button className={configurationOpen || ["users", "customers", "percentages", "external-codes"].includes(section) ? "active" : ""} onClick={() => setConfigurationOpen((current) => !current)}><Settings size={19} /><span>Configuración</span></button>{configurationOpen && <div className="sidebar-submenu"><button className={section === "users" ? "active" : ""} onClick={() => { setSection("users"); setMenuOpen(false); }}><Users size={17} /><span>Usuarios</span></button><button className={section === "customers" ? "active" : ""} onClick={() => { setSection("customers"); setMenuOpen(false); }}><Users size={17} /><span>Clientes</span></button><button className={section === "percentages" ? "active" : ""} onClick={() => { setSection("percentages"); setMenuOpen(false); }}><Percent size={17} /><span>Porcentajes</span></button><button className={section === "external-codes" ? "active" : ""} onClick={() => { setSection("external-codes"); setMenuOpen(false); }}><Hash size={17} /><span>Código Externo</span></button></div>}</div></nav><div className="sidebar-bottom"><div className="sidebar-user"><span>RE</span><div><strong>Administrador</strong><small>Sesión activa</small></div></div><button className="logout-button" onClick={logout}><LogOut size={18} />Cerrar sesión</button></div></aside><div className="sidebar-backdrop d-lg-none" hidden={!menuOpen} onClick={() => setMenuOpen(false)} /><button className="icon-button admin-mobile-menu d-lg-none" type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
    {section === "summary" ? <section className="admin-workspace"><AdminSalesDashboard /></section> : section === "brands" ? <section className="admin-workspace"><BrandManager categories={categories} brands={brands} onReload={loadBrands} /></section> : section === "products" ? <section className="admin-workspace"><ProductManager categories={categories} brands={brands} /></section> : section === "orders" ? <section className="admin-workspace"><AdminOrderManager /></section> : section === "credits" ? <section className="admin-workspace"><CreditManager /></section> : section === "users" ? <section className="admin-workspace"><UserManager /></section> : section === "customers" ? <section className="admin-workspace"><CustomerManager /></section> : section === "percentages" ? <section className="admin-workspace"><PercentageManager /></section> : section === "external-codes" ? <section className="admin-workspace"><ExternalCodeManager /></section> : <>
    <section className="admin-workspace"><header className="admin-topbar"><div className="topbar-title"><p className="eyebrow mb-1">CATALOGO</p><h1>Categorías</h1></div><div className="topbar-actions"><span className="topbar-date d-none d-sm-inline">Gestión de Categoría</span><button className="btn btn-primary" onClick={() => document.getElementById("category-name")?.focus()}><Plus size={18} />Nueva categoría</button></div></header>
      <div className="admin-content"><section className="admin-summary"><div><p className="eyebrow">INVENTARIO</p><h2>Organiza tu Categoría</h2><p>Las categorías agrupan los productos visibles para tus clientes.</p></div><div className="summary-metric"><span>{categories.length}</span><small>Categorías registradas</small></div></section>
        <section className="content-panel"><div className="panel-heading"><div><h2>Listado de categorías</h2><p>Administra la clasificación de tu catálogo.</p></div><span className="panel-count">{categories.length} registros</span></div><form className="category-form" onSubmit={createCategory}><div><label htmlFor="category-name" className="visually-hidden">Nombre de categoría</label><input id="category-name" className="form-control" placeholder="Escribe una nueva categoría" value={name} onChange={(event) => setName(event.target.value)} maxLength="120" required /></div><button className="btn btn-primary"><Plus size={18} />Agregar</button></form>
          {notice && <div className="alert alert-success alert-dismissible fade show mt-3 mb-0 category-notice" role="alert"><CheckCircle2 size={18} />{notice}<button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setNotice("")} /></div>}
          {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
          {loading ? <p className="mt-4 text-secondary">Cargando categorías...</p> : <div className="category-table mt-4"><div className="category-table-head"><span>Categoría</span><span>Porcentaje</span><span>Estado</span><span>Acciones</span></div>{categories.length ? categories.map((category) => <div className="category-row" key={category.id}><div className="category-name"><span className="category-icon"><Boxes size={18} /></span><strong>{category.nombre}</strong></div><span className="category-percentage">{category.usa_porcentaje_cliente ? "Cliente" : `${Number(category.porcentaje)}%`}</span><span className={category.activo ? "status-active" : "status-inactive"}>{category.activo ? "Activa" : "Inactiva"}</span><button className="icon-button category-edit" onClick={() => openEdit(category)} aria-label={`Editar ${category.nombre}`}><Pencil size={16} /></button></div>) : <p className="text-secondary p-4 mb-0">Aún no hay categorías. Agrega la primera para comenzar.</p>}</div>}
        </section></div></section>{editingCategory && <div className="modal-backdrop-custom" role="presentation"><form className="category-modal" onSubmit={updateCategory} role="dialog" aria-modal="true" aria-labelledby="edit-category-title"><header><div><p className="eyebrow">CATEGORIA</p><h2 id="edit-category-title">Editar categoría</h2></div><button type="button" className="icon-button" onClick={() => setEditingCategory(null)} aria-label="Cerrar edición"><X size={19} /></button></header><div className="modal-body-custom"><label htmlFor="edit-category-name" className="form-label">Nombre</label><input id="edit-category-name" className="form-control" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength="120" required autoFocus /><div className="status-toggle"><div><strong>Usar porcentaje del cliente</strong><small>Aplica el porcentaje configurado para el cliente.</small></div><label className="switch"><input type="checkbox" checked={editUsesCustomerPercentage} onChange={(event) => setEditUsesCustomerPercentage(event.target.checked)} /><span /></label></div>{!editUsesCustomerPercentage && <div className="mt-3"><label htmlFor="edit-category-percentage" className="form-label">Porcentaje de la categoría</label><input id="edit-category-percentage" className="form-control" type="number" min="0" max="100" step="0.01" value={editPercentage} onChange={(event) => setEditPercentage(event.target.value)} required /><small className="form-text">Se suma al precio base de los productos de esta categoría.</small></div>}<div className="status-toggle"><div><strong>Estado de la categoría</strong><small>Las categorías inactivas no aparecen al cliente.</small></div><label className="switch"><input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} /><span /></label></div></div><footer><button type="button" className="btn btn-light" onClick={() => setEditingCategory(null)}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : <><Save size={17} />Guardar cambios</>}</button></footer></form></div>}</>}</main>;
}

function ShopLegacy({ customer }) {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("shop");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await api.get("/productos", { params: { search: query || undefined, customer_id: customer.id } });
      setProducts(data);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, customer.id]);

  async function loadOrders() {
    const { data } = await api.get(`/clientes/${customer.id}/pedidos`);
    setOrders(data);
    setView("orders");
  }

  function add(product) {
    setCart((current) => {
      const previous = current.find((item) => item.id === product.id);
      return previous ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }];
    });
    setNotice("Producto agregado al carrito.");
  }

  const total = cart.reduce((sum, item) => sum + Number(item.precio_cliente ?? item.precio) * item.quantity, 0);
  return <main className="customer-app"><header className="customer-topbar"><div className="container d-flex align-items-center justify-content-between"><div className="customer-brand"><span className="brand-mark">S</span><strong>Santa Mena</strong></div><button className="btn btn-light btn-sm" onClick={loadOrders}><ClipboardList size={17} />Mis pedidos</button></div></header><div className="container py-4 py-lg-5"><header className="customer-heading"><p className="eyebrow">PORTAL DE PEDIDOS</p><h1>Hola, {customer.nombre}</h1><p>Selecciona los productos que necesitas para tu próximo despacho.</p></header>
    {view === "orders" ? <section className="content-panel"><button className="btn btn-link px-0 mb-3" onClick={() => setView("shop")}>Volver al catálogo</button><h2>Pedidos pendientes</h2>{orders.length ? orders.map((order) => <article className="order-row" key={order.id}><strong>{order.estado}</strong><span>{money.format(order.total)}</span><span>{order.detalles.length} productos</span></article>) : <p className="text-secondary mb-0">No hay pedidos pendientes.</p>}</section> : <div className="row g-4"><section className="col-lg-8"><div className="search-field"><Search size={20} /><label htmlFor="search" className="visually-hidden">Buscar producto</label><input id="search" className="form-control form-control-lg" placeholder="Busca por nombre de producto" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {notice && <div className="alert alert-success mt-3">{notice}</div>}<div className="product-grid mt-4">{products.map((product) => <article className="product" key={product.id}><div className="product-image">{product.imagen_url ? <img src={product.imagen_url} alt="" /> : <Package size={30} />}</div><small>{product.marca?.nombre ? `${product.marca.nombre} · ` : ""}#{product.codigointerno || product.codigo}</small><h2>{product.nombre}</h2><strong>{money.format(product.precio_cliente ?? product.precio)}</strong><button className="btn btn-outline-primary mt-3" onClick={() => add(product)}><Plus size={17} />Agregar</button></article>)}</div></section>
      <aside className="col-lg-4"><div className="cart"><div className="cart-title"><ShoppingBag size={20} /><h2>Tu carrito</h2></div>{cart.length === 0 ? <p className="text-secondary">Aún no agregas productos.</p> : <>{cart.map((item) => <div className="cart-line" key={item.id}><span>{item.nombre}</span><div><button onClick={() => setCart(cart.map((line) => line.id === item.id ? { ...line, quantity: Math.max(1, line.quantity - 1) } : line))}>-</button><span>{item.quantity}</span><button onClick={() => setCart(cart.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line))}>+</button></div></div>)}<hr/><div className="d-flex justify-content-between"><strong>Total</strong><strong>{money.format(total)}</strong></div><button className="btn btn-primary w-100 mt-3" disabled>Selecciona dirección para finalizar</button></>}</div></aside></div>}</div></main>;
}

function Shop({ customer, onLogout }) {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(customer.direcciones?.find((address) => address.principal && address.activo)?.id ?? customer.direcciones?.find((address) => address.activo)?.id ?? "");
  const [section, setSection] = useState("create");
  const [orders, setOrders] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({ estado: "Pedido", codigo: "", desde: "", hasta: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts() {
    try {
      const { data } = await api.get("/productos", {
        params: {
          category_id: selectedCategory || undefined,
          brand_id: selectedBrand || undefined,
          search: query || undefined,
          customer_id: customer.id,
          page,
          page_size: 10,
        },
      });
      setProducts(data.items);
      setTotalProducts(data.total);
    } catch {
      setError("No fue posible cargar los productos.");
    }
  }

  useEffect(() => { setPage(1); }, [query, selectedCategory, selectedBrand]);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 200);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, selectedBrand, customer.id, page]);

  useEffect(() => {
    api.get("/categorias").then(({ data }) => setCategories(data)).catch(() => setError("No fue posible cargar las categorías."));
    api.get("/marcas", { params: { active_only: true } }).then(({ data }) => setBrands(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCategory && selectedBrand) {
      const exists = brands.some((b) => b.id === selectedBrand && b.categoria_id === selectedCategory);
      if (!exists) {
        setSelectedBrand("");
      }
    }
  }, [selectedCategory, selectedBrand, brands]);

  const availableBrands = brands.filter((brand) => !selectedCategory || brand.categoria_id === selectedCategory);

  useEffect(() => {
    const productGrid = document.querySelector(".customer-workspace .product-grid");
    if (section !== "create" || !productGrid || totalProducts <= 10) return undefined;
    const totalPages = Math.ceil(totalProducts / 10);
    const pager = document.createElement("nav");
    pager.className = "product-pagination customer-product-pagination";
    pager.setAttribute("aria-label", "Paginación del catálogo");
    const summary = document.createElement("small");
    summary.textContent = `Página ${page} de ${totalPages} · ${totalProducts} productos`;
    const previous = document.createElement("button");
    previous.className = "btn btn-outline-primary btn-sm";
    previous.type = "button";
    previous.textContent = "Anterior";
    previous.disabled = page === 1;
    const next = document.createElement("button");
    next.className = "btn btn-primary btn-sm";
    next.type = "button";
    next.textContent = "Siguiente";
    next.disabled = page === totalPages;
    const goPrevious = () => setPage((current) => Math.max(1, current - 1));
    const goNext = () => setPage((current) => Math.min(totalPages, current + 1));
    previous.addEventListener("click", goPrevious);
    next.addEventListener("click", goNext);
    pager.append(summary, previous, next);
    productGrid.after(pager);
    return () => {
      previous.removeEventListener("click", goPrevious);
      next.removeEventListener("click", goNext);
      pager.remove();
    };
  }, [page, section, totalProducts]);

  async function loadHistory() {
    try {
      const { data } = await api.get(`/clientes/${customer.id}/pedidos/historicos`);
      setOrders(data.map((order) => ({ ...order, estado: order.estado.nombre })));
    } catch {
      setError("No fue posible cargar el historial de pedidos.");
    }
  }

  useEffect(() => {
    if (section !== "history" || !orders.length) return undefined;
    const history = document.querySelector(".customer-workspace .order-history");
    if (!history) return undefined;
    history.querySelector(".order-history-head")?.remove();
    history.querySelectorAll(".order-date, .order-history-action").forEach((element) => element.remove());
    const header = document.createElement("div");
    header.className = "order-history-head";
    header.innerHTML = "<span>Pedido</span><span>Fecha</span><span>Estado</span><span>Total</span><span>Acciones</span>";
    history.prepend(header);
    const formatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" });
    const cleanup = [];
    [...history.querySelectorAll(".order-history-row")].forEach((row, index) => {
      const order = orders[index];
      const date = document.createElement("span");
      date.className = "order-date";
      date.textContent = order.created_at ? formatter.format(new Date(order.created_at)) : "-";
      const action = document.createElement("button");
      action.className = "btn btn-outline-primary btn-sm order-history-action";
      action.type = "button";
      action.setAttribute("aria-label", "Ver detalle del pedido");
      action.textContent = "Ver";
      const showDetail = () => setSelectedOrder(order);
      action.addEventListener("click", showDetail);
      row.children[1]?.before(date);
      row.append(action);
      cleanup.push(() => action.removeEventListener("click", showDetail));
    });
    return () => {
      cleanup.forEach((dispose) => dispose());
      header.remove();
      history.querySelectorAll(".order-date, .order-history-action").forEach((element) => element.remove());
    };
  }, [section, orders]);

  useEffect(() => {
    if (section !== "history") return undefined;
    const history = document.querySelector(".customer-workspace .order-history");
    if (!history || history.querySelector(".order-history-filters")) return undefined;
    const filters = document.createElement("div");
    filters.className = "order-history-filters";
    filters.innerHTML = '<label>Estado<select class="form-select"><option value="Pedido">Pedido</option><option value="Despachado">Despachado</option><option value="Entregado">Entregado</option><option value="Cancelado">Cancelado</option></select></label><label>Pedido<input class="form-control" type="search" placeholder="Ej. 4CB969B1" /></label><label>Desde<input class="form-control" type="date" /></label><label>Hasta<input class="form-control" type="date" /></label>';
    const [stateSelect, orderInput, fromInput, toInput] = filters.querySelectorAll("select, input");
    stateSelect.value = historyFilters.estado;
    orderInput.value = historyFilters.codigo;
    fromInput.value = historyFilters.desde;
    toInput.value = historyFilters.hasta;
    const updateFilters = () => setHistoryFilters({ estado: stateSelect.value, codigo: orderInput.value, desde: fromInput.value, hasta: toInput.value });
    [stateSelect, orderInput, fromInput, toInput].forEach((input) => input.addEventListener("input", updateFilters));
    history.before(filters);
    return () => {
      [stateSelect, orderInput, fromInput, toInput].forEach((input) => input.removeEventListener("input", updateFilters));
      filters.remove();
    };
  }, [section]);

  useEffect(() => {
    if (section !== "history") return;
    const history = document.querySelector(".customer-workspace .order-history");
    if (!history) return;
    const code = historyFilters.codigo.trim().toUpperCase();
    const from = historyFilters.desde ? new Date(`${historyFilters.desde}T00:00:00`) : null;
    const to = historyFilters.hasta ? new Date(`${historyFilters.hasta}T23:59:59.999`) : null;
    const visible = orders.map((order) => {
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      return (!historyFilters.estado || order.estado === historyFilters.estado)
        && (!code || order.id.slice(0, 8).toUpperCase().includes(code))
        && (!from || (createdAt && createdAt >= from))
        && (!to || (createdAt && createdAt <= to));
    });
    [...history.querySelectorAll(".order-history-row")].forEach((row, index) => { row.hidden = !visible[index]; });
    const count = document.querySelector(".customer-workspace .panel-count");
    if (count) count.textContent = `${visible.filter(Boolean).length} pedidos`;
    let empty = history.parentElement?.querySelector(".history-filter-empty");
    if (!visible.some(Boolean)) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "history-filter-empty";
        history.after(empty);
      }
      empty.textContent = "No hay pedidos que coincidan con los filtros.";
    } else {
      empty?.remove();
    }
  }, [section, orders, historyFilters]);

  useEffect(() => {
    if (!selectedOrder) return undefined;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(<div className="modal-backdrop-custom"><section className="category-modal product-modal order-detail-modal" role="dialog" aria-modal="true"><header><div><p className="eyebrow">PEDIDO</p><h2>Detalle del pedido</h2></div><button className="icon-button" type="button" onClick={() => setSelectedOrder(null)} aria-label="Cerrar detalle"><X size={19} /></button></header><div className="modal-body-custom"><div className="order-detail-meta"><span>Pedido {selectedOrder.id.slice(0, 8).toUpperCase()}</span><span>{selectedOrder.created_at ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedOrder.created_at)) : ""}</span></div><div className="order-detail-lines"><div><span>Producto</span><span>Tributación</span><span>Cantidad</span><span>Precio</span><span>Subtotal</span></div>{selectedOrder.detalles.map((line) => <div key={line.producto_id}><OrderProduct line={line} /><span className={line.afecto ? "tax-status tax-status-taxable" : "tax-status tax-status-exempt"}>{line.afecto ? "Afecto" : "Exento"}</span><span>{Number(line.cantidad)}</span><span>{money.format(line.precio_unitario)}</span><strong>{money.format(line.subtotal)}</strong></div>)}</div><div className="order-detail-total"><strong>Total</strong><strong>{money.format(selectedOrder.total)}</strong></div></div><footer><button className="btn btn-light" type="button" onClick={() => setSelectedOrder(null)}>Cerrar</button></footer></section></div>);
    return () => { root.unmount(); container.remove(); };
  }, [selectedOrder]);

  function openHistory() {
    setHistoryFilters({ estado: "Pedido", codigo: "", desde: "", hasta: "" });
    setSection("history");
    setError("");
    loadHistory();
  }

  function add(product) {
    setCart((current) => {
      const line = current.find((item) => item.id === product.id);
      return line ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }];
    });
    setNotice(`${product.nombre} agregado al pedido.`);
  }

  function updateQuantity(productId, quantity) {
    setCart((current) => quantity < 0.5 ? current.filter((item) => item.id !== productId) : current.map((item) => item.id === productId ? { ...item, quantity } : item));
  }

  async function createOrder() {
    if (!selectedAddress) {
      setError("Selecciona una dirección de despacho activa.");
      return;
    }
    if (!cart.length) return;

    const confirmResult = await Swal.fire({
      title: "¿Deseas enviar el pedido?",
      text: "¿Estás seguro de enviar este pedido con los productos seleccionados?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, enviar pedido",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    setSubmitting(true);
    Swal.fire({
      title: "Realizando Pedido",
      text: "Por favor, espera un momento...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const { data } = await api.post(`/clientes/${customer.id}/pedidos`, {
        direccion_id: selectedAddress,
        productos: cart.map((item) => ({ producto_id: item.id, cantidad: item.quantity })),
      });
      const orderCode = data.id.slice(0, 8).toUpperCase();
      setCart([]);
      setNotice(`Pedido #${orderCode} enviado correctamente.`);
      setSection("history");
      await Promise.all([loadHistory(), loadProducts()]);
      await Swal.fire({
        title: "¡Pedido realizado con éxito!",
        html: `Tu número de pedido es: <strong>#${orderCode}</strong>`,
        icon: "success",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#1d4ed8",
      });
    } catch (requestError) {
      const errorMsg = requestError.response?.data?.detail ?? "No fue posible enviar el pedido.";
      setError(errorMsg);
      Swal.fire({
        title: "Error al realizar pedido",
        text: errorMsg,
        icon: "error",
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#1d4ed8",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const total = cart.reduce((sum, item) => sum + Number(item.precio_cliente ?? item.precio) * item.quantity, 0);
  const activeAddresses = customer.direcciones?.filter((address) => address.activo) ?? [];
  return (
    <main className="customer-portal">
      <aside className="customer-sidebar">
        <div className="customer-brand">
          <span className="brand-mark">S</span>
          <strong>Santa Mena</strong>
        </div>
        <p className="sidebar-label">MENU PRINCIPAL</p>
        <nav className="customer-nav">
          <span className="customer-nav-title">
            <ClipboardList size={19} />
            Pedidos
          </span>
          <button
            className={section === "create" ? "active" : ""}
            onClick={() => {
              setSection("create");
              setError("");
            }}
          >
            <ShoppingBag size={17} />
            Realizar pedido
          </button>
          <button
            className={section === "history" ? "active" : ""}
            onClick={openHistory}
          >
            <ClipboardList size={17} />
            Pedidos históricos
          </button>
        </nav>
        <div className="customer-profile">
          <span>
            {(customer.nombre || customer.rut || customer.celular || "CL")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <strong>{customer.nombre || "Cliente"}</strong>
            <small>Sesión activa</small>
          </div>
        </div>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>
      <section className="customer-workspace">
        <header className="customer-portal-header">
          <div>
            <p className="eyebrow">PEDIDOS</p>
            <h1>
              {section === "create" ? "Realizar pedido" : "Pedidos históricos"}
            </h1>
          </div>
          <span className="customer-welcome">
            Hola, {customer.nombre || customer.rut || customer.celular}
          </span>
        </header>
        <div className="customer-content">
          {notice && (
            <div className="alert alert-success alert-dismissible fade show">
              <CheckCircle2 size={18} />
              {notice}
              <button
                className="btn-close"
                type="button"
                onClick={() => setNotice("")}
              />
            </div>
          )}
          {error && <div className="alert alert-danger">{error}</div>}
          {section === "create" ? (
            <div className="row g-4">
              <section className="col-xl-8">
                <div className="customer-product-filters">
                  <select
                    className="form-select"
                    value={selectedCategory}
                    onChange={(event) => {
                      setSelectedCategory(event.target.value);
                      setSelectedBrand("");
                    }}
                    aria-label="Filtrar productos por categoría"
                  >
                    <option value="">Todas las categorías</option>
                    {categories
                      .filter((category) => category.activo)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nombre}
                        </option>
                      ))}
                  </select>
                  <select
                    className="form-select"
                    value={selectedBrand}
                    onChange={(event) => setSelectedBrand(event.target.value)}
                    aria-label="Filtrar productos por marca"
                  >
                    <option value="">Todas las marcas</option>
                    {availableBrands
                      .filter((brand) => brand.activo)
                      .map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.nombre} {!selectedCategory && brand.categoria?.nombre ? `(${brand.categoria.nombre})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="search-field">
                  <Search size={20} />
                  <input
                    className="form-control form-control-lg"
                    placeholder="Busca por nombre de producto"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="product-grid mt-4">
                  {products.map((product) => (
                    <article className="product" key={product.id}>
                      <div className="product-image">
                        {productImageSource(product.imagen_url) ? (
                          <img
                            src={productImageSource(product.imagen_url)}
                            alt=""
                          />
                        ) : (
                          <Package size={30} />
                        )}
                      </div>
                      <small>{product.marca?.nombre ? `${product.marca.nombre} · ` : ""}#{product.codigointerno || product.codigo}</small>
                      <h2>{product.nombre}</h2>
                      <strong>
                        {money.format(product.precio_cliente ?? product.precio)}
                      </strong>
                      <button
                        className="btn btn-outline-primary mt-3"
                        onClick={() => add(product)}
                      >
                        <Plus size={17} />
                        Agregar
                      </button>
                    </article>
                  ))}
                </div>
                {!products.length && (
                  <p className="text-secondary mt-4">
                    No se encontraron productos.
                  </p>
                )}
              </section>
              <aside className="col-xl-4">
                <div className="cart">
                  <div className="cart-title">
                    <ShoppingBag size={20} />
                    <h2>Tu pedido</h2>
                  </div>
                  <label className="form-label" htmlFor="delivery-address">
                    Dirección de despacho
                  </label>
                  <select
                    id="delivery-address"
                    className="form-select"
                    value={selectedAddress}
                    onChange={(event) => setSelectedAddress(event.target.value)}
                  >
                    <option value="">Selecciona una dirección</option>
                    {activeAddresses.map((address) => (
                      <option value={address.id} key={address.id}>
                        {address.direccion}
                        {address.comuna ? `, ${address.comuna}` : ""}
                        {address.principal ? " (Principal)" : ""}
                      </option>
                    ))}
                  </select>
                  {!activeAddresses.length && (
                    <small className="form-text">
                      No tienes direcciones activas registradas.
                    </small>
                  )}
                  {cart.length ? (
                    <>
                      <div className="cart-items">
                        {cart.map((item) => (
                          <div className="cart-line" key={item.id}>
                            <span>{item.nombre}</span>
                            <QuantitySelector
                              cantidad={item.quantity}
                              onCantidadChange={(quantity) =>
                                updateQuantity(item.id, quantity)
                              }
                              permiteMediaUnidad={customer.con_decimal}
                            />
                          </div>
                        ))}
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between">
                        <strong>Total</strong>
                        <strong>{money.format(total)}</strong>
                      </div>
                      <button
                        className="btn btn-primary w-100 mt-3"
                        onClick={createOrder}
                        disabled={submitting || !selectedAddress}
                      >
                        {submitting ? "Enviando..." : "Enviar pedido"}
                      </button>
                    </>
                  ) : (
                    <p className="text-secondary mt-3 mb-0">
                      Agrega productos para comenzar.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <section className="content-panel">
              <div className="panel-heading">
                <div>
                  <h2>Todos tus pedidos</h2>
                  <p>Revisa el estado e importe de cada solicitud.</p>
                </div>
                <span className="panel-count">{orders.length} pedidos</span>
              </div>
              <div className="order-history mt-4">
                {orders.length ? (
                  orders.map((order) => (
                    <article className="order-history-row" key={order.id}>
                      <div>
                        <strong>
                          Pedido {order.id.slice(0, 8).toUpperCase()}
                        </strong>
                        <small>{order.detalles.length} productos</small>
                      </div>
                      <span
                        className={`order-status order-${order.estado.toLowerCase()}`}
                      >
                        {order.estado.replace("_", " ")}
                      </span>
                      <strong>{money.format(order.total)}</strong>
                    </article>
                  ))
                ) : (
                  <p className="text-secondary mb-0">
                    Aún no registras pedidos.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [customer, setCustomer] = useState(null);
  const [view, setView] = useState("customer-access");

  function closeSession() {
    setAdminToken(null);
    setCustomer(null);
    setView("customer-access");
  }

  useEffect(() => {
    const timers = new Map();
    const alertSelector = ".alert.alert-success, .alert.alert-danger";
    const prepareChartTooltips = () => {
      document.querySelectorAll(".dashboard-ranking .ranking-list li").forEach((item) => {
        const name = item.querySelector(".ranking-main strong")?.textContent?.trim();
        const valueElement = item.querySelector(".ranking-value");
        const value = valueElement?.textContent?.trim();
        const bar = item.querySelector(".ranking-main i");
        if (!name || !value || !valueElement || !bar) return;
        bar.title = `${name}: ${value}`;
        bar.setAttribute("aria-label", `${name}: ${value}`);
      });
    };
    const prepareAlert = (alert) => {
      if (alert.dataset.autoDismissPrepared) return;
      alert.dataset.autoDismissPrepared = "true";
      let dismiss = alert.querySelector(".btn-close");
      if (!dismiss) {
        dismiss = document.createElement("button");
        dismiss.className = "btn-close";
        dismiss.type = "button";
        dismiss.setAttribute("aria-label", "Cerrar mensaje");
        dismiss.addEventListener("click", () => alert.remove(), { once: true });
        alert.append(dismiss);
      }
      timers.set(alert, window.setTimeout(() => {
        if (alert.isConnected) dismiss.click();
      }, 5000));
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(alertSelector)) prepareAlert(node);
        node.querySelectorAll?.(alertSelector).forEach(prepareAlert);
      }));
      prepareChartTooltips();
    });
    document.querySelectorAll(alertSelector).forEach(prepareAlert);
    prepareChartTooltips();
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (customer) return <SessionInactivityGuard onTimeout={closeSession}><Shop customer={customer} onLogout={closeSession} /></SessionInactivityGuard>;
  if (view === "admin-dashboard") return <SessionInactivityGuard onTimeout={closeSession}><AdminDashboard onLogout={closeSession} /></SessionInactivityGuard>;
  if (view === "admin-access") return <AdminAccess onLogin={() => setView("admin-dashboard")} onCustomerAccess={() => setView("customer-access")} />;
  return <Access onAccess={setCustomer} onAdminAccess={() => setView("admin-access")} />;
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
