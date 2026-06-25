# README — Asistente IA de Producto Dropi

Tu plataforma SaaS interna de producto, versión "cerebro". Esto es el **prompt para iniciar el proyecto** — no el código. El servidor y la UI vienen después; el valor vive aquí.

---

## Qué te llevas (4 archivos)

| Archivo | Qué es | Rol |
|---------|--------|-----|
| `00_Orquestador.md` | El system prompt maestro | El cerebro: identidad, lente, contexto Dropi, ruteo, entregables |
| `01_Modulos_Fases.md` | Detalle operativo F0–F5 | Cómo corre cada fase, sus gates y trampas |
| `02_Plantillas_Entregables.md` | Las 4 salidas | Intervention Brief · Experiment Card · Patrón · Resumen ejecutivo |
| `03_README.md` | Este archivo | Cómo arrancar hoy y cómo migrarlo a servidor |

Arquitectura: **modular** (orquestador + módulos). Contexto Dropi: **embebido** (autocontenido). Flujo: **asesor flexible** (avisa si saltas un gate, no bloquea).

---

## Cómo arrancar HOY (prompting puro, sin servidor)

**Opción A — Pegar todo como un solo system prompt.**
Concatena en este orden: `00` + `01` + `02`. Pégalo como instrucción de sistema en cualquier interfaz que lo permita (la consola de Claude, un Proyecto, un GPT custom). Empieza a hablarle de cualquier decisión de producto. Él detecta la fase y corre el método.

**Opción B — Como Proyecto con archivos de conocimiento.**
Pon `00_Orquestador.md` como instrucción del proyecto y sube `01` y `02` como archivos de conocimiento. Más limpio de mantener.

**Primer mensaje sugerido para probarlo:**
> "Tengo un problema de activación: muchos sellers se registran y conectan tienda, pero no crean su primera orden. Ayúdame."

Lo correcto es que **no te dé soluciones** — debe llevarte a F0 (definir el comportamiento) y exigir el dato antes de diagnosticar. Si te suelta features de una, el prompt no está cargando bien.

---

## Workspace conversacional incluido

Este repo incluye la pantalla principal del asistente: un **workspace conversacional de 3 paneles** para uso diario del PM.

1. Sirve la carpeta del repo con un servidor local:
   ```bash
   python -m http.server 8000
   ```
2. Abre `http://localhost:8000` en el navegador.
3. Usa el rail izquierdo para navegar entre **Ciclos**, Workspace, Biblioteca de Patrones y Contexto Dropi, además de alternar modo claro/oscuro.
4. En **Ciclos**, retoma cards con mini-stepper F0–F5 o pulsa “Nuevo ciclo” para abrir F0 desde comportamiento.
5. En **Workspace**, conversa con diagnóstico B=MAP, gate flexible, comandos `/nuevo-ciclo`, `/brief`, `/experimento`, `⌘K` y `⌘↵` para enviar.
6. En el panel derecho alterna **Intervention Brief ⇄ Experiment Card**, exporta Markdown y conserva tags de riesgo cuando decides “Avanzar igual”.
7. En **Biblioteca** explora patrones/anti-patrones filtrables por causa M/A/P; en **Contexto** revisa doctrina, mapa cognitivo y campos `[CONFIRMAR]`.

Limitación actual: la UI todavía no llama a un LLM real. Implementa la interacción, el estado mínimo y la construcción viva del brief en frontend; el siguiente paso técnico es conectar el formulario a un endpoint que envíe el prompt compilado y el historial al modelo.

---

## Cómo migrarlo a servidor propio (cuando estés listo)

El cerebro no cambia; cambia la envoltura. Tres piezas:

1. **System prompt** = `00` (+ `01`, `02` inyectados). Va en cada llamada al modelo.
2. **Contexto Dropi** = hoy embebido en la Sección 6 del orquestador. Cuando crezca, sácalo a una base de conocimiento (RAG) y deja en el prompt solo el índice. Así actualizas OKRs/perfiles sin tocar el prompt.
3. **Memoria de ciclos** = la Biblioteca de Patrones. Persiste cada entrada (`02`, plantilla 3) en una base. El asistente la consulta para no re-diagnosticar desde cero. Esta es la pieza que convierte el chatbot en *sistema que aprende*.

Pila mínima sugerida: Claude API (ya la usas en Komplaid) + un store para patrones (Postgres/Notion/lo que sea) + una UI conversacional. Nada exótico.

---

## Mantenimiento del contexto Dropi

La Sección 6 del orquestador tiene marcadores `[CONFIRMAR]` en los campos que aún no tienen dato duro:
- Baseline y meta de los KPIs Q3 (activación bruta/neta, TTV bruto/neto).
- Definición operativa de "orden rentable" (con Finanzas).

Cuando los tengas, edítalos directamente en `00`. El resto del contexto (mapa cognitivo, doctrina, Dropi Score, OKRs) está cargado y verificado contra tu memoria de proyecto.

---

## Lo que este asistente NO hace (por diseño)
- No te valida por validarte — te caza vacíos.
- No te deja saltar de problema a solución sin diagnóstico (te avisa).
- No inventa datos en los entregables — marca los huecos.
- No reemplaza el proceso de Dropi (Gate 1, Dropi Score, delivery). Corre **por debajo**, en la capa de Deseabilidad.

---

## Próximo paso sugerido
Pruébalo con un caso real de tu backlog Q3 (ej: el cliff de activación, o el Investment ausente post-Aha). Si el flujo te sirve, el siguiente entregable natural es un **prompt de "modo experto invitado"** para que terceros del equipo (Alejandra, growth) lo usen sin perder la disciplina del método. Avísame y lo armamos.
