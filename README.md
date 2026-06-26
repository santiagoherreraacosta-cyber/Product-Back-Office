# Asistente de Producto Dropi

Sí: este repo ya incluye un **front estático interactivo** para usar el Workspace conversacional del Asistente de Producto Dropi.

## Cómo abrir el front

Este front **no está desplegado públicamente**: `localhost` solo funciona en la máquina donde está corriendo el servidor.

Desde la raíz del repo, levanta el servidor local:

```bash
npm run start
```

El script sirve la carpeta en `0.0.0.0:8000`. Luego abre:

```text
http://localhost:8000
```

Alternativa sin npm:

```bash
python -m http.server 8000 --bind 0.0.0.0
```

Si estás en un entorno remoto como Codespaces, Gitpod, Cursor remoto o un contenedor, debes **forwardear/exponer el puerto 8000** y abrir la URL pública que te dé ese entorno. Si abres `http://localhost:8000` en tu navegador sin tener el servidor corriendo en tu propia máquina, verás `ERR_CONNECTION_REFUSED`.

## Qué incluye el front

- **Ciclos / Home:** cards de ciclos con mini-stepper F0–F5, chips de causa B=MAP y CTA “Nuevo ciclo”.
- **Workspace conversacional:** rail izquierdo, chat central, gate flexible, diagnóstico B=MAP y comandos `/brief` / `/experimento`.
- **Panel de entregable vivo:** switch entre **Intervention Brief** y **Experiment Card**, progreso, campos `[CONFIRMAR]`, riesgo persistente y exportación Markdown.
- **Biblioteca de Patrones:** cards de Patrón / Anti-patrón con filtros por causa M/A/P.
- **Contexto Dropi:** vista tipo documento con mapa cognitivo, campos `[CONFIRMAR]` y base editable conceptual.
- **Tema claro/oscuro:** persistido en `localStorage`.
- **Paleta `⌘K`:** navegación rápida y acciones principales.

## Archivos principales del front

| Archivo | Rol |
| --- | --- |
| `index.html` | Estructura de la app y vistas principales |
| `styles.css` | Sistema visual, temas, layout y componentes |
| `app.js` | Estado local, navegación, comandos, gates y exportación |

## Limitación actual

El front todavía **no llama a un LLM real**. Funciona como prototipo funcional local: simula interacciones clave, mantiene estado en `localStorage` y deja lista la UX para conectar un backend/API.

Para detalles del prompt y arquitectura del asistente, revisa `03_README.md`.
