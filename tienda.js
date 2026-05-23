/* ═══════════════════════════════════════════════════════════
   TIENDA TELEACTIVA — Lógica Frontend
   Puerto: 3031
   ═══════════════════════════════════════════════════════════ */

'use strict';

// Usa el mismo host desde donde se sirve la página (localhost o IP de red)
const API = `${window.location.protocol}//${window.location.hostname}:3031/api`;

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────

const estado = {
  usuario: null,
  esAdmin: false,
  productos: [],
  categoriaActiva: 'todos',
  busqueda: '',
  carrito: [],           // [{ producto, cantidad }]
  pedidos: [],
  adminSubTab: 'pedidos', // 'pedidos' | 'productos' | 'categorias' | 'usuarios'
  usuarios: [],
  categorias: [],
  adminToken: null
};

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function fetchJSON(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (estado.adminToken) headers['x-admin-token'] = estado.adminToken;
  const res = await fetch(url, { headers, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

function formatPrecio(n) {
  return `S/ ${parseFloat(n).toFixed(2)}`;
}

function fechaCorta(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
       + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

async function inicializarLogin() {
  const sel = document.getElementById('sel-usuario');
  const btnIngresar = document.getElementById('btn-ingresar');
  sel.innerHTML = '<option value="">⏳ Cargando usuarios...</option>';
  if (btnIngresar) btnIngresar.disabled = true;

  let usuarios = [];
  let ok = false;

  // Reintentar hasta 3 veces con 1s de espera entre intentos
  for (let intento = 1; intento <= 3; intento++) {
    try {
      usuarios = await fetchJSON(`${API}/usuarios`);
      ok = true;
      break;
    } catch (e) {
      if (intento < 3) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (!ok) {
    sel.innerHTML = '<option value="">⚠ No se pudo conectar al servidor</option>';
    if (btnIngresar) btnIngresar.disabled = false;
    // Mostrar botón de reintento
    let btnRetry = document.getElementById('btn-retry-login');
    if (!btnRetry) {
      btnRetry = document.createElement('button');
      btnRetry.id = 'btn-retry-login';
      btnRetry.className = 'btn-outline';
      btnRetry.style.marginTop = '.5rem';
      btnRetry.textContent = '🔄 Reintentar conexión';
      btnRetry.addEventListener('click', () => {
        btnRetry.remove();
        inicializarLogin();
      });
      sel.parentNode.insertBefore(btnRetry, sel.nextSibling);
    }
    return;
  }

  // Limpiar botón de reintento si existía
  const btnRetry = document.getElementById('btn-retry-login');
  if (btnRetry) btnRetry.remove();

  sel.innerHTML = '<option value="">— Seleccionar —</option>';
  usuarios.forEach(u => {
    const op = document.createElement('option');
    op.value = u;
    op.textContent = u;
    sel.appendChild(op);
  });

  if (btnIngresar) btnIngresar.disabled = false;
}

async function iniciarSesion() {
  const sel = document.getElementById('sel-usuario');
  const usuario = sel.value;
  if (!usuario) return toast('Selecciona un usuario', 'error');

  if (usuario === 'Admin') {
    abrirModalClave();
    return; // continúa en confirmarClave()
  }

  estado.usuario = usuario;
  mostrarApp();
}

function abrirModalClave() {
  document.getElementById('inp-clave-admin').value = '';
  document.getElementById('error-clave-admin').textContent = '';
  document.getElementById('btn-confirmar-clave').disabled = false;
  document.getElementById('overlay-modal-clave').classList.add('visible');
  setTimeout(() => document.getElementById('inp-clave-admin').focus(), 100);
}

function cerrarModalClave() {
  document.getElementById('overlay-modal-clave').classList.remove('visible');
}

async function confirmarClave() {
  const inp = document.getElementById('inp-clave-admin');
  const clave = inp.value;
  const errorEl = document.getElementById('error-clave-admin');
  const btn = document.getElementById('btn-confirmar-clave');

  if (!clave) {
    errorEl.textContent = 'Ingresa la clave.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verificando...';
  errorEl.textContent = '';

  try {
    const res = await fetchJSON(`${API}/admin/verificar-clave`, {
      method: 'POST',
      body: JSON.stringify({ clave })
    });
    estado.adminToken = res.token;
    estado.esAdmin = true;
    inp.value = '';
    cerrarModalClave();
    estado.usuario = 'Admin';
    mostrarApp();
  } catch (e) {
    errorEl.textContent = e.message;
    btn.disabled = false;
    btn.textContent = 'Ingresar';
    inp.value = '';
    inp.focus();
  }
}

async function crearPerfil() {
  const inp = document.getElementById('inp-nuevo-usuario');
  const nombre = inp.value.trim();
  if (!nombre) return toast('Escribe un nombre', 'error');
  if (nombre === 'Admin') return toast('Nombre reservado', 'error');

  try {
    await fetchJSON(`${API}/usuarios`, {
      method: 'POST',
      body: JSON.stringify({ nombre })
    });
    inp.value = '';
    document.getElementById('form-nuevo-usuario').style.display = 'none';
    await inicializarLogin();
    document.getElementById('sel-usuario').value = nombre;
    toast(`Perfil "${nombre}" creado ✓`, 'exito');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function mostrarApp() {
  // Persistir sesión para sobrevivir recargas
  sessionStorage.setItem('ts_usuario', estado.usuario);
  sessionStorage.setItem('ts_esAdmin', estado.esAdmin ? '1' : '');
  if (estado.adminToken) sessionStorage.setItem('ts_adminToken', estado.adminToken);

  document.getElementById('pantalla-login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('nombre-usuario').textContent = estado.usuario;
  document.getElementById('avatar-letra').textContent = estado.usuario[0].toUpperCase();

  if (estado.esAdmin) {
    document.getElementById('tab-admin').style.display = 'flex';
  }

  cargarProductos();
}

function cerrarSesion() {
  // Notificar al servidor para invalidar el token
  if (estado.adminToken) {
    fetchJSON(`${API}/admin/logout`, { method: 'POST' }).catch(() => {});
    estado.adminToken = null;
  }
  sessionStorage.removeItem('ts_usuario');
  sessionStorage.removeItem('ts_esAdmin');
  sessionStorage.removeItem('ts_adminToken');
  sessionStorage.removeItem('ts_vistaAdmin');
  sessionStorage.removeItem('ts_adminSubTab');
  estado.usuario   = null;
  estado.esAdmin   = false;
  estado.carrito   = [];
  estado.categoriaActiva = 'todos';
  estado.busqueda  = '';
  actualizarBadgeCarrito();

  document.getElementById('app').style.display = 'none';
  document.getElementById('pantalla-login').style.display = 'flex';
  document.getElementById('tab-admin').style.display = 'none';
  inicializarLogin();
  mostrarVista('tienda');
}

// ─── VISTAS (TIENDA / ADMIN) ──────────────────────────────────────────────────

function mostrarVista(vista) {
  sessionStorage.setItem('ts_vistaAdmin', vista === 'admin' ? '1' : '');
  document.getElementById('vista-tienda').style.display = vista === 'tienda' ? 'block' : 'none';
  document.getElementById('vista-admin').style.display  = vista === 'admin'  ? 'block' : 'none';

  document.getElementById('tab-tienda').classList.toggle('activo', vista === 'tienda');
  document.getElementById('tab-admin').classList.toggle('activo',  vista === 'admin');

  if (vista === 'admin') cargarDashboard();
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

async function cargarProductos() {
  try {
    [estado.productos, estado.categorias] = await Promise.all([
      fetchJSON(`${API}/productos`),
      fetchJSON(`${API}/categorias`)
    ]);
    construirFiltros();
    renderProductos();
  } catch {
    toast('Error cargando productos', 'error');
  }
}

// Construye label dinámico desde estado.categorias
function getCatLabel(id) {
  if (id === 'todos') return '🛒 Todos';
  const cat = estado.categorias.find(c => c.id === id);
  return cat ? cat.emoji + ' ' + cat.nombre : '• ' + id;
}
function getCatColor(id) {
  const cat = estado.categorias.find(c => c.id === id);
  return cat ? cat.color : '#6b7280';
}

function construirFiltros() {
  const cats = ['todos', ...new Set(estado.productos.map(p => p.categoria))];
  const wrap = document.getElementById('filtros-wrap');
  wrap.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `filtro-btn${cat === estado.categoriaActiva ? ' activo' : ''}`;
    btn.textContent = getCatLabel(cat);
    btn.dataset.cat = cat;
    btn.addEventListener('click', () => {
      estado.categoriaActiva = cat;
      document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      renderProductos();
    });
    wrap.appendChild(btn);
  });
}

function renderProductos() {
  const grid = document.getElementById('productos-grid');
  let lista = estado.productos;

  if (estado.categoriaActiva !== 'todos') {
    lista = lista.filter(p => p.categoria === estado.categoriaActiva);
  }

  if (estado.busqueda) {
    const q = estado.busqueda.toLowerCase();
    lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));
  }

  if (!lista.length) {
    grid.innerHTML = `<div class="sin-resultados"><span class="emoji">🔍</span>No hay productos que coincidan</div>`;
    return;
  }

  grid.innerHTML = lista.map(p => {
    const agotado = p.stock <= 0;
    return `
      <div class="producto-card">
        <div class="producto-img-wrap">
          <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='https://placehold.co/200x200/888/fff?text=Producto'">
        </div>
        <div class="producto-info">
          <span class="producto-categoria">${getCatLabel(p.categoria)}</span>
          <div class="producto-nombre">${p.nombre}</div>
          <div class="producto-precio">${formatPrecio(p.precio)}</div>
          <div class="producto-stock ${agotado ? 'agotado' : ''}">
            ${agotado ? '⚠ Sin stock' : `Stock: ${p.stock} unid.`}
          </div>
        </div>
        <button class="btn-agregar" ${agotado ? 'disabled' : ''} onclick="agregarAlCarrito(${p.id})">
          🛒 Agregar
        </button>
      </div>
    `;
  }).join('');
}

// ─── CARRITO ──────────────────────────────────────────────────────────────────

function agregarAlCarrito(productoId) {
  const producto = estado.productos.find(p => p.id === productoId);
  if (!producto || producto.stock <= 0) return;

  const item = estado.carrito.find(i => i.producto.id === productoId);
  const cantidadActual = item ? item.cantidad : 0;

  if (cantidadActual >= producto.stock) {
    toast('Stock máximo alcanzado', 'error');
    return;
  }

  if (item) {
    item.cantidad++;
  } else {
    estado.carrito.push({ producto, cantidad: 1 });
  }

  actualizarBadgeCarrito();
  toast(`${producto.nombre} agregado ✓`, 'exito');
}

function actualizarBadgeCarrito() {
  const total = estado.carrito.reduce((s, i) => s + i.cantidad, 0);
  const badge = document.getElementById('badge-carrito');
  badge.textContent = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function abrirCarrito() {
  renderCarrito();
  document.getElementById('overlay-carrito').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cerrarCarrito() {
  document.getElementById('overlay-carrito').classList.remove('visible');
  document.body.style.overflow = '';
}

function renderCarrito() {
  const contenedor = document.getElementById('carrito-items');
  const footer     = document.getElementById('carrito-footer');

  if (!estado.carrito.length) {
    contenedor.innerHTML = `
      <div class="carrito-vacio">
        <span class="emoji">🛒</span>
        Tu carrito está vacío
      </div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';

  contenedor.innerHTML = estado.carrito.map((item, idx) => `
    <div class="carrito-item">
      <img src="${item.producto.imagen}" alt="${item.producto.nombre}" onerror="this.src='https://placehold.co/50x50/888/fff?text=?'">
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.producto.nombre}</div>
        <div class="carrito-item-precio">${formatPrecio(item.producto.precio * item.cantidad)}</div>
      </div>
      <div class="carrito-item-controles">
        <button class="btn-cantidad" onclick="cambiarCantidad(${idx}, -1)">−</button>
        <span class="cantidad-num">${item.cantidad}</span>
        <button class="btn-cantidad" onclick="cambiarCantidad(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');

  const total = estado.carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  document.getElementById('carrito-total').textContent = formatPrecio(total);
}

function cambiarCantidad(idx, delta) {
  const item = estado.carrito[idx];
  item.cantidad += delta;

  if (item.cantidad <= 0) {
    estado.carrito.splice(idx, 1);
  } else if (item.cantidad > item.producto.stock) {
    item.cantidad = item.producto.stock;
    toast('Stock máximo alcanzado', 'error');
  }

  actualizarBadgeCarrito();
  renderCarrito();
}

async function confirmarPedido() {
  if (!estado.carrito.length) return;

  const items = estado.carrito.map(i => ({
    productoId: i.producto.id,
    nombre: i.producto.nombre,
    precio: i.producto.precio,
    cantidad: i.cantidad
  }));

  const total = estado.carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);

  try {
    const res = await fetchJSON(`${API}/pedidos`, {
      method: 'POST',
      body: JSON.stringify({ usuario: estado.usuario, items, total })
    });

    // Sincronizar stock actualizado desde el servidor
    if (res.productos) estado.productos = res.productos;

    estado.carrito = [];
    actualizarBadgeCarrito();
    cerrarCarrito();
    sincronizarTodasLasVistas();
    actualizarTitulo();
    toast('¡Pedido confirmado! 🎉', 'exito');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── DASHBOARD ADMIN ──────────────────────────────────────────────────────────

async function cargarDashboard() {
  try {
    [estado.pedidos, estado.usuarios, estado.categorias] = await Promise.all([
      fetchJSON(`${API}/pedidos`),
      fetchJSON(`${API}/usuarios`),
      fetchJSON(`${API}/categorias`)
    ]);
    await cargarProductos();
    renderDashboard();
  } catch (err) {
    console.error('[Dashboard]', err);
    toast('Error cargando dashboard: ' + err.message, 'error');
  }
}

function renderDashboard() {
  actualizarStats();
  if (estado.adminSubTab === 'pedidos') renderPedidos();
  else if (estado.adminSubTab === 'productos') renderAdminProductos();
  else if (estado.adminSubTab === 'categorias') renderAdminCategorias();
  else if (estado.adminSubTab === 'backups') renderAdminBackups();
  else renderAdminUsuarios();
}

// Propaga cambios a todas las secciones que consumen los mismos datos
function sincronizarTodasLasVistas() {
  // Siempre actualizar la tienda (productos/filtros)
  construirFiltros();
  renderProductos();
  // Si estamos en admin, re-renderizar la sub-vista activa
  if (estado.esAdmin && document.getElementById('vista-admin').style.display !== 'none') {
    actualizarStats();
    if (estado.adminSubTab === 'pedidos')    renderPedidos();
    else if (estado.adminSubTab === 'productos') renderAdminProductos();
    else if (estado.adminSubTab === 'categorias') renderAdminCategorias();
    else renderAdminUsuarios();
  }
}

function cambiarAdminTab(tab) {
  estado.adminSubTab = tab;
  sessionStorage.setItem('ts_adminSubTab', tab);
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('activo'));
  document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('activo');
  renderDashboard();
}

const TITULO_BASE = 'Tienda Teleactiva';

function actualizarTitulo() {
  const pendientes = estado.pedidos.filter(p => p.estado === 'pendiente').length;
  document.title = pendientes > 0 ? `(${pendientes}) ${TITULO_BASE}` : TITULO_BASE;
}

function actualizarStats() {
  const pedidos = estado.pedidos;
  document.getElementById('stat-total-pedidos').textContent = pedidos.length;
  document.getElementById('stat-pendientes').textContent = pedidos.filter(p => p.estado === 'pendiente').length;
  document.getElementById('stat-entregados').textContent = pedidos.filter(p => p.estado === 'entregado').length;
  const pedidosActivos = pedidos.filter(p => p.estado !== 'cancelado');
  const revenue = pedidosActivos.reduce((s, p) => s + p.total, 0);
  const ganancia = pedidosActivos.reduce((s, p) => {
    return s + p.items.reduce((si, i) => si + ((i.precio - (i.precioBase || 0)) * i.cantidad), 0);
  }, 0);
  document.getElementById('stat-revenue').textContent = formatPrecio(revenue);
  document.getElementById('stat-ganancia').textContent = formatPrecio(ganancia);
  actualizarTitulo();
}

// PEDIDOS

let filtroPedidoEstado = 'todos';

function renderPedidos() {
  const contenedor = document.getElementById('admin-pedidos');
  contenedor.style.display = 'block';
  document.getElementById('admin-productos').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-categorias').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-usuarios').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';

  let lista = estado.pedidos;
  if (filtroPedidoEstado !== 'todos') {
    lista = lista.filter(p => p.estado === filtroPedidoEstado);
  }

  // Ordenar: pendientes primero
  lista = [...lista].sort((a, b) => {
    const orden = { pendiente: 0, entregado: 1, cancelado: 2 };
    return (orden[a.estado] - orden[b.estado]) || new Date(b.fecha) - new Date(a.fecha);
  });

  const tbody = document.getElementById('tbody-pedidos');

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia">No hay pedidos</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const itemsHTML = p.items.map(i => {
      const subtotal = formatPrecio(i.precio * i.cantidad);
      return '<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">'
        + '<span style="background:var(--gris-2);border-radius:6px;padding:.2rem .5rem;font-size:.78rem;font-weight:700;color:var(--oscuro);white-space:nowrap">x' + i.cantidad + '</span>'
        + '<span style="font-size:.82rem;color:var(--oscuro)">' + i.nombre + '</span>'
        + '<span style="font-size:.78rem;color:var(--verde);font-weight:600;margin-left:auto;white-space:nowrap;padding-left:.5rem">' + subtotal + '</span>'
        + '</div>';
    }).join('');

    const badge = {
      pendiente: '<span class="badge badge-pendiente">⏳ Pendiente</span>',
      entregado: '<span class="badge badge-entregado">✅ Entregado</span>',
      cancelado: '<span class="badge badge-cancelado">❌ Cancelado</span>'
    }[p.estado];

    const btnPagado = p.pagado
      ? '<span class="badge" style="background:#d1fae5;color:#065f46">💰 Pagado</span>'
      : `<button class="btn-estado" onclick="marcarPagado(${p.id})" style="border-color:#f59e0b;color:#92400e">💰 Pagado</button>`;

    const totalBase = p.items.reduce((s, i) => s + (i.precioBase || 0) * i.cantidad, 0);
    const itemsBaseHTML = p.items.map(i => {
      const base = i.precioBase || 0;
      return '<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">'
        + '<span style="background:var(--gris-2);border-radius:6px;padding:.2rem .5rem;font-size:.78rem;font-weight:700;color:var(--oscuro);white-space:nowrap">x' + i.cantidad + '</span>'
        + '<span style="font-size:.78rem;color:var(--gris-texto)">' + i.nombre + '</span>'
        + '<span style="font-size:.78rem;color:#92400e;font-weight:600;margin-left:auto;white-space:nowrap;padding-left:.5rem">' + formatPrecio(base * i.cantidad) + '</span>'
        + '</div>';
    }).join('')
      + '<div style="border-top:1px solid var(--gris-3);margin-top:.3rem;padding-top:.3rem;text-align:right;font-size:.78rem;font-weight:700;color:#92400e">'
      + 'Total base: ' + formatPrecio(totalBase) + '</div>';

    const acciones = p.estado === 'pendiente'
      ? `<div style="display:flex;flex-direction:column;gap:.3rem">
           <button class="btn-estado" onclick="cambiarEstadoPedido(${p.id},'entregado')">✅ Entregar</button>
           <button class="btn-estado cancelar" onclick="cambiarEstadoPedido(${p.id},'cancelado')">❌ Cancelar</button>
           ${btnPagado}
         </div>`
      : `<div style="display:flex;flex-direction:column;gap:.3rem">${btnPagado}</div>`;

    return `
      <tr>
        <td><strong>#${p.id}</strong></td>
        <td>${p.usuario}</td>
        <td style="min-width:220px">${itemsHTML}</td>
        <td style="min-width:190px">${itemsBaseHTML}</td>
        <td><strong>${formatPrecio(p.total)}</strong></td>
        <td>${badge}</td>
        <td>${fechaCorta(p.fecha)}</td>
        <td>${acciones}</td>
      </tr>
    `;
  }).join('');
}

async function cambiarEstadoPedido(id, nuevoEstado) {
  try {
    const res = await fetchJSON(`${API}/pedidos/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevoEstado })
    });
    const idx = estado.pedidos.findIndex(p => p.id === id);
    estado.pedidos[idx].estado = res.pedido.estado;
    // Sincronizar productos (stock actualizado por el servidor)
    if (res.productos) {
      estado.productos = res.productos;
    }
    actualizarStats();
    sincronizarTodasLasVistas();
    toast(`Pedido #${id} marcado como ${nuevoEstado}`, 'exito');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function marcarPagado(id) {
  try {
    await fetchJSON(`${API}/pedidos/${id}/pagado`, { method: 'PUT' });
    const idx = estado.pedidos.findIndex(p => p.id === id);
    estado.pedidos[idx].pagado = true;
    sincronizarTodasLasVistas();
    toast(`Pedido #${id} marcado como pagado 💰`, 'exito');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// GESTIÓN PRODUCTOS

function renderAdminProductos() {
  document.getElementById('admin-pedidos').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-categorias').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-usuarios').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  const contenedor = document.getElementById('admin-productos');
  contenedor.style.display = 'block';

  const tbody = document.getElementById('tbody-admin-productos');

  if (!estado.productos.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia">No hay productos</td></tr>`;
    return;
  }

  tbody.innerHTML = estado.productos.map(p => `
    <tr>
      <td>
        <img src="${p.imagen}" style="width:36px;height:36px;object-fit:contain;border-radius:6px;background:var(--gris-2);padding:2px" 
             onerror="this.src='https://placehold.co/36x36/888/fff?text=?'">
      </td>
      <td><strong>${p.nombre}</strong></td>
      <td><span style="background:var(--verde-bg);color:#166534;padding:.2rem .6rem;border-radius:50px;font-size:.73rem;font-weight:700">${getCatLabel(p.categoria)}</span></td>
      <td style="color:#92400e;font-weight:600">${formatPrecio(p.precioBase || 0)}</td>
      <td><strong>${formatPrecio(p.precio)}</strong></td>
      <td>${p.stock}</td>
      <td>
        <button class="btn-edit" onclick="abrirModalProducto(${p.id})">✏️ Editar</button>
        <button class="btn-del" onclick="eliminarProducto(${p.id})">🗑 Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// Modal producto

function abrirModalProducto(productoId = null) {
  const modal = document.getElementById('overlay-modal-producto');
  const form  = document.getElementById('form-producto');
  const titulo = document.getElementById('modal-producto-titulo');

  form.reset();
  form.dataset.editando = productoId || '';

  // Poblar select de categorías dinámicamente
  const selCat = document.getElementById('prod-categoria');
  selCat.innerHTML = '<option value="">— Seleccionar —</option>';
  estado.categorias.forEach(c => {
    const op = document.createElement('option');
    op.value = c.id;
    op.textContent = c.emoji + ' ' + c.nombre;
    selCat.appendChild(op);
  });

  if (productoId) {
    titulo.textContent = 'Editar Producto';
    const p = estado.productos.find(pr => pr.id === productoId);
    document.getElementById('prod-nombre').value       = p.nombre;
    document.getElementById('prod-categoria').value    = p.categoria;
    document.getElementById('prod-precio-base').value  = p.precioBase || '';
    document.getElementById('prod-precio').value       = p.precio;
    document.getElementById('prod-stock').value        = p.stock;
    document.getElementById('prod-imagen').value       = p.imagen;
  } else {
    titulo.textContent = 'Nuevo Producto';
  }

  modal.classList.add('visible');
}

function cerrarModalProducto() {
  document.getElementById('overlay-modal-producto').classList.remove('visible');
}

async function guardarProducto() {
  const form   = document.getElementById('form-producto');
  const editId = form.dataset.editando;

  const datos = {
    nombre:     document.getElementById('prod-nombre').value.trim(),
    categoria:  document.getElementById('prod-categoria').value.trim(),
    precioBase: parseFloat(document.getElementById('prod-precio-base').value),
    precio:     parseFloat(document.getElementById('prod-precio').value),
    stock:      parseInt(document.getElementById('prod-stock').value),
    imagen:     document.getElementById('prod-imagen').value.trim() || undefined
  };

  if (!datos.nombre || !datos.categoria || isNaN(datos.precioBase) || isNaN(datos.precio)) {
    return toast('Completa los campos requeridos', 'error');
  }
  if (datos.precioBase >= datos.precio) {
    return toast('El precio base debe ser menor al precio de venta', 'error');
  }

  try {
    if (editId) {
      const updated = await fetchJSON(`${API}/productos/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(datos)
      });
      const idx = estado.productos.findIndex(p => p.id === parseInt(editId));
      estado.productos[idx] = updated;
      toast('Producto actualizado ✓', 'exito');
    } else {
      const nuevo = await fetchJSON(`${API}/productos`, {
        method: 'POST',
        body: JSON.stringify(datos)
      });
      estado.productos.push(nuevo);
      toast('Producto creado ✓', 'exito');
    }

    cerrarModalProducto();
    sincronizarTodasLasVistas();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    await fetchJSON(`${API}/productos/${id}`, { method: 'DELETE' });
    estado.productos = estado.productos.filter(p => p.id !== id);
    toast('Producto eliminado', 'exito');
    sincronizarTodasLasVistas();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── GESTIÓN CATEGORIAS ──────────────────────────────────────────────────────

function renderAdminCategorias() {
  document.getElementById('admin-pedidos').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-productos').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-usuarios').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  const contenedor = document.getElementById('admin-categorias');
  contenedor.style.display = 'block';

  const tbody = document.getElementById('tbody-admin-categorias');
  const lista = estado.categorias;

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tabla-vacia">No hay categorías</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  lista.forEach(c => {
    const enUso = estado.productos.filter(p => p.categoria === c.id).length;
    const tr = document.createElement('tr');

    // Emoji
    const tdEmoji = document.createElement('td');
    tdEmoji.innerHTML = '<span style="font-size:1.5rem">' + c.emoji + '</span>';
    tr.appendChild(tdEmoji);

    // Nombre
    const tdNombre = document.createElement('td');
    tdNombre.innerHTML = '<strong>' + c.nombre + '</strong>';
    tr.appendChild(tdNombre);

    // Color
    const tdColor = document.createElement('td');
    tdColor.innerHTML = '<span style="display:inline-flex;align-items:center;gap:.4rem">'
      + '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + c.color + ';border:1px solid rgba(0,0,0,.1)"></span>'
      + '<code style="font-size:.78rem;color:var(--gris-texto)">' + c.color + '</code>'
      + '</span>';
    tr.appendChild(tdColor);

    // En uso
    const tdUso = document.createElement('td');
    tdUso.innerHTML = '<span style="background:var(--gris-2);padding:.2rem .7rem;border-radius:50px;font-size:.78rem;font-weight:700">'
      + enUso + ' producto' + (enUso !== 1 ? 's' : '') + '</span>';
    tr.appendChild(tdUso);

    // Acciones
    const tdAcc = document.createElement('td');
    tdAcc.style.whiteSpace = 'nowrap';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '✏️ Editar';
    btnEdit.addEventListener('click', () => abrirModalCategoria(c.id));
    tdAcc.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del';
    btnDel.textContent = '🗑 Eliminar';
    if (enUso > 0) {
      btnDel.disabled = true;
      btnDel.title = 'Tiene productos asignados';
      btnDel.style.opacity = '.4';
      btnDel.style.cursor = 'not-allowed';
    }
    btnDel.addEventListener('click', () => eliminarCategoria(c.id));
    tdAcc.appendChild(btnDel);

    tr.appendChild(tdAcc);
    tbody.appendChild(tr);
  });
}

function abrirModalCategoria(catId = null) {
  const modal = document.getElementById('overlay-modal-categoria');
  const form  = document.getElementById('form-categoria');
  const titulo = document.getElementById('modal-categoria-titulo');
  form.reset();
  form.dataset.editando = catId || '';
  actualizarPreviewCategoria();

  if (catId) {
    titulo.textContent = 'Editar Categoría';
    const c = estado.categorias.find(cat => cat.id === catId);
    document.getElementById('cat-nombre').value = c.nombre;
    document.getElementById('cat-emoji').value  = c.emoji;
    document.getElementById('cat-color').value  = c.color;
    actualizarPreviewCategoria();
  } else {
    titulo.textContent = 'Nueva Categoría';
  }

  modal.classList.add('visible');
  setTimeout(() => document.getElementById('cat-nombre').focus(), 100);
}

function cerrarModalCategoria() {
  document.getElementById('overlay-modal-categoria').classList.remove('visible');
}

function actualizarPreviewCategoria() {
  const emoji  = document.getElementById('cat-emoji').value  || '📦';
  const nombre = document.getElementById('cat-nombre').value || 'Categoría';
  const color  = document.getElementById('cat-color').value  || '#6b7280';
  const prev   = document.getElementById('cat-preview');
  prev.textContent = emoji + ' ' + nombre;
  prev.style.background = color + '22';
  prev.style.color = color;
  prev.style.borderColor = color + '55';
}

async function guardarCategoria() {
  const form   = document.getElementById('form-categoria');
  const editId = form.dataset.editando;
  const datos  = {
    nombre: document.getElementById('cat-nombre').value.trim(),
    emoji:  document.getElementById('cat-emoji').value.trim() || '📦',
    color:  document.getElementById('cat-color').value
  };
  if (!datos.nombre) return toast('El nombre es requerido', 'error');

  try {
    if (editId) {
      const updated = await fetchJSON(`${API}/categorias/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(datos)
      });
      const idx = estado.categorias.findIndex(c => c.id === editId);
      estado.categorias[idx] = updated;
      toast('Categoría actualizada ✓', 'exito');
    } else {
      const nueva = await fetchJSON(`${API}/categorias`, {
        method: 'POST',
        body: JSON.stringify(datos)
      });
      estado.categorias.push(nueva);
      toast('Categoría creada ✓', 'exito');
    }
    cerrarModalCategoria();
    sincronizarTodasLasVistas();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function eliminarCategoria(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  try {
    await fetchJSON(`${API}/categorias/${id}`, { method: 'DELETE' });
    estado.categorias = estado.categorias.filter(c => c.id !== id);
    construirFiltros();
    renderAdminCategorias();
    toast('Categoría eliminada', 'exito');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── GESTIÓN USUARIOS ────────────────────────────────────────────────────────

function renderAdminUsuarios() {
  document.getElementById('admin-pedidos').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-productos').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  document.getElementById('admin-categorias').style.display = 'none';
  document.getElementById('admin-backups').style.display = 'none';
  const contenedor = document.getElementById('admin-usuarios');
  contenedor.style.display = 'block';

  const tbody = document.getElementById('tbody-admin-usuarios');
  const lista = estado.usuarios;

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="tabla-vacia">No hay usuarios</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(u => {
    const esAdmin = u === 'Admin';
    return '<tr>'
      + '<td>'
        + '<div style="display:flex;align-items:center;gap:.6rem">'
          + '<div class="avatar" style="width:30px;height:30px;font-size:.8rem;flex-shrink:0">' + u[0].toUpperCase() + '</div>'
          + '<strong>' + u + '</strong>'
        + '</div>'
      + '</td>'
      + '<td>'
        + (esAdmin
          ? '<span class="badge" style="background:#fef3c7;color:#92400e">👑 Admin</span>'
          : '<span class="badge" style="background:var(--gris-2);color:var(--gris-texto)">👤 Usuario</span>')
      + '</td>'
      + '<td>'
        + (esAdmin
          ? '<span style="color:var(--gris-texto);font-size:.8rem">—</span>'
          : '<button class="btn-del" onclick="eliminarUsuario(\'' + u + '\')">🗑 Eliminar</button>')
      + '</td>'
      + '</tr>';
  }).join('');
}

async function eliminarUsuario(nombre) {
  if (!confirm('¿Eliminar al usuario "' + nombre + '"? Sus pedidos existentes no se eliminarán.')) return;
  try {
    await fetchJSON(`${API}/usuarios/${encodeURIComponent(nombre)}`, { method: 'DELETE' });
    estado.usuarios = estado.usuarios.filter(u => u !== nombre);
    renderAdminUsuarios();
    toast('Usuario "' + nombre + '" eliminado', 'exito');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── GESTIÓN BACKUPS ─────────────────────────────────────────────────────────

async function renderAdminBackups() {
  ['admin-pedidos','admin-productos','admin-categorias','admin-usuarios'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  const contenedor = document.getElementById('admin-backups');
  contenedor.style.display = 'block';

  const tbody = document.getElementById('tbody-backups');
  tbody.innerHTML = '<tr><td colspan="5" class="tabla-vacia">⏳ Cargando backups...</td></tr>';

  let lista = [];
  try {
    lista = await fetchJSON(`${API}/backups`);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="tabla-vacia">Error: ${e.message}</td></tr>`;
    return;
  }

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tabla-vacia">No hay backups aún</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  lista.forEach(b => {
    const motivo = b.nombre.match(/_([a-z-]+)\.json$/)?.[1] || '—';
    const motivoLabel = {
      'manual': '🖐 Manual',
      'auto': '⏱ Automático',
      'inicio': '🚀 Inicio servidor',
      'pre-restauracion': '🔄 Pre-restauración'
    }[motivo] || motivo;

    const fecha  = new Date(b.fecha).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const kb = (b.tamaño / 1024).toFixed(1) + ' KB';

    const tr = document.createElement('tr');

    const tdNombre = document.createElement('td');
    tdNombre.innerHTML = '<code style="font-size:.75rem;color:var(--gris-texto)">' + b.nombre + '</code>';
    tr.appendChild(tdNombre);

    const tdMotivo = document.createElement('td');
    tdMotivo.textContent = motivoLabel;
    tr.appendChild(tdMotivo);

    const tdFecha = document.createElement('td');
    tdFecha.textContent = fecha;
    tr.appendChild(tdFecha);

    const tdSize = document.createElement('td');
    tdSize.textContent = kb;
    tr.appendChild(tdSize);

    const tdAcc = document.createElement('td');
    tdAcc.style.whiteSpace = 'nowrap';

    const btnRestore = document.createElement('button');
    btnRestore.className = 'btn-edit';
    btnRestore.textContent = '🔄 Restaurar';
    btnRestore.addEventListener('click', () => restaurarBackup(b.nombre));
    tdAcc.appendChild(btnRestore);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del';
    btnDel.textContent = '🗑 Eliminar';
    btnDel.addEventListener('click', () => eliminarBackup(b.nombre));
    tdAcc.appendChild(btnDel);

    tr.appendChild(tdAcc);
    tbody.appendChild(tr);
  });
}

async function crearBackupManual() {
  const btn = document.getElementById('btn-crear-backup');
  btn.disabled = true;
  btn.textContent = '⏳ Creando...';
  try {
    const res = await fetchJSON(`${API}/backups`, { method: 'POST' });
    toast(`Backup creado: ${res.nombre}`, 'exito');
    renderAdminBackups();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Crear backup ahora';
  }
}

async function restaurarBackup(nombre) {
  if (!confirm(`¿Restaurar el backup "${nombre}"?\n\nEl estado actual se guardará como pre-restauración antes de sobreescribir.`)) return;
  try {
    await fetchJSON(`${API}/backups/restaurar`, {
      method: 'POST',
      body: JSON.stringify({ nombre })
    });
    toast('✅ Backup restaurado. Recargando datos...', 'exito');
    // Recargar todos los datos del servidor
    await cargarDashboard();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function eliminarBackup(nombre) {
  if (!confirm(`¿Eliminar el backup "${nombre}"?`)) return;
  try {
    await fetchJSON(`${API}/backups/${encodeURIComponent(nombre)}`, { method: 'DELETE' });
    toast('Backup eliminado', 'exito');
    renderAdminBackups();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── BÚSQUEDA ─────────────────────────────────────────────────────────────────

function onBusqueda(e) {
  estado.busqueda = e.target.value.trim();
  renderProductos();
}

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── REGISTRAR TODOS LOS LISTENERS SIEMPRE (independiente de sesión) ──────

  // Login
  document.getElementById('btn-ingresar').addEventListener('click', iniciarSesion);
  document.getElementById('btn-nuevo-perfil').addEventListener('click', () => {
    const f = document.getElementById('form-nuevo-usuario');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btn-crear-usuario').addEventListener('click', crearPerfil);

  // App
  document.getElementById('btn-cerrar-sesion').addEventListener('click', cerrarSesion);
  document.getElementById('btn-carrito').addEventListener('click', abrirCarrito);
  document.getElementById('btn-cerrar-carrito').addEventListener('click', cerrarCarrito);
  document.getElementById('btn-confirmar-pedido').addEventListener('click', confirmarPedido);

  document.getElementById('overlay-carrito').addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarCarrito();
  });

  // Tabs
  document.getElementById('tab-tienda').addEventListener('click', () => mostrarVista('tienda'));
  document.getElementById('tab-admin').addEventListener('click', () => mostrarVista('admin'));

  // Búsqueda
  document.getElementById('buscador').addEventListener('input', onBusqueda);

  // Admin sub-tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => cambiarAdminTab(tab.dataset.tab));
  });

  // Filtro estado pedidos
  document.querySelectorAll('.filtro-pedido-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroPedidoEstado = btn.dataset.estado;
      document.querySelectorAll('.filtro-pedido-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      renderPedidos();
    });
  });

  // Modal producto
  document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
  document.getElementById('btn-cancelar-producto').addEventListener('click', cerrarModalProducto);
  document.getElementById('btn-guardar-producto').addEventListener('click', guardarProducto);
  document.getElementById('overlay-modal-producto').addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarModalProducto();
  });

  // Backups
  document.getElementById('btn-crear-backup').addEventListener('click', crearBackupManual);

  // Modal categoría
  document.getElementById('btn-nueva-categoria').addEventListener('click', () => abrirModalCategoria());
  document.getElementById('btn-cancelar-categoria').addEventListener('click', cerrarModalCategoria);
  document.getElementById('btn-guardar-categoria').addEventListener('click', guardarCategoria);
  document.getElementById('overlay-modal-categoria').addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarModalCategoria();
  });
  ['cat-emoji','cat-nombre','cat-color'].forEach(id => {
    document.getElementById(id).addEventListener('input', actualizarPreviewCategoria);
  });

  // Modal clave admin
  document.getElementById('btn-confirmar-clave').addEventListener('click', confirmarClave);
  document.getElementById('btn-cancelar-clave').addEventListener('click', cerrarModalClave);
  document.getElementById('inp-clave-admin').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmarClave();
    if (e.key === 'Escape') cerrarModalClave();
  });

  // ── RESTAURAR SESIÓN O MOSTRAR LOGIN ─────────────────────────────────────

  const usuarioGuardado = sessionStorage.getItem('ts_usuario');
  const esAdminGuardado = sessionStorage.getItem('ts_esAdmin') === '1';
  const tokenGuardado   = sessionStorage.getItem('ts_adminToken');
  const vistaAdmin      = sessionStorage.getItem('ts_vistaAdmin') === '1';
  const subTabGuardado  = sessionStorage.getItem('ts_adminSubTab') || 'pedidos';

  if (usuarioGuardado) {
    if (esAdminGuardado && tokenGuardado) {
      try {
        await fetchJSON(`${API}/admin/verificar-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': tokenGuardado }
        });
        estado.adminToken = tokenGuardado;
        estado.esAdmin = true;
      } catch {
        sessionStorage.removeItem('ts_adminToken');
        sessionStorage.removeItem('ts_esAdmin');
      }
    }
    estado.usuario = usuarioGuardado;
    estado.adminSubTab = subTabGuardado;
    mostrarApp();
    if (vistaAdmin && estado.esAdmin) {
      mostrarVista('admin');
    }
  } else {
    inicializarLogin();
  }
});
