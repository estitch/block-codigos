# Roadmap — Block Códigos

> Implementado: `[x]` · Pendiente: `[ ]` · Omitido: ~~tachado~~ · Los números indican el **orden sugerido de implementación** por categoría.

**Progreso: 11 / 28 ítems implementados (~39%)**

## 🧠 Algoritmos & Lógica

- [x] **1 · Detección de duplicados parciales** (Damerau-Levenshtein) — IDs con errores de tipeo (`12345678` vs `12345679`) o marcas escritas distinto (`GOHNER` vs `GONHER`)
- [ ] ~~**2 · Sugerencia de código siguiente** (búsqueda binaria + relleno de gaps numéricos) — próximo código 8 dígitos libre sin scrollear~~ ⏭ **OMITIDO** — un código sugerido manualmente puede chocar con la importación (IDs generados por otro software, no a decisión de una persona); la importación gana y actualiza el existente, por lo que la sugerencia no aporta.
- [x] **3 · Búsqueda difusa** (n-gramas + Jaccard + ranking) — encontrar "Cocacola" aunque busques "Coca Cola"
- [x] **4 · Autocompletado predictivo** (Trie + LRU cache) — Marca/Submarca/Producto al escribir
- [x] **5 · Normalización inteligente de texto** (stemming + `normalize('NFD')` + scoring) — detectar "Coca-Cola" = "COCA COLA"
- [ ] ~~**6 · Check digit / dígito verificador** para IDs de 8 dígitos~~ ⏭ **OMITIDO** — los códigos provienen de otro software (importación Excel) y no cumplen ningún esquema de verificador: probados Luhn y 6 variantes de mod10/mod11 sobre los 4,754 códigos, todos aciertan ~10% (azar). Un verificador obligatorio rechazaría ~90% de códigos legítimos; como detector de tipeo soft, marcaría falso positivo en ~90% de los códigos importados. No aporta valor.
- [x] **7 · Compresión de DB al vuelo** (`.json.gz` para backups) — backups gzip nivel 9 (~1.27 MB → ~140 KB) + descarga y restauración protegida por clave
- [x] **8 · Batch insert con rollback** (snapshot → revertir si falla lote en importación Excel) — `POST /api/codigos/batch` con upsert, todo-o-nada y restauración en memoria ante fallo; importación `.xlsx` por navegador (botón ⬆ IMPORTAR)

## 🖥️ UI / Experiencia

- [x] **1 · Modal de vista rápida** (click en fila → detalle sin abrir edición)
- [ ] ~~**2 · Atajo duplicar registro** (editar → "guardar como nuevo")~~ ⏭ **OMITIDO** — los códigos provienen de otro software (importación Excel) y la importación gana por upsert; duplicar manualmente un registro no aporta valor.
- [x] **3 · Vista de tarjetas** (cards) alternativa a tabla
- [ ] ~~**4 · Selección múltiple + acciones batch** (reasignar propietario, eliminar, exportar)~~ ⏭ **OMITIDO** — las acciones en lote (en especial el borrado, que requeriría clave) aumentan el riesgo de pérdida de datos; se prefiere la edición individual con confirmación.
- [x] **5 · Panel de estadísticas** con gráficos (torta por tipo, barras por marca)
- [x] **6 · Query params en URL** (`?filter=tipo:MENCION&q=gonher`) para compartir vista
- [x] **7 · Paginación virtual** (virtual scroll para >10K registros)

## 📦 Datos & Persistencia

- [ ] ⏭ **1 · Historial de cambios** por código (quién, qué, cuándo) — pendiente para futura implementación
- [ ] ⏭ **2 · Papelera de reciclaje** (soft delete en vez de borrado directo) — pendiente para futura implementación
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
