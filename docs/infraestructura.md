# Infraestructura y despliegue

Este proyecto se configura como un front estático preparado para conectarse a un backend/API y a Postgres gestionado. La opción recomendada para el primer despliegue es:

- **Frontend:** Cloudflare Pages, Vercel o Netlify, sirviendo la raíz del repositorio.
- **Backend:** Cloud Run, Render, Fly.io, Railway, ECS o infraestructura interna.
- **Base de datos:** Postgres gestionado (Neon, Supabase, Render Postgres, Cloud SQL, RDS, Railway Postgres o equivalente interno).

## Ambientes

| Ambiente | Uso | Despliegue |
| --- | --- | --- |
| `dev` | Desarrollo local y pruebas manuales. | `npm run start` en la máquina local. |
| `staging` | Validación por PR y QA. | Automático en cada pull request. |
| `production` | Tráfico real. | Manual con aprobación desde GitHub Actions. |

## Variables obligatorias

Configura estas variables en cada proveedor y ambiente. No reutilices secretos entre ambientes.

| Variable | Descripción | Ejemplo local |
| --- | --- | --- |
| `DATABASE_URL` | URL de conexión a Postgres gestionado. | `postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require` |
| `LLM_API_KEY` | API key del proveedor LLM usada por el backend. | `replace-me` |
| `AUTH_SECRET` | Secreto largo y aleatorio para firmar sesiones/tokens. | `openssl rand -base64 32` |
| `APP_URL` | URL pública del ambiente. | `http://localhost:8000` |
| `NODE_ENV` | Nombre del ambiente de ejecución. | `dev`, `staging` o `production` |

También se incluye `.env.example` como plantilla local.

## Frontend

### Cloudflare Pages / Vercel / Netlify

- **Build command:** vacío o `npm run check` si el proveedor permite comandos de verificación.
- **Output directory:** `.`
- **Install command:** `npm install` o el valor por defecto del proveedor.
- **Staging:** conecta previews de PR al ambiente `staging`.
- **Production:** despliega únicamente desde la rama principal con aprobación manual en CI/CD.

Los endpoints estáticos `health` y `ready` deben publicarse como:

- `/health`
- `/ready`

## Backend

El backend debe desplegarse como servicio separado cuando se conecte el LLM real y la persistencia. Recomendación inicial:

- **Cloud Run:** contenedor HTTP con autoscaling y secretos desde Secret Manager.
- **Render/Fly.io/Railway:** servicio web con health checks HTTP.
- **ECS/infra interna:** servicio detrás de balanceador con target group y health checks.

El backend debe exponer como mínimo:

- `GET /health`: proceso vivo.
- `GET /ready`: dependencias listas (Postgres y proveedor LLM alcanzables, si aplica).

## Base de datos

- Usa Postgres gestionado por ambiente.
- Activa SSL para conexiones externas.
- Crea bases/usuarios separados para `dev`, `staging` y `production`.
- Guarda `DATABASE_URL` en el gestor de secretos del proveedor, no en el repositorio.

## Persistencia de datos (DATA_DIR / volumen)

El backend en vivo (`server.js`) persiste ciclos, patrones, auditoría y contexto en archivos JSON dentro de `DATA_DIR` (default: `./data`). En Railway el filesystem del contenedor es **efímero**: se reinicia en cada redeploy, así que los datos creados en runtime se pierden si se usa el default.

Para un MVP durable con cambio mínimo (sin migrar a Postgres):

1. En Railway, crear un **Volume** y montarlo en una ruta, p. ej. `/data`.
2. Setear la variable de entorno **`DATA_DIR=/data`** en el servicio.
3. En el primer arranque, `server.js` (`seedDataDir()`) copia los archivos semilla (`context_documents.json`, `cycles.json`, `patterns.json`, `audit_events.json`) al volumen si faltan. A partir de ahí, todo lo que se crea persiste entre redeploys.

Sin `DATA_DIR`, el comportamiento no cambia (usa `./data` del repo). Para producción robusta multi-instancia, migrar a Postgres gestionado (Supabase/Neon/Railway Postgres) usando la capa `server/src/db/` — ver nota en `design/FRONT-BACK-MAP.md`.

## CI/CD

El workflow `.github/workflows/deploy.yml` define:

1. **Verificación:** `npm run check` en PR y rama principal.
2. **Staging:** deploy automático para pull requests usando el ambiente `staging`.
3. **Producción:** deploy manual con `workflow_dispatch` usando el ambiente `production`; configura reglas de aprobación en GitHub Environments.

Los pasos de deploy quedan parametrizados para conectar el proveedor elegido mediante secretos:

- `STAGING_DEPLOY_HOOK_URL`
- `PRODUCTION_DEPLOY_HOOK_URL`

Si el proveedor usa CLI (por ejemplo Vercel, Netlify o Cloudflare), reemplaza los pasos `curl` del workflow por la acción/CLI oficial y conserva los environments `staging` y `production`.
