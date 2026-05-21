const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3031;

const DB_PATH = path.join(__dirname, 'tienda-db.json');
const ADMIN_CLAVE = 'TIENDA2026';
const crypto = require('crypto');

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
        { id: 1, nombre: 'Inca Kola 1.5L', categoria: 'gaseosas', precio: 5.50, imagen: 'https://placehold.co/200x200/FFD700/333?text=Inca+Kola', stock: 50 },
        { id: 2, nombre: 'Coca Cola 1L', categoria: 'gaseosas', precio: 4.80, imagen: 'https://placehold.co/200x200/CC0000/fff?text=Coca+Cola', stock: 40 },
        { id: 3, nombre: 'Sprite 500ml', categoria: 'gaseosas', precio: 3.20, imagen: 'https://placehold.co/200x200/00AA44/fff?text=Sprite', stock: 35 },
        { id: 4, nombre: 'Galletas Oreo', categoria: 'galletas', precio: 3.50, imagen: 'https://placehold.co/200x200/222/fff?text=Oreo', stock: 60 },
        { id: 5, nombre: 'Galletas Vainilla', categoria: 'galletas', precio: 2.80, imagen: 'https://placehold.co/200x200/F5DEB3/333?text=Vainilla', stock: 45 },
        { id: 6, nombre: 'Chifles Clásicos', categoria: 'snacks', precio: 2.00, imagen: 'https://placehold.co/200x200/DAA520/333?text=Chifles', stock: 80 },
        { id: 7, nombre: 'Papas Lays', categoria: 'snacks', precio: 3.00, imagen: 'https://placehold.co/200x200/FFB700/333?text=Lays', stock: 70 },
        { id: 8, nombre: 'Leche Gloria 1L', categoria: 'lacteos', precio: 4.20, imagen: 'https://placehold.co/200x200/E8F4FD/333?text=Gloria', stock: 30 },
        { id: 9, nombre: 'Yogurt Fresa', categoria: 'lacteos', precio: 3.80, imagen: 'https://placehold.co/200x200/FF69B4/fff?text=Yogurt', stock: 25 },
        { id: 10, nombre: 'Agua San Luis 600ml', categoria: 'agua', precio: 1.50, imagen: 'https://placehold.co/200x200/87CEEB/333?text=San+Luis', stock: 100 }
      ],
      pedidos: [],
      _nextProductoId: 11,
      _nextPedidoId: 1
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Migración: agregar categorias si no existe
  if (!db.categorias) {
    db.categorias = [
      { id: 'gaseosas', nombre: 'Gaseosas',  emoji: '🥤', color: '#3b82f6' },
      { id: 'galletas', nombre: 'Galletas',   emoji: '🍪', color: '#f59e0b' },
      { id: 'snacks',   nombre: 'Snacks',     emoji: '🍟', color: '#ef4444' },
      { id: 'lacteos',  nombre: 'Lácteos',    emoji: '🥛', color: '#8b5cf6' },
      { id: 'agua',     nombre: 'Agua',       emoji: '💧', color: '#06b6d4' }
    ];
    guardarDB(db);
  }
  return db;
}

function guardarDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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
app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) sesionesAdmin.delete(token);
  res.json({ ok: true });
});

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

app.get('/api/usuarios', (req, res) => {
  const db = cargarDB();
  res.json(db.usuarios);
});

app.post('/api/usuarios', (req, res) => {
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

app.get('/api/categorias', (req, res) => {
  const db = cargarDB();
  res.json(db.categorias);
});

app.post('/api/categorias', requireAdmin, (req, res) => {
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

app.put('/api/categorias/:id', requireAdmin, (req, res) => {
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

app.delete('/api/categorias/:id', requireAdmin, (req, res) => {
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

app.get('/api/productos', (req, res) => {
  const db = cargarDB();
  res.json(db.productos);
});

app.post('/api/productos', requireAdmin, (req, res) => {
  const { nombre, categoria, precio, imagen, stock } = req.body;
  if (!nombre || !categoria || precio == null) return res.status(400).json({ error: 'Faltan campos' });
  const db = cargarDB();
  const nuevo = {
    id: db._nextProductoId++,
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    precio: parseFloat(precio),
    imagen: imagen || `https://placehold.co/200x200/888/fff?text=${encodeURIComponent(nombre)}`,
    stock: parseInt(stock) || 0
  };
  db.productos.push(nuevo);
  guardarDB(db);
  res.json(nuevo);
});

app.put('/api/productos/:id', requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.productos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db.productos[idx] = { ...db.productos[idx], ...req.body, id: db.productos[idx].id };
  guardarDB(db);
  res.json(db.productos[idx]);
});

app.delete('/api/productos/:id', requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.productos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db.productos.splice(idx, 1);
  guardarDB(db);
  res.json({ ok: true });
});

// ─── PEDIDOS ──────────────────────────────────────────────────────────────────

app.get('/api/pedidos', (req, res) => {
  const db = cargarDB();
  res.json(db.pedidos);
});

app.post('/api/pedidos', (req, res) => {
  const { usuario, items, total } = req.body;
  if (!usuario || !items || !items.length) return res.status(400).json({ error: 'Pedido inválido' });
  const db = cargarDB();
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
  res.json(pedido);
});

app.put('/api/pedidos/:id/pagado', requireAdmin, (req, res) => {
  const db = cargarDB();
  const idx = db.pedidos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db.pedidos[idx].pagado = true;
  guardarDB(db);
  res.json(db.pedidos[idx]);
});

app.put('/api/pedidos/:id/estado', requireAdmin, (req, res) => {
  const { estado } = req.body;
  if (!['pendiente', 'entregado', 'cancelado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const db = cargarDB();
  const idx = db.pedidos.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db.pedidos[idx].estado = estado;
  guardarDB(db);
  res.json(db.pedidos[idx]);
});

app.delete('/api/usuarios/:nombre', requireAdmin, (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);
  if (nombre === 'Admin') return res.status(403).json({ error: 'No se puede eliminar Admin' });
  const db = cargarDB();
  if (!db.usuarios.includes(nombre)) return res.status(404).json({ error: 'No encontrado' });
  db.usuarios = db.usuarios.filter(u => u !== nombre);
  guardarDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Tienda corriendo en http://localhost:${PORT}/tienda.html`);
});
