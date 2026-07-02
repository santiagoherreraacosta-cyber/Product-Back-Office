# Mapa Front ↔ Back (estado real)

Cruce de cada llamada del frontend (`app.js`) contra las rutas del backend (`server.js`).
Objetivo: garantizar que no haya "front muerto" (UI que llama a algo que no existe).

## ✅ Conectado y con persistencia real
Todas las llamadas `fetch` del front tienen endpoint que responde:

| Front (app.js) | Back (server.js) | Persistencia |
|---|---|---|
| `POST /api/auth/login` | ✅ implementado | usuarios en memoria (env vars) |
| `GET /api/auth/me` | ✅ | JWT |
| `GET/POST/PATCH /api/cycles`, `/api/cycles/:id`, `/close` | ✅ | `data/cycles.json` |
| `GET /api/patterns`, `POST /api/patterns/:id/reuse` | ✅ | `data/patterns.json` |
| `GET/PATCH /api/context`, `/api/context/:id` | ✅ | `src/contextStore.js` |
| `POST /api/chat` | ✅ | Anthropic API + persiste mensajes en el ciclo |

Editar campos del Brief, selector B=MAP, avanzar fase, cerrar ciclo → todo va por `PATCH /api/cycles` y persiste.

## ⚠️ Degradado (responde, pero limitado)
- **`POST /api/chat` sin `ANTHROPIC_API_KEY`**: el back responde con un stub `[LLM no configurado…]` en vez del modelo. No es front muerto, pero el chat no es útil hasta poner la key en Railway.

## 💾 Persistencia durable (DATA_DIR / volumen)
`server.js` y `src/contextStore.js` leen/escriben en `DATA_DIR` (default: `./data`).
En Railway el filesystem es efímero, así que para no perder ciclos/patrones al redeploy:
- Crear un **volumen persistente** en Railway y setear `DATA_DIR=/data` (ruta de montaje del volumen).
- En el primer arranque, `seedDataDir()` copia los archivos semilla (`context_documents.json`, `cycles.json`, `patterns.json`, `audit_events.json`) al volumen si faltan → el app queda funcional de inmediato y luego persiste.
- Sin `DATA_DIR`, todo sigue igual que antes (usa `./data` del repo). Ver `docs/infraestructura.md`.

## 🗂️ Código no desplegado en el repo (no es el app vivo)
- **`server/src/` (backend TypeScript)** — WIP con valor y **testeado** (`npm test` corre `phaseEngine`, `promptBuilder`, `extractionService`; el CI `lint` chequea `server/src/db/*`). Contiene la máquina de **gates** (`phaseEngine.ts`), extracción estructurada del LLM y la capa **Postgres** (`db/`). **No está cableado** al app vivo (que es `server.js`). Se conserva como base para: persistencia Postgres (v2) y los gates del handoff.
- **`web/` (frontend Vite)** — era un esqueleto (login + placeholder), superado por el frontend vanilla desplegado. **Eliminado** del repo por ser código muerto.

## 🧩 Solo cliente (no necesitan backend — no es front muerto)
- **Exportar Brief** (`downloadBrief`): genera Markdown en el navegador (Blob). Correcto que no toque backend.
- **Slash commands** (`/nuevo-ciclo`, `/brief`, `/experimento`), command palette, toggle de tema, placeholder rotativo: lógica de UI pura.

## ❌ Diseñado en el handoff pero NO construido (ni front ni back — "faltantes", no mocks colgando)
Esto NO es front muerto (no hay UI llamando al vacío); son features del kit que aún no existen en ninguna capa:
1. **Gates server-side** — `GET /cycles/:id/gate` y validación `422 {missing[]}` en `advance`/`close`. Hoy el avance de fase es libre (client-side).
2. **Export con validación 422** — el modal de "campos [CONFIRMAR] pendientes" antes de exportar.
3. **Loop de iteración** — cerrar con `result=iterando` debería volver a F1; hoy `/close` siempre marca `estado=cerrado`.
4. **Validación de comportamiento F0** — rechazar input tipo "feature" (burbuja roja).
5. **Streaming SSE** del chat — hoy es JSON no-streaming (funciona, sin efecto de tipeo).
6. **Eventos de analytics** (`gate_passed`, `cycle_iterated`, etc.) — solo existe `audit_events`, no el tracking del handoff.

## Conclusión
No hay pantallas ni botones llamando a endpoints inexistentes. Lo pendiente son features nuevas del handoff (punto ❌), que requieren trabajo de back + front juntos si se decide implementarlas.
