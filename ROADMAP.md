# Roadmap — Block Códigos

> Implementado: `[x]` · Pendiente: `[ ]` · Omitido: ~~tachado~~ · Los números indican el **orden sugerido de implementación** por categoría.

**Progreso: 4 / 28 ítems implementados (~14%)**

## 🧠 Algoritmos & Lógica

- [x] **1 · Detección de duplicados parciales** (Damerau-Levenshtein) — IDs con errores de tipeo (`12345678` vs `12345679`) o marcas escritas distinto (`GOHNER` vs `GONHER`)
- [ ] ~~**2 · Sugerencia de código siguiente** (búsqueda binaria + relleno de gaps numéricos) — próximo código 8 dígitos libre sin scrollear~~ ⏭ **OMITIDO** — un código sugerido manualmente puede chocar con la importación (IDs generados por otro software, no a decisión de una persona); la importación gana y actualiza el existente, por lo que la sugerencia no aporta.
- [x] **3 · Búsqueda difusa** (n-gramas + Jaccard + ranking) — encontrar "Cocacola" aunque busques "Coca Cola"
- [x] **4 · Autocompletado predictivo** (Trie + LRU cache) — Marca/Submarca/Producto al escribir
- [x] **5 · Normalización inteligente de texto** (stemming + `normalize('NFD')` + scoring) — detectar "Coca-Cola" = "COCA COLA"
- [ ] **6 · Check digit / dígito verificador** para IDs de 8 dígitos
- [ ] **7 · Compresión de DB al vuelo** (`.json.gz` para backups)
- [ ] **8 · Batch insert con rollback** (snapshot → revertir si falla lote en importación Excel)

## 🖥️ UI / Experiencia

- [ ] **1 · Modal de vista rápida** (click en fila → detalle sin abrir edición)
- [ ] **2 · Atajo duplicar registro** (editar → "guardar como nuevo")
- [ ] **3 · Vista de tarjetas** (cards) alternativa a tabla
- [ ] **4 · Selección múltiple + acciones batch** (reasignar propietario, eliminar, exportar)
- [ ] **5 · Panel de estadísticas** con gráficos (torta por tipo, barras por marca)
- [ ] **6 · Query params en URL** (`?filter=tipo:MENCION&q=gonher`) para compartir vista
- [ ] **7 · Paginación virtual** (virtual scroll para >10K registros)

## 📦 Datos & Persistencia

- [ ] **1 · Historial de cambios** por código (quién, qué, cuándo)
- [ ] **2 · Papelera de reciclaje** (soft delete en vez de borrado directo)
- [ ] **3 · Tags / etiquetas** (clasificación cruzada adicional a propietarios)
- [ ] **4 · Campos personalizados** (columnas extra dinámicas)
- [ ] **5 · Exportación programada** (CRON a carpeta compartida)

## 🔌 Infraestructura & Red

- [ ] **1 · Rate limiting por IP** en todas las rutas (hoy solo en login de tienda)
- [ ] **2 · Autenticación por usuario** con login (quién hizo cada cambio)
- [ ] **3 · WebSocket** para sincronización en tiempo real entre PCs
- [ ] **4 · Modo offline** (Service Worker + IndexedDB) con sync al reconectar

## 🧹 Mantenimiento / Calidad de Datos

- [ ] **1 · Limpieza automática** de tildes y mayúsculas inconsistentes
- [ ] **2 · Detección y fusión de duplicados reales** (mismo código con data distinta) — clustering + revisión manual
- [ ] **3 · Validación cruzada Tienda ↔ Block** — códigos en pedidos que no existen en Block
- [ ] **4 · Re-indexación periódica** compactando DB
