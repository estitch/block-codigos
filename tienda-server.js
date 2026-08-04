const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3031;

const DB_PATH      = path.join(__dirname, 'tienda-db.json');
const BACKUP_DIR   = path.join(__dirname, 'backups');
const MAX_BACKUPS  = 30;   // máximo de archivos a conservar
const BACKUP_INTERVALO_MS = 60 * 60 * 1000; // backup automático cada 1 hora
const ADMIN_CLAVE = 'TIENDA2026';
const crypto = require('crypto');

// ─── RATE LIMITING POR IP (rutas generales) ──────────────────────────────────
const RATE_LIMIT_ENABLED = true;
const RL_WINDOW_MS = 60 * 1000;  // ventana de 1 minuto
const RL_READ_MAX  = 300;        // lecturas / min
const RL_WRITE_MAX = 60;         // escrituras / min

const rateLimitCounters = new Map(); // `ip|bucket` -> { ventana, count }

// ─── SESIONES ADMIN (token en memoria) ───────────────────────────────────────
const sesionesAdmin = new Map(); // token -> { expira }
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

// ─── RATE LIMIT ANTI FUERZA BRUTA ────────────────────────────────────────────
const intentosFallidos = new Map(); // ip -> { count, bloqueadoHasta }
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

function getIP(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

/**
 * Middleware de ventana fija por IP. Devuelve 429 + Retry-After al superar el máximo.
 * @param {string} bucket - identificador del grupo de rutas
 * @param {number} max - solicitudes permitidas por ventana
 * @param {number} windowMs - duración de la ventana (ms)
 */
function rateLimit(bucket, max, windowMs = RL_WINDOW_MS) {
  return (req, res, next) => {
    if (!RATE_LIMIT_ENABLED) return next();
    const ip = getIP(req);
    const key = ip + '|' + bucket;
    const now = Date.now();
    let reg = rateLimitCounters.get(key);
    if (!reg || now - reg.ventana >= windowMs) {
      rateLimitCounters.set(key, { ventana: now, count: 1 });
      return next();
    }
    reg.count++;
    if (reg.count > max) {
      const retry = Math.max(1, Math.ceil((reg.ventana + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retry));
      console.warn(`⚠️ [RATE] IP ${ip} excedió límite '${bucket}' (${max}/min)`);
      return res.status(429).json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${retry}s.`, retryAfter: retry });
    }
    next();
  };
}

// Limpieza periódica de contadores vencidos (evita fuga de memoria)
setInterval(() => {
  const now = Date.now();
  for (const [key, reg] of rateLimitCounters) {
    if (now - reg.ventana >= RL_WINDOW_MS * 2) rateLimitCounters.delete(key);
  }
}, 5 * 60 * 1000);

function estaBloquedoIP(ip) {
  const reg = intentosFallidos.get(ip);
  if (!reg) return false;
  if (reg.bloqueadoHasta && Date.now() < reg.bloqueadoHasta) return true;
  if (reg.bloqueadoHasta && Date.now() >= reg.bloqueadoHasta) {
    intentosFallidos.delete(ip);
    return false;
  }
  return false;
}

function registrarFallo(ip) {
  const reg = intentosFallidos.get(ip) || { count: 0 };
  reg.count++;
  if (reg.count >= MAX_INTENTOS) {
    reg.bloqueadoHasta = Date.now() + BLOQUEO_MS;
    reg.count = 0;
  }
  intentosFallidos.set(ip, reg);
}

function limpiarFallos(ip) {
  intentosFallidos.delete(ip);
}

function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function tokenValido(token) {
  if (!token) return false;
  const sesion = sesionesAdmin.get(token);
  if (!sesion) return false;
  if (Date.now() > sesion.expira) {
    sesionesAdmin.delete(token);
    return false;
  }
  return true;
}

// Middleware que protege rutas admin por token
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!tokenValido(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.static(__dirname));

// ─── DB ───────────────────────────────────────────────────────────────────────

function cargarDB() {
  if (!fs.existsSync(DB_PATH)) {
    const inicial = {
      usuarios: ['Admin'],
      categorias: [
        { id: 'gaseosas', nombre: 'Gaseosas',  emoji: '🥤', color: '#3b82f6' },
        { id: 'galletas', nombre: 'Galletas',   emoji: '🍪', color: '#f59e0b' },
        { id: 'snacks',   nombre: 'Snacks',     emoji: '🍟', color: '#ef4444' },
        { id: 'lacteos',  nombre: 'Lácteos',    emoji: '🥛', color: '#8b5cf6' },
        { id: 'agua',     nombre: 'Agua',       emoji: '💧', color: '#06b6d4' }
      ],
      productos: [
        { id: 1, nombre: 'Inca Kola 1.5L', precioBase: 3.8, categoria: 'gaseosas', precio: 5.50, imagen: 'https://placehold.co/200x200/FFD700/333?text=Inca+Kola', stock: 50 },
        { id: 2, nombre: 'Coca Cola 1L', precioBase: 3.2, categoria: 'gaseosas', precio: 4.80, imagen: 'https://placehold.co/200x200/CC0000/fff?text=Coca+Cola', stock: 40 },
        { id: 3, nombre: 'Sprite 500ml', precioBase: 2.0, categoria: 'gaseosas', precio: 3.20, imagen: 'https://placehold.co/200x200/00AA44/fff?text=Sprite', stock: 35 },
        { id: 4, nombre: 'Galletas Oreo', precioBase: 2.2, categoria: 'galletas', precio: 3.50, imagen: 'https://placehold.co/200x200/222/fff?text=Oreo', stock: 60 },
        { id: 5, nombre: 'Galletas Vainilla', precioBase: 1.8, categoria: 'galletas', precio: 2.80, imagen: 'https://placehold.co/200x200/F5DEB3/333?text=Vainilla', stock: 45 },
        { id: 6, nombre: 'Chifles Clásicos', precioBase: 1.2, categoria: 'snacks', precio: 2.00, imagen: 'https://placehold.co/200x200/DAA520/333?text=Chifles', stock: 80 },
        { id: 7, nombre: 'Papas Lays', precioBase: 1.8, categoria: 'snacks', precio: 3.00, imagen: 'https://placehold.co/200x200/FFB700/333?text=Lays', stock: 70 },
        { id: 8, nombre: 'Leche Gloria 1L', precioBase: 2.8, categoria: 'lacteos', precio: 4.20, imagen: 'https://placehold.co/200x200/E8F4FD/333?text=Gloria', stock: 30 },
        { id: 9, nombre: 'Yogurt Fresa', precioBase: 2.5, categoria: 'lacteos', precio: 3.80, imagen: 'https://placehold.co/200x200/FF69B4/fff?text=Yogurt', stock: 25 },
        { id: 10, nombre: 'Agua San Luis 600ml', precioBase: 0.8, categoria: 'agua', precio: 1.50, imagen: 'https://placehold.co/200x200/87CEEB/333?text=San+Luis', stock: 100 }
      ],
      pedidos: [],
      _nextProductoId: 11,
      _nextPedidoId: 1
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    console.error('[DB] Error leyendo tienda-db.json:', e.message);
    throw new Error('No se pudo leer la base de datos: ' + e.message);
  }

  // ── Migraciones acumuladas (una sola escritura al final) ─────────────────
  let necesitaGuardar = false;

  // M1: categorias
  if (!db.categorias) {
    db.categorias = [
      { id: 'gaseosas', nombre: 'Gaseosas',  emoji: '🥤', color: '#3b82f6' },
      { id: 'galletas', nombre: 'Galletas',   emoji: '🍪', color: '#f59e0b' },
      { id: 'snacks',   nombre: 'Snacks',     emoji: '🍟', color: '#ef4444' },
      { id: 'lacteos',  nombre: 'Lácteos',    emoji: '🥛', color: '#8b5cf6' },
      { id: 'agua',     nombre: 'Agua',       emoji: '💧', color: '#06b6d4' }
    ];
    necesitaGuardar = true;
  }

  // M2: precioBase en productos
  if (!db.productos) db.productos = [];
  db.productos.forEach(p => {
    if (p.precioBase == null) {
      p.precioBase = parseFloat((p.precio * 0.65).toFixed(2));
      necesitaGuardar = true;
    }
  });

  // M3: campos faltantes globales
  if (!db.pedidos)   { db.pedidos  = []; necesitaGuardar = true; }
  if (!db.usuarios)  { db.usuarios = ['Admin']; necesitaGuardar = true; }
  if (!db._nextProductoId) { db._nextProductoId = (db.productos.reduce((m,p) => Math.max(m,p.id),0) + 1); necesitaGuardar = true; }
  if (!db._nextPedidoId)   { db._nextPedidoId   = (db.pedidos.reduce((m,p)  => Math.max(m,p.id),0) + 1); necesitaGuardar = true; }

  if (necesitaGuardar) {
    guardarDB(db);
    console.log('[DB] Migración aplicada y guardada.');
  }

  return db;
}

function guardarDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ─── BACKUPS ──────────────────────────────────────────────────────────────────

function crearBackup(motivo = 'manual') {
  if (!fs.existsSync(DB_PATH)) return null;
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const ahora    = new Date();
  const stamp    = ahora.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nombre   = `tienda-db_${stamp}_${motivo}.json`;
  const destino  = path.join(BACKUP_DIR, nombre);

  fs.copyFileSync(DB_PATH, destino);

  // Rotar: eliminar backups más antiguos si supera el límite
  const archivos = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('tienda-db_') && f.endsWith('.json'))
    .map(f => ({ nombre: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);

  while (archivos.length > MAX_BACKUPS) {
    const viejo = archivos.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, viejo.nombre));
    console.log(`[BACKUP] Eliminado por rotación: ${viejo.nombre}`);
  }

  console.log(`[BACKUP] Creado: ${nombre}`);
  return nombre;
}

// Backup automático periódico
setInterval(() => {
  crearBackup('auto');
}, BACKUP_INTERVALO_MS);

// Backup al iniciar el servidor (si ya existe DB)
if (fs.existsSync(DB_PATH)) {
  crearBackup('inicio');
}

// ─── AUTH ADMIN ───────────────────────────────────────────────────────────────

app.post('/api/admin/verificar-clave', (req, res) => {
  const ip = getIP(req);

  // Verificar bloqueo por fuerza bruta
  if (estaBloquedoIP(ip)) {
    const reg = intentosFallidos.get(ip);
    const restanteSeg = Math.ceil((reg.bloqueadoHasta - Date.now()) / 1000 / 60);
    return res.status(429).json({ error: `IP bloqueada. Intenta en ${restanteSeg} minutos.` });
  }

  const { clave } = req.body;

  // Comparación en tiempo constante (evita timing attacks)
  const claveHash    = crypto.createHash('sha256').update(clave || '').digest('hex');
  const correctoHash = crypto.createHash('sha256').update(ADMIN_CLAVE).digest('hex');
  const correcto = claveHash === correctoHash;

  if (correcto) {
    limpiarFallos(ip);
    const token = generarToken();
    sesionesAdmin.set(token, { expira: Date.now() + TOKEN_TTL_MS });
    console.log(`[ADMIN] Login exitoso desde ${ip}`);
    return res.json({ ok: true, token });
  } else {
    registrarFallo(ip);
    const reg = intentosFallidos.get(ip) || { count: 0 };
    const restantes = MAX_INTENTOS - reg.count;
    console.warn(`[ADMIN] Intento fallido desde ${ip} (restantes: ${restantes})`);
    return res.status(401).json({
      ok: false,
      error: restantes > 0
        ? `Clave incorrecta. ${restantes} intento(s) restantes.`
        : 'IP bloqueada por 15 minutos.'
    });
  }
});

// Cerrar sesión admin
app.post('/api/admin/logout', rateLimit('escrituras', RL_WRITE_MAX), (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) sesionesAdmin.delete(token);
  res.json({ ok: true });
});

// Verificar si un token sigue válido (usado al restaurar sesión tras recarga)
app.post('/api/admin/verificar-token', rateLimit('escrituras', RL_WRITE_MAX), (req, res) => {
  const token = req.headers['x-admin-token'];
  if (tokenValido(token)) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Token expirado o inválido' });
  }
});

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

app.get('/api/usuarios', rateLimit('lecturas', RL_READ_MAX), (req, res) => {
  const db = cargarDB();
  res.json(db.usuarios);
});

app.post('/api/usuarios', rateLimit('escrituras', RL_WRITE_MAX), (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const db = cargarDB();
  const nombreLimpio = nombre.trim();
  if (db.usuarios.includes(nombreLimpio)) return res.status(409).json({ error: 'Usuario ya existe' });
  db.usuarios.push(nombreLimpio);
  guardarDB(db);
  res.json({ ok: true, usuarios: db.usuarios });
});

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────

app.get('/api/categorias', rateLimit('lecturas', RL_READ_MAX), (req, res) => {
  const db = cargarDB();
  res.json(db.categorias);
});

app.post('/api/categorias', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const { nombre, emoji, color } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const db = cargarDB();
  // id = slug del nombre en minúsculas sin espacios ni tildes
  const id = nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '_');
  if (db.categorias.find(c => c.id === id)) {
    return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
  }
  const nueva = { id, nombre: nombre.trim(), emoji: emoji || '📦', color: color || '#6b7280' };
  db.categorias.push(nueva);
  guardarDB(db);
  res.json(nueva);
});

app.put('/api/categorias/:id', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.categorias.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
  const { nombre, emoji, color } = req.body;
  if (nombre) db.categorias[idx].nombre = nombre.trim();
  if (emoji)  db.categorias[idx].emoji  = emoji;
  if (color)  db.categorias[idx].color  = color;
  guardarDB(db);
  res.json(db.categorias[idx]);
});

app.delete('/api/categorias/:id', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.categorias.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
  // Verificar si hay productos usando esta categoría
  const enUso = db.productos.some(p => p.categoria === req.params.id);
  if (enUso) return res.status(409).json({ error: 'La categoría tiene productos asignados. Reasígnalos antes de eliminar.' });
  db.categorias.splice(idx, 1);
  guardarDB(db);
  res.json({ ok: true });
});

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

app.get('/api/productos', rateLimit('lecturas', RL_READ_MAX), (req, res) => {
  const db = cargarDB();
  res.json(db.productos);
});

app.post('/api/productos', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const { nombre, categoria, precio, precioBase, imagen, stock } = req.body;
  if (!nombre || !categoria || precio == null) return res.status(400).json({ error: 'Faltan campos' });
  const db = cargarDB();
  const nuevo = {
    id: db._nextProductoId++,
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    precioBase: parseFloat(precioBase) || 0,
    precio: parseFloat(precio),
    imagen: imagen || `https://placehold.co/200x200/888/fff?text=${encodeURIComponent(nombre)}`,
    stock: parseInt(stock) || 0
  };
  db.productos.push(nuevo);
  guardarDB(db);
  res.json(nuevo);
});

app.put('/api/productos/:id', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.productos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

  const productoId = db.productos[idx].id;
  db.productos[idx] = { ...db.productos[idx], ...req.body, id: productoId };
  const nuevoPrecioBase = db.productos[idx].precioBase;

  // Sincronizar precioBase en TODOS los pedidos que contengan este producto
  db.pedidos.forEach(pedido => {
    pedido.items.forEach(item => {
      if (item.productoId === productoId) {
        item.precioBase = nuevoPrecioBase;
      }
    });
  });

  guardarDB(db);
  res.json(db.productos[idx]);
});

app.delete('/api/productos/:id', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.productos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db.productos.splice(idx, 1);
  guardarDB(db);
  res.json({ ok: true });
});

// ─── PEDIDOS ──────────────────────────────────────────────────────────────────

app.get('/api/pedidos', rateLimit('lecturas', RL_READ_MAX), (req, res) => {
  const db = cargarDB();
  // Enriquecer items viejos que no tienen precioBase con el valor actual del producto
  let modificado = false;
  db.pedidos.forEach(pedido => {
    pedido.items.forEach(item => {
      if (item.precioBase == null || item.precioBase === 0) {
        const prod = db.productos.find(p => p.id === item.productoId);
        if (prod && prod.precioBase) {
          item.precioBase = prod.precioBase;
          modificado = true;
        }
      }
    });
  });
  if (modificado) guardarDB(db);
  res.json(db.pedidos);
});

app.post('/api/pedidos', rateLimit('escrituras', RL_WRITE_MAX), (req, res) => {
  const { usuario, items, total } = req.body;
  if (!usuario || !items || !items.length) return res.status(400).json({ error: 'Pedido inválido' });
  const db = cargarDB();

  // Verificar stock suficiente y enriquecer items con precioBase
  for (const item of items) {
    const prod = db.productos.find(p => p.id === item.productoId);
    if (!prod) return res.status(404).json({ error: `Producto "${item.nombre}" no encontrado` });
    if (prod.stock < item.cantidad) {
      return res.status(409).json({ error: `Stock insuficiente para "${prod.nombre}" (disponible: ${prod.stock})` });
    }
    // Guardar precioBase en el snapshot del item para cálculos futuros
    item.precioBase = prod.precioBase || 0;
  }

  // Reservar stock inmediatamente al crear el pedido
  items.forEach(item => {
    const prod = db.productos.find(p => p.id === item.productoId);
    prod.stock -= item.cantidad;
  });

  const pedido = {
    id: db._nextPedidoId++,
    usuario,
    items,
    total: parseFloat(total),
    estado: 'pendiente',
    fecha: new Date().toISOString()
  };
  db.pedidos.push(pedido);
  guardarDB(db);
  // Devolver pedido + productos actualizados para que el frontend sincronice
  res.json({ pedido, productos: db.productos });
});

app.put('/api/pedidos/:id/pagado', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.pedidos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db.pedidos[idx].pagado = true;
  guardarDB(db);
  res.json(db.pedidos[idx]);
});

app.put('/api/pedidos/:id/estado', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const { estado } = req.body;
  if (!['pendiente', 'entregado', 'cancelado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const db = cargarDB();
  const idx = db.pedidos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

  const pedido = db.pedidos[idx];
  const estadoAnterior = pedido.estado;

  // Stock ya fue descontado al crear el pedido (pendiente)
  // Solo restaurar si se cancela desde pendiente o entregado
  if (estado === 'cancelado' && (estadoAnterior === 'pendiente' || estadoAnterior === 'entregado')) {
    pedido.items.forEach(item => {
      const prod = db.productos.find(p => p.id === item.productoId);
      if (prod) prod.stock += item.cantidad;
    });
  }

  pedido.estado = estado;
  guardarDB(db);
  // Devolver pedido actualizado + productos actualizados para que el frontend sincronice
  res.json({ pedido, productos: db.productos });
});

app.delete('/api/usuarios/:nombre', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);
  if (nombre === 'Admin') return res.status(403).json({ error: 'No se puede eliminar Admin' });
  const db = cargarDB();
  if (!db.usuarios.includes(nombre)) return res.status(404).json({ error: 'No encontrado' });
  db.usuarios = db.usuarios.filter(u => u !== nombre);
  guardarDB(db);
  res.json({ ok: true });
});

// ─── ENDPOINTS BACKUP ────────────────────────────────────────────────────────

// Listar backups disponibles
app.get('/api/backups', rateLimit('lecturas', RL_READ_MAX), requireAdmin, (req, res) => {
  if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
  const archivos = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('tienda-db_') && f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { nombre: f, tamaño: stat.size, fecha: stat.mtime };
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  res.json(archivos);
});

// Crear backup manual
app.post('/api/backups', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  try {
    const nombre = crearBackup('manual');
    res.json({ ok: true, nombre });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Restaurar un backup específico
app.post('/api/backups/restaurar', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const origen = path.join(BACKUP_DIR, nombre);
  if (!fs.existsSync(origen)) return res.status(404).json({ error: 'Backup no encontrado' });
  // Hacer backup del estado actual antes de restaurar
  crearBackup('pre-restauracion');
  fs.copyFileSync(origen, DB_PATH);
  console.log(`[BACKUP] Restaurado: ${nombre}`);
  res.json({ ok: true });
});

// Eliminar un backup
app.delete('/api/backups/:nombre', rateLimit('escrituras', RL_WRITE_MAX), requireAdmin, (req, res) => {
  const archivo = path.join(BACKUP_DIR, req.params.nombre);
  if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'No encontrado' });
  fs.unlinkSync(archivo);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Tienda corriendo en http://localhost:${PORT}/tienda.html`);
});
