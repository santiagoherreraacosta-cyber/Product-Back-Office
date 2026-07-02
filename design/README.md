# Handoff: Asistente Dropi

> **Nota:** el prototipo interactivo (`Asistente Dropi.dc.html`) y su `support.js` **no se versionan aquí** (código prototipo pesado que hace fallar el Quality Gate de SonarCloud). Se conservan fuera del repo como fuente de verdad visual; en esta carpeta queda solo la referencia liviana: docs, `tokens.css` y logos.

## Overview
**Asistente Dropi** es un asistente conversacional de Product Management que guía al equipo por un ciclo de decisión de 6 fases (F0–F5) — desde nombrar un **comportamiento** hasta destilar un **patrón** reutilizable. El lenguaje de causas es **B=MAP** (Motivación / Ability / Prompt). El producto fuerza rigor con **gates** por fase: no se avanza sin cumplir la condición, salvo "Avanzar con riesgo" (que queda registrado).

Vistas: **Ciclos (Home)**, **Workspace** (chat + entregable en vivo por fase), **Biblioteca de Patrones** (memoria del equipo) y **Contexto Dropi** (base de conocimiento versionada).

## About the Design Files
Los archivos de este bundle son **referencias de diseño creadas en HTML** — prototipos que muestran el look y el comportamiento buscados, **no** código de producción para copiar tal cual. La tarea es **recrear estos diseños en el entorno del codebase destino** (React, Vue, etc.) usando sus patrones y librerías establecidas. Si aún no existe un entorno, elegir el framework más apropiado (recomendado: **React + TypeScript**, ya que el prototipo es React) e implementarlos ahí.

El archivo `Asistente Dropi.dc.html` es un **Design Component** autocontenido: se abre en el navegador y ya incluye **todos los estados** (happy / loading / error / empty) navegables. Úsalo como fuente de verdad visual e interactiva.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son definitivos. Recrear la UI pixel-perfect con las librerías del codebase. Todos los valores exactos están en `tokens.css`; el desglose de componentes en `COMPONENTS.md`; el modelo de datos, la máquina de gates, los contratos de API y los flujos e2e en `Kit de implementacion - Asistente Dropi.md`.

## Screens / Views

### 1. Ciclos (Home) — `/`
- **Purpose**: retomar un ciclo en curso o arrancar uno nuevo desde un comportamiento.
- **Layout**: sidebar 250px (izq) + main fluido. Header (título `Ciclos` 28px + subtítulo + segmented `Con datos/Primer uso` + botón brand `Nuevo ciclo`). Contenido max-width 1120px: sección "En curso" (grid 2col de `CycleCard` open) + "Cerrados" (grid 2col de `CycleCard` closed).
- **Components**: `CycleCard`, `MiniStepper`, `CauseChip`, `Badge(risk/result)`, `CognitiveTransition`, `SegmentedControl`, `EmptyState` (variante "Primer uso").
- **Estados**: happy (con datos) · empty (Primer uso → CTA "Crear tu primer ciclo") · [añadir loading skeleton y error de carga].

### 2. Workspace — `/cycles/:id`
- **Purpose**: conversar por la fase activa mientras el entregable se construye en vivo.
- **Layout**: 3 columnas — Sidebar 250px · Main (header de fase + conversación scroll + composer sticky) · DeliverableRail 392px (der).
- **Header**: pill de fase activa (`F1 · Diagnose`), título del ciclo, botón `Avanzar a Fx ✓` (o `Cerrar ciclo` en F5), botón `⌘K`, y `PhaseBar` clickable debajo.
- **Sidebar**: "Ciclo activo" (card con título + chips) + `PhaseRail` clickable.
- **Conversación**: `MessageBubble` (ai/user), `DeliverableCard` (B=MAP, Behavior Statement, Experiment Card…), `GateCard`.
- **Composer**: textarea + slash-chips + enviar.
- **DeliverableRail**: toggle Brief/Experiment (o PatternView en F5), progreso, Exportar, "Riesgos asumidos".
- **Contenido por fase** (los 6 estados están en el prototipo):
  - **F0 Sense**: incluye el **error "eso es una solución, no un comportamiento"** (burbuja roja) → corrección → Behavior Statement + señal 31% → GateCard `ready`.
  - **F1 Diagnose**: diagnóstico B=MAP (Ability), evidencia 1/2 → GateCard `blocked` (≥2 fuentes).
  - **F2 Design**: intervención mapeada a causa + hipótesis falsable → GateCard `ready`.
  - **F3 Decide**: Experiment Card con `stopCriterion` `[CONFIRMAR]` → GateCard `blocked`.
  - **F4 Deploy**: monitor "En vivo" (44%, muestra 512/1200, eventos) → GateCard `running`.
  - **F5 Distill**: resultado 52%, `DecisionPicker` (Escalar/Matar/Iterar), input de nombre de patrón → `Cerrar ciclo`.
- **Estados especiales**: `ThinkingBubble` (IA pensando tras enviar), banner morado de **Iteración 2** (loop), toast al cerrar.

### 3. Biblioteca de Patrones — `/library`
- **Purpose**: buscar/reutilizar patrones y anti-patrones aprendidos.
- **Layout**: header (título + búsqueda) + `FilterBar` + grid 2col de `PatternCard`, max-width 1080px.
- **Estados**: happy · empty "Sin resultados" (filtro/búsqueda sin match → "Limpiar filtros") · toast "Ciclo cerrado y patrón guardado".

### 4. Contexto Dropi — `/context`
- **Purpose**: base de conocimiento versionada (doctrina, mapa cognitivo, sub-perfiles, OKRs, Dropi Score).
- **Layout**: TOC sticky 190px + artículo 760px. Banner "N campos sin confirmar". Campos `[CONFIRMAR]` resaltados. Tabla de niveles cognitivos. Editable sólo por admin.

### Modales
- **Nuevo ciclo**: textarea de comportamiento + sub-perfil sugerido + transición cognitiva + `Crear ciclo · abrir F0`.
- **Command Palette (⌘K)**: navegar + acciones.
- **Export**: `loading` (spinner) → `error` (lista de campos `[CONFIRMAR]`, "Exportar con supuestos" / "Completar campos").

## Interactions & Behavior
- **Navegación de fases**: `PhaseBar` y `PhaseRail` son clickables (jump). El botón `Avanzar` aplica la máquina de gates; en F5 dispara cierre.
- **Gates**: `ready` deja avanzar; `blocked` ofrece "Cerrarlo primero" / "Avanzar con riesgo" (registra `skipped` + `risks++`). Ver reglas exactas en el Kit §3.
- **IA pensando**: al enviar, se agrega la burbuja del usuario + `ThinkingBubble` (puntos animados), y ~1.5s después llega la respuesta (en prod: streaming SSE).
- **Loop de iteración**: cerrar con "Iterar" NO cierra el ciclo → vuelve a F1, `iterated=true`, banner morado.
- **Export**: valida el brief; si hay `[CONFIRMAR]`, error `422 { missing[] }` → modal.
- **Hover**: cards elevan (`--shadow-hover`, `translateY(-1px)`, borde `--brand-tint-br`), transición `140ms ease`.
- **Animaciones**: `dotpulse` (thinking), `spin` (export), `fadein` (modales).

## State Management
Estado principal (ver Kit §2 para tipos completos):
- `view`, `activeCycleId`, `deliverable('brief'|'experiment')`.
- Por ciclo: `phase`, `skipped[]`, `risks`, `iterated`, `status`, `result`.
- Conversación: `convo{ [cycleId:phase]: Message[] }`, `thinking`, `draft`.
- UI: `homeEmpty`, `librarySearch`, `libraryFilter`, `chosenResult`, `patternName`, `closedToast`, `exportState('loading'|'error'|null)`.
- **Gates y cierre deben re-validarse server-side** (no confiar en la UI). Contratos en Kit §5; eventos de tracking en §6.

## Design Tokens
Ver **`tokens.css`** (CSS custom properties + mirror TS). Resumen:
- **Neutrals**: bg `#FAFAF8`, rail `#F5F5F1`, surface `#FFFFFF`, border `#E8E8E3`, ink `#1F2328`, muted `#6B7280`/`#9AA1AB`.
- **Brand**: `#FF6B00` (+ tint `#FFF0E6`).
- **Causas B=MAP**: M `#8B5CF6`, A `#3B82F6`, P `#14B8A6` (cada una con bg claro).
- **Semántica**: ok `#10B981`, warn `#F59E0B` (`[CONFIRMAR]`/riesgo), danger `#C23B3B`, iterate `#7C4BD6`.
- **Type**: Inter (UI) + JetBrains Mono (datos/evidencia/IDs). Escala 10.5–28px; headings letter-spacing negativo; labels uppercase +.06em.
- **Radius**: 5/7/9/12/14/16px + pill. **Shadows**: card/hover/modal/brand.

## Assets
- `logo-asistente-dropi.svg`, `logo-product-lens.svg` — logos incluidos en el bundle. En el prototipo el logo se dibuja como glifo cúbico brand `◐/◈`; sustituir por estos SVG.
- Iconografía: glifos Unicode simples (`◐ ◈ ✓ ✕ ! ▷ ↻ ⌂ ▦ ⓘ ➜ ⌕`). Reemplazar por el set de íconos del codebase (Lucide/Phosphor) manteniendo tamaño y peso.
- No hay imágenes rasterizadas ni fuentes propias fuera de Google Fonts (Inter, JetBrains Mono).

## Files
- `Asistente Dropi.dc.html` — prototipo hifi con **todos los estados y flujos** (fuente de verdad).
- `Kit de implementacion - Asistente Dropi.md` — modelo de datos, máquina de fases/gates, contratos de API, eventos, flujos e2e.
- `COMPONENTS.md` — inventario de componentes con props/variantes.
- `tokens.css` — design tokens.
- `logo-asistente-dropi.svg`, `logo-product-lens.svg` — assets de marca.

> El `support.js` del prototipo es sólo el runtime del Design Component; **no** se porta a producción.
