# AGENTS.md — block_codigos

## Two independent servers, same directory

| App | Entrypoint | Port | Main page | DB file | Admin key | LAN binding |
|---|---|---|---|---|---|---|
| Block Códigos | `server.js` | 3030 | `index.html` | `db.json` | `AUDITSA2026` | `0.0.0.0` — LAN reachable |
| Tienda Teleactiva | `tienda-server.js` | 3031 | `tienda.html` | `tienda-db.json` | `TIENDA2026` | localhost only |

They share no code. Dependencies: `express`, `cors` only (plain Express + `fs`, no database client).

## Commands

- **Block:** `npm start`, `node server.js`, or double-click `INICIAR_CODIGOS.bat` (auto-opens browser to LAN IP)
- **Tienda:** `node tienda-server.js` or double-click `INICIAR_TIENDA.bat`
- No test / lint / typecheck / format commands exist.

## Architecture

- `index.html` has embedded JS (no bundler). The "Ir a la Tienda" button at `index.html:20` is hardcoded to `http://192.168.151.152:3031/tienda.html` — update this IP when the Block server's LAN address changes.
- `tienda.js` calls `localhost:3031/api/*`. Retries login up to 3× with 1s delays.
- Tienda admin sessions: in-memory `Map<token, 2hr expiry>`. Token in `sessionStorage` (`ts_usuario`, `ts_esAdmin`, `ts_adminToken`, `ts_vistaAdmin`).
- Block auth: plain password check per `POST /api/propietarios/verificar-clave`. No session.
- Tienda brute force: 5 attempts → 15 min IP block (in-memory, lost on restart). SHA-256 timing-safe comparison.
- Stock: decremented on pedido creation, restored to `productos` on cancel. No separate inventory table.
- `express.json({ limit: '50mb' })` — required so `POST /api/codigos/batch` accepts real batches (a 1,074-row `_filtrado` payload is ~190 KB; the old 100 KB default caused 413). Restart the server after changing this.

## DB files

- `db.json`: `{ codigos[], propietarios[], meta{} }`. Codigo fields: `id, codigo, version, tipo, marca, submarca, producto, propietarios_ids`.
- `tienda-db.json`: `{ usuarios[], categorias[], productos[], pedidos[], _nextProductoId, _nextPedidoId }`.
- Both read on startup, written on every mutation. Inline migrations in `cargarDB()` rename fields over time (`propietario_id→propietarios_ids`, `nombre→version`, `categoria→marca`, `notas→submarca`).
- Block deduplicates codes on DB load (keeps first occurrence).
- Products have `precioBase` (cost) and `precio` (selling price). Pedido items snapshot `precioBase` at creation; retroactively enriched on `GET /api/pedidos`.

## Backups (`backups/` dir)

- **Block:** every 3 days (checked hourly), keeps max 10, manual `POST /api/backup`. Also creates `db.json.bak` on every mutation.
- **Tienda:** every hour + on server start, keeps max 30. Admin endpoints: `GET /api/backups`, `POST /api/backups` (create), `POST /api/backups/restaurar` (restore), `DELETE /api/backups/:nombre`.

## Excel import

- **By browser (preferred):** button `⬆ IMPORTAR` in `index.html` parses an `.xlsx` client-side with SheetJS (CDN) and sends the batch to `POST /api/codigos/batch`. It scans all sheets and finds the header row (first 15 rows) by matching columns `ID Deteccion`, `SUB Tipo de Spot`, `VersiOn`, `Marca`, `Submarca`, `Producto` (order/case tolerant). If no sheet matches, it shows a diagnostic listing each sheet's structure. Upsert semantics: existing codes are updated (preserving `propietarios_ids`), new ones inserted. **Atomic**: the server snapshots `db.codigos` before applying and restores it if the batch or `persistir()` fails — the DB is never left half-imported. Duplicates inside the batch: last occurrence wins. Tipo is normalized server-side by `limpiarTipo()` (`MENCIÓN→MENCION`, `I. AMBIENTAL→I.AMBIENTAL`, `I. ACTIVA→I.ACTIVA`, `ACCIÓN ESPECIAL→ACCION ESPECIAL`).
- **Python script (for large RevQA files):** `transferir_ids.py` (copies in root and `importID/`) prioritizes the latest `RevQA_*_filtrado.xlsx` (clean output of `ejecutar.bat`/`filter_revqa.py`); if none, reads the raw `RevQA_*.xlsx` sheet `Calidad Dedicado` with pandas `usecols` (the raw sheet is ~1 GB, too big for the browser) and filters to allowed tipos + dedups. Normalizes tipo and **POSTs the batch to `POST /api/codigos/batch`** (live, atomic, with rollback). The server must be running (`INICIAR_CODIGOS.bat`). To change the target server, edit `SERVER_URL`.

## Windows firewall — port 3030

```powershell
New-NetFirewallRule -DisplayName "Block Codigos" -Direction Inbound -LocalPort 3030 -Protocol TCP -Action Allow
```

## Tienda user management

- Simple string names in `usuarios` array. No passwords.
- `Admin` is reserved — requires `TIENDA2026` key via password modal.
- Other users selected from `<select>` at login. New users self-register from login screen.
