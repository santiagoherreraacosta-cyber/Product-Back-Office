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
