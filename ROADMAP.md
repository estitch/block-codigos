# Roadmap — Block Códigos

> Implementado: `[x]` · Pendiente: `[ ]`

## 🧠 Algoritmos & Lógica

- [ ] **Detección de duplicados parciales** (Levenshtein / Damerau-Levenshtein) — IDs con errores de tipeo (`12345678` vs `12345679`) o marcas escritas distinto (`GOHNER` vs `GONHER`)
- [ ] **Sugerencia de código siguiente** (búsqueda binaria + relleno de gaps numéricos) — próximo código 8 dígitos libre sin scrollear
- [ ] **Autocompletado predictivo** (Trie + LRU cache) — Marca/Submarca/Producto al escribir
- [ ] **Normalización inteligente de texto** (stemming + `normalize('NFD')` + scoring) — detectar "Coca-Cola" = "COCA COLA"
- [ ] **Búsqueda difusa** (n-gramas + Jaccard + ranking) — encontrar "Cocacola" aunque busques "Coca Cola"
- [ ] **Check digit / dígito verificador** para IDs de 8 dígitos
- [ ] **Compresión de DB al vuelo** (`.json.gz` para backups)
- [ ] **Batch insert con rollback** (snapshot → revertir si falla lote en importación Excel)

## 🖥️ UI / Experiencia

- [ ] **Vista de tarjetas** (cards) alternativa a tabla
- [ ] **Panel de estadísticas** con gráficos (torta por tipo, barras por marca)
- [ ] **Selección múltiple + acciones batch** (reasignar propietario, eliminar, exportar)
- [ ] **Modal de vista rápida** (click en fila → detalle sin abrir edición)
- [ ] **Atajo duplicar registro** (editar → "guardar como nuevo")
- [ ] **Query params en URL** (`?filter=tipo:MENCION&q=gonher`) para compartir vista
- [ ] **Paginación virtual** (virtual scroll para >10K registros)

## 📦 Datos & Persistencia

- [ ] **Historial de cambios** por código (quién, qué, cuándo)
- [ ] **Papelera de reciclaje** (soft delete en vez de borrado directo)
- [ ] **Campos personalizados** (columnas extra dinámicas)
- [ ] **Tags / etiquetas** (clasificación cruzada adicional a propietarios)
- [ ] **Exportación programada** (CRON a carpeta compartida)

## 🔌 Infraestructura & Red

- [ ] **WebSocket** para sincronización en tiempo real entre PCs
- [ ] **Modo offline** (Service Worker + IndexedDB) con sync al reconectar
- [ ] **Autenticación por usuario** con login (quién hizo cada cambio)
- [ ] **Rate limiting por IP** en todas las rutas (hoy solo en login de tienda)

## 🧹 Mantenimiento / Calidad de Datos

- [ ] **Detección y fusión de duplicados reales** (mismo código con data distinta) — clustering + revisión manual
- [ ] **Limpieza automática** de tildes y mayúsculas inconsistentes
- [ ] **Validación cruzada Tienda ↔ Block** — códigos en pedidos que no existen en Block
- [ ] **Re-indexación periódica** compactando DB
