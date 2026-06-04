const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3030;
const DB_PATH     = path.join(__dirname, 'db.json');
const DB_BAK_PATH = path.join(__dirname, 'db.json.bak');
const BACKUP_DIR  = path.join(__dirname, 'backups'); // Directorio para backups periódicos
const CLAVE_GESTION = 'AUDITSA2026';
const BACKUP_INTERVAL_DAYS = 3; // Intervalo de backup en días

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── DB EN MEMORIA ────────────────────────────────────────
let db = { codigos: [], propietarios: [], meta: {} };

// ─── FUNCIONES DE BACKUP ──────────────────────────────────

/**
 * Crea el directorio de backups si no existe
 */
function asegurarDirectorioBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Directorio de backups creado: ${BACKUP_DIR}`);
  }
}

/**
 * Realiza un backup periódico de la base de datos
 * @returns {string} Ruta del archivo de backup creado
 */
function realizarBackupPeriodico() {
  try {
    asegurarDirectorioBackup();
    
    const fecha = new Date();
    const timestamp = fecha.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `db_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    // Crear el backup
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf8');
    
    console.log(`💾 Backup periódico creado: ${backupFileName}`);
    
    // Limpiar backups antiguos (opcional: mantener solo los últimos 10)
    limpiarBackupsAntiguos(10);
    
    return backupPath;
  } catch (error) {
    console.error('❌ Error al crear backup periódico:', error.message);
    return null;
  }
}

/**
 * Elimina backups antiguos, manteniendo solo los más recientes
 * @param {number} maxBackups - Número máximo de backups a mantener
 */
function limpiarBackupsAntiguos(maxBackups = 10) {
  try {
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('db_backup_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Ordenar del más reciente al más antiguo
    
    if (archivos.length > maxBackups) {
      const archivosAEliminar = archivos.slice(maxBackups);
      archivosAEliminar.forEach(archivo => {
        fs.unlinkSync(path.join(BACKUP_DIR, archivo));
        console.log(`🗑️  Backup antiguo eliminado: ${archivo}`);
      });
    }
  } catch (error) {
    console.error('⚠️  Error al limpiar backups antiguos:', error.message);
  }
}

/**
 * Verifica si es necesario realizar un backup basado en el intervalo configurado
 * @returns {boolean}
 */
function esTiempoDeBackup() {
  try {
    asegurarDirectorioBackup();
    
    // Buscar el backup más reciente
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('db_backup_') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (archivos.length === 0) {
      return true; // No hay backups, crear el primero
    }
    
    // Extraer la fecha del nombre del archivo más reciente
    const ultimoBackup = archivos[0];
    const fechaStr = ultimoBackup.replace('db_backup_', '').replace('.json', '');
    const fechaUltimoBackup = new Date(fechaStr.replace(/-/g, ':').replace('T', ' '));
    
    if (isNaN(fechaUltimoBackup.getTime())) {
      return true; // Si no se puede parsear la fecha, hacer backup
    }
    
    // Calcular la diferencia en días
    const ahora = new Date();
    const diferenciaMs = ahora - fechaUltimoBackup;
    const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24);
    
    return diferenciaDias >= BACKUP_INTERVAL_DAYS;
  } catch (error) {
    console.error('⚠️  Error al verificar tiempo de backup:', error.message);
    return true; // En caso de error, hacer backup por seguridad
  }
}

/**
 * Función principal que se ejecuta periódicamente para hacer backups
 */
function programarBackupPeriodico() {
  // Verificar cada hora si es necesario hacer backup
  const intervaloVerificacion = 60 * 60 * 1000; // 1 hora en milisegundos
  
  console.log(`⏰ Sistema de backup programado cada ${BACKUP_INTERVAL_DAYS} días`);
  
  // Hacer backup inmediatamente si es necesario al iniciar
  setTimeout(() => {
    if (esTiempoDeBackup()) {
      console.log('🕐 Iniciando backup programado...');
      const backupPath = realizarBackupPeriodico();
      if (backupPath) {
        console.log(`✅ Backup inicial completado: ${backupPath}`);
      }
    }
  }, 5000); // Esperar 5 segundos después del inicio
  
  // Programar verificaciones periódicas
  setInterval(() => {
    if (esTiempoDeBackup()) {
      console.log('🕐 Realizando backup programado...');
      const backupPath = realizarBackupPeriodico();
      if (backupPath) {
        console.log(`✅ Backup programado completado: ${backupPath}`);
      }
    }
  }, intervaloVerificacion);
}

// ─── ENDPOINT PARA BACKUP MANUAL ──────────────────────────

app.post('/api/backup', (req, res) => {
  try {
    const backupPath = realizarBackupPeriodico();
    if (backupPath) {
      res.json({ 
        ok: true, 
        mensaje: 'Backup creado exitosamente',
        archivo: path.basename(backupPath),
        ruta: backupPath
      });
    } else {
      res.status(500).json({ error: 'No se pudo crear el backup' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al crear backup manual' });
  }
});

// ─── ENDPOINT PARA LISTAR BACKUPS ─────────────────────────

app.get('/api/backups', (req, res) => {
  try {
    asegurarDirectorioBackup();
    
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('db_backup_') && file.endsWith('.json'))
      .sort()
      .reverse()
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          nombre: file,
          tamaño: stats.size,
          fecha: stats.mtime,
          ruta: filePath
        };
      });
    
    res.json({ ok: true, backups: archivos, total: archivos.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al listar backups' });
  }
});

function persistir() {
  db.meta = db.meta || {};
  db.meta.total = db.codigos.length;
  db.meta.ultima_actualizacion = new Date().toISOString().slice(0, 10);
  if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_BAK_PATH);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function nextId(arr) {
  return arr.reduce((max, item) => item.id > max ? item.id : max, 0) + 1;
}

// ─── CARGA INICIAL Y MIGRACIÓN ────────────────────────────
(function cargarDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('ℹ️  db.json no existe, se creará al primer guardado');
      return;
    }

    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    db.codigos      = db.codigos      || [];
    db.propietarios = db.propietarios || [];
    db.meta         = db.meta         || {};

    let modificado = false;

    // Deduplicar códigos
    const seen = new Set();
    const unique = db.codigos.filter(c => {
      if (seen.has(c.codigo)) return false;
      seen.add(c.codigo);
      return true;
    });
    if (unique.length !== db.codigos.length) {
      db.codigos = unique;
      modificado = true;
      console.log('⚠️  Códigos duplicados eliminados');
    }

    // Migrar propietario_id → propietarios_ids
    db.codigos.forEach(c => {
      if (c.propietarios_ids === undefined) {
        c.propietarios_ids = (c.propietario_id != null) ? [c.propietario_id] : [];
        delete c.propietario_id;
        modificado = true;
      }
      if (!Array.isArray(c.propietarios_ids)) {
        c.propietarios_ids = [];
        modificado = true;
      }
    });

    // Migrar nombre → version
    db.codigos.forEach(c => {
      if (c.version === undefined && c.nombre !== undefined) {
        c.version = c.nombre;
        delete c.nombre;
        modificado = true;
      }
    });

    // Migrar categoria → marca
    db.codigos.forEach(c => {
      if (c.marca === undefined && c.categoria !== undefined) {
        c.marca = c.categoria;
        delete c.categoria;
        modificado = true;
      }
    });

    // Migrar notas → submarca
    db.codigos.forEach(c => {
      if (c.submarca === undefined && c.notas !== undefined) {
        c.submarca = c.notas;
        delete c.notas;
        modificado = true;
      }
    });

    // Agregar campo producto si no existe
    db.codigos.forEach(c => {
      if (c.producto === undefined) {
        c.producto = '';
        modificado = true;
      }
    });

    if (modificado) {
      persistir();
      console.log('✅ Base de datos migrada y actualizada');
    }

    console.log(`📦 DB cargada en memoria: ${db.codigos.length} códigos, ${db.propietarios.length} propietarios`);
  } catch (e) {
    console.error('❌ Error al cargar db.json:', e.message);
    process.exit(1);
  }
})();

// ─── ENDPOINTS ────────────────────────────────────────────

app.get('/api/codigos', (req, res) => {
  res.json(db);
});

app.post('/api/codigos', (req, res) => {
  try {
    const nuevo = req.body;
    if (!nuevo.codigo || !nuevo.version || !nuevo.tipo || !nuevo.marca) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    if (db.codigos.some(c => c.codigo === nuevo.codigo.trim())) {
      return res.status(409).json({ error: `El código ${nuevo.codigo} ya existe` });
    }

    const registro = {
      id: nextId(db.codigos),
      codigo:   nuevo.codigo.trim(),
      version:  nuevo.version.trim(),
      tipo:     nuevo.tipo,
      marca:    nuevo.marca.trim(),
      submarca: (nuevo.submarca || '').trim(),
      producto: (nuevo.producto || '').trim(),
      propietarios_ids: Array.isArray(nuevo.propietarios_ids) ? nuevo.propietarios_ids : []
    };

    db.codigos.push(registro);
    persistir();
    res.json({ ok: true, registro, total: db.meta.total });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo agregar el registro' });
  }
});

app.patch('/api/codigos/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { version, tipo, marca, submarca, producto } = req.body;

    const codigo = db.codigos.find(c => c.id === id);
    if (!codigo) return res.status(404).json({ error: 'Código no encontrado' });

    if (version  !== undefined) codigo.version  = version.trim();
    if (tipo     !== undefined) codigo.tipo      = tipo;
    if (marca    !== undefined) codigo.marca     = marca.trim();
    if (submarca !== undefined) codigo.submarca  = submarca.trim();
    if (producto !== undefined) codigo.producto  = producto.trim();

    persistir();
    res.json({ ok: true, registro: codigo, total: db.meta.total });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo editar el registro' });
  }
});

app.delete('/api/codigos/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const antes = db.codigos.length;
    db.codigos = db.codigos.filter(c => c.id !== id);

    if (db.codigos.length === antes) return res.status(404).json({ error: 'Código no encontrado' });

    persistir();
    res.json({ ok: true, total: db.meta.total });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar el registro' });
  }
});

app.patch('/api/codigos/:id/propietarios', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { propietarios_ids } = req.body;

    if (!Array.isArray(propietarios_ids)) return res.status(400).json({ error: 'propietarios_ids debe ser un array' });

    const codigo = db.codigos.find(c => c.id === id);
    if (!codigo) return res.status(404).json({ error: 'Código no encontrado' });

    codigo.propietarios_ids = propietarios_ids;
    persistir();
    res.json({ ok: true, propietarios_ids });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
});

// ─── PROPIETARIOS ──────────────────────────────────────────

app.get('/api/propietarios', (req, res) => {
  res.json(db.propietarios);
});

app.post('/api/propietarios/verificar-clave', (req, res) => {
  const { clave } = req.body;
  if (!clave) return res.status(400).json({ ok: false, error: 'Clave requerida' });
  res.json({ ok: clave === CLAVE_GESTION });
});

app.post('/api/propietarios', (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    if (db.propietarios.some(p => p.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
      return res.status(409).json({ error: 'Ya existe un propietario con ese nombre' });
    }

    const propietario = { id: nextId(db.propietarios), nombre: nombre.trim() };
    db.propietarios.push(propietario);
    persistir();
    res.json({ ok: true, propietario });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el propietario' });
  }
});

app.delete('/api/propietarios/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = db.propietarios.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Propietario no encontrado' });

    db.codigos.forEach(c => {
      if (Array.isArray(c.propietarios_ids)) {
        c.propietarios_ids = c.propietarios_ids.filter(pid => pid !== id);
      }
    });

    db.propietarios.splice(idx, 1);
    persistir();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar el propietario' });
  }
});

// ─── INICIAR SERVIDOR ─────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ✅  Block Codigos corriendo en http://localhost:${PORT}`);
  console.log(`  📁  DB:     ${DB_PATH}`);
  console.log(`  💾  Backup: ${DB_BAK_PATH}`);
  console.log(`  📂  Backups: ${BACKUP_DIR}\n`);
  
  // Iniciar el sistema de backup programado
  programarBackupPeriodico();
});