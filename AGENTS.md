# AGENTS.md — block_codigos

## Two independent servers in this repo

Both run from the same directory. They share no code but coexist.

| App | Entrypoint | Port | Main page | DB file | Admin key |
|---|---|---|---|---|---|
| Block Códigos | `server.js` | 3030 | `index.html` | `db.json` | `AUDITSA2026` |
| Tienda Teleactiva | `tienda-server.js` | 3031 | `tienda.html` | `tienda-db.json` | `TIENDA2026` |

## Commands

- **Start Block Códigos:** `npm start` or `node server.js`
- **Start Tienda:** `node tienda-server.js`
- No test, lint, typecheck, or format commands exist. Do not try to run any.

## Architecture notes

- `index.html` has embedded JS (no module bundler). The "Ir a la Tienda" button is hardcoded to `http://192.168.151.152:3031/tienda.html`.
- `tienda.js` is served from port 3031, calls `localhost:3031/api/*`.
- Both servers are plain Express + `fs` for persistence. No database client.
- Admin sessions in the tienda use an in-memory `Map<token, expiry>` with 2hr TTL. Token is stored in `sessionStorage`.
- Brute force protection on tienda admin login: 5 attempts → 15 min IP block (in-memory, lost on restart).
- No session persistence for block app admin — it uses a plain password check per request.
- The block app sidebar form has client-side field validation (8-digit code regex).

## DB files (JSON)

- `db.json` stores `{ codigos[], propietarios[], meta{} }`. Fields: `id, codigo, version, tipo, marca, submarca, producto, propietarios_ids`.
- `tienda-db.json` stores `{ usuarios[], categorias[], productos[], pedidos[], _nextProductoId, _nextPedidoId }`.
- Both files are read on startup and written on every mutation. No migration tooling — migrations are inline in `cargarDB()` functions.
- Backups saved to `backups/` directory. Block: every 3 days + manual. Tienda: every hour + on start + manual. Tienda keeps max 30.

## Excel import

`transferir_ids.py` reads `id_partido.xlsx` (sheet `Hoja1`) and merges into `db.json`. Requires `pandas` and `openpyxl`. Output: `db_actualizado.json`.

## Firewall (Windows)

Port 3030 needs an inbound rule for LAN access:
```
New-NetFirewallRule -DisplayName "Block Codigos" -Direction Inbound -LocalPort 3030 -Protocol TCP -Action Allow
```

## Tienda user management

- Users are simple string names in the `usuarios` array. No passwords.
- `Admin` is a reserved user that requires the `TIENDA2026` key via the password modal.
- Other users are selected from a `<select>` dropdown at login.
