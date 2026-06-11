# AGENTS.md — block_codigos

## Two independent servers in this repo

Both run from the same directory. They share no code but coexist.

| App | Entrypoint | Port | Main page | DB file | Admin key | LAN binding |
|---|---|---|---|---|---|---|
| Block Códigos | `server.js` | 3030 | `index.html` | `db.json` | `AUDITSA2026` | `0.0.0.0` (LAN reachable) |
| Tienda Teleactiva | `tienda-server.js` | 3031 | `tienda.html` | `tienda-db.json` | `TIENDA2026` | localhost only |

## Commands

- **Block Códigos:** `npm start` or `node server.js`
- **Tienda:** `node tienda-server.js` (or double-click `INICIAR_TIENDA.bat`)
- No test, lint, typecheck, or format commands exist. Do not try to run any.

## Architecture notes

- Both servers are plain Express + `fs` for persistence. No database client. Dependencies: `express`, `cors`.
- `index.html` has embedded JS (no bundler). The "Ir a la Tienda" button is hardcoded to `http://192.168.151.152:3031/tienda.html`.
- `tienda.js` (1284 lines) calls `localhost:3031/api/*`. It retries login up to 3× with 1s delays.
- Tienda admin sessions: in-memory `Map<token, expiry>` with 2hr TTL. Token stored in `sessionStorage` — survives page reload (`ts_usuario`, `ts_esAdmin`, `ts_adminToken`, `ts_vistaAdmin`).
- Block auth: plain password check per request (`POST /api/propietarios/verificar-clave`). No session.
- Brute force on tienda admin: 5 attempts → 15 min IP block (in-memory, lost on restart). SHA-256 comparison (timing-safe via hash).
- Stock strategy: decremented on pedido creation, restored to `productos` on cancel. No separate inventory table.

## DB files (JSON)

- `db.json`: `{ codigos[], propietarios[], meta{} }`. Codigo fields: `id, codigo, version, tipo, marca, submarca, producto, propietarios_ids`.
- `tienda-db.json`: `{ usuarios[], categorias[], productos[], pedidos[], _nextProductoId, _nextPedidoId }`.
- Both read on startup, written on every mutation. Inline migrations in `cargarDB()` — field renames over time (e.g. `propietario_id→propietarios_ids`, `nombre→version`, `categoria→marca`, `notas→submarca`).
- Block deduplicates codes on DB load (keeps first occurrence).
- Products have `precioBase` (cost) and `precio` (selling price). Pedido items snapshot `precioBase` at creation; retroactively enriched on GET `/api/pedidos`.

## Backups (`backups/` dir)

| App | Schedule | Auto cleanup | Manual trigger |
|---|---|---|---|
| Block | Every 3 days (checked hourly) | Keeps max 10 | `POST /api/backup` |
| Tienda | Every hour + on server start | Keeps max 30 | `POST /api/backups` (admin) |

- Block also creates `db.json.bak` (immediate pre-write copy) on every mutation.
- Tienda supports: `GET /api/backups` (list), `POST /api/backups` (create), `POST /api/backups/restaurar` (restore), `DELETE /api/backups/:nombre` (delete) — all admin-required.

## Excel import

`transferir_ids.py` reads `id_partido.xlsx` (sheet `Hoja1`, columns `ID Deteccion`, `SUB Tipo de Spot`, `VersiOn`, `Marca`, `Submarca`, `Producto`) and merges new codes into `db.json`. De-duplicates by code. Output: `db_actualizado.json`. Requires `pandas` and `openpyxl`.

## Firewall (Windows) — port 3030 only

```
New-NetFirewallRule -DisplayName "Block Codigos" -Direction Inbound -LocalPort 3030 -Protocol TCP -Action Allow
```

## Tienda user management

- Simple string names in `usuarios` array. No passwords.
- `Admin` is reserved — requires `TIENDA2026` key via password modal.
- Other users selected from `<select>` dropdown at login. New users self-register from the login screen.
