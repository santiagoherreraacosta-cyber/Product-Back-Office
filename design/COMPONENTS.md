# Inventario de componentes — Asistente Dropi

Componentes reutilizables extraídos del prototipo `Asistente Dropi.dc.html`. Cada uno lista sus props, variantes y tokens. Los nombres son sugeridos para React+TS.

> Convención: colores/medidas → ver `tokens.css`. Todo texto de ejemplo está en español (idioma de producto).

---

## Primitivos

### `<Chip>`
Etiqueta compacta neutra.
- **props**: `label: string`, `dot?: boolean`, `tone?: 'neutral'` (default `#EFEFEA`/`#6B7280`).
- radius `--r-xs`, padding `4px 8px`, font 11px/600, dot 6px.
- Usos: sub-perfil, contadores.

### `<CauseChip>`
Chip de causa B=MAP con color por hue.
- **props**: `cause: 'M'|'A'|'P'`, `size?: 'sm'|'md'`, `selected?: boolean`.
- Deriva color de `cause[x]`; formato `"A · Ability"`; dot 6–7px; en `selected` usa borde 1.5px del color.

### `<Badge>` (resultado / riesgo / tipo)
- **variants**:
  - `risk` — `N riesgo(s)`, ámbar (`--warn-bg`/`--warn-ink`), dot.
  - `result` — `escalado` (verde ✓), `matado` (rojo ✗), `iterando` (morado ↻); uppercase 10.5px/700.
  - `patternType` — `Patrón` (verde) / `Anti-patrón` (rojo).
  - `live` — `En vivo`, brand tint, dot con halo (`box-shadow 0 0 0 3px`).
- **props**: `variant`, `value`.

### `<ConfirmTag>`
El marcador `[CONFIRMAR]`.
- mono 11px/600, `--warn-ink` sobre `--warn-bg`, radius 4px, padding `1px 5px`.
- Semántica: campo tratado como **supuesto** por la IA hasta confirmarse. Usado en Brief, Contexto, Export.

---

## Navegación de fases

### `<PhaseBar>` (horizontal, header del workspace)
Barra F0→F5 con conectores.
- **props**: `phase: 0..5`, `skipped: number[]`, `onJump(i)`.
- Nodo: 26px círculo. Estados: **done** (verde relleno, ✓), **active** (brand relleno + halo `0 0 0 4px --brand-tint`), **future** (blanco, borde). Conector verde si `i<=phase`, ámbar si el previo fue saltado. Marca de saltado: punto ámbar 7px arriba-derecha.
- Clickable (jump para review).

### `<PhaseRail>` (vertical, sidebar) — "Fases del ciclo"
Lista F0–F5 con nota de gate.
- **props**: `phase`, `skipped`, `onJump(i)`.
- Fila: dot 22px + `Fx · Nombre` + nota (`Gate cerrado` verde / `Gate abierto` brand / `Gate saltado` ámbar). Fila activa con fondo `--brand-tint`.

### `<MiniStepper>` (en tarjetas de ciclo)
6 dots 10px. done=verde, active=brand+halo, future=borde. Saltado = punto ámbar.
- **props**: `phase`, `skipped`.

### `<CognitiveTransition>`
`Setup › Aha › Hábito › Maestría` con from/to resaltados en brand, extremos atenuados.
- **props**: `from`, `to` (índices 0–3).

---

## Tarjetas

### `<CycleCard>`
Tarjeta de ciclo en Home.
- **props**: `cycle`, `variant: 'open'|'closed'`, `onOpen()`.
- **open**: header (phaseLabel chip + `<Badge risk>`), título, chips (sub + causa), `<CognitiveTransition>`, `<MiniStepper>`, footer (última actividad + "Abrir →"). Hover: borde `--brand-tint-br`, `--shadow-hover`, `translateY(-1px)`.
- **closed**: `<Badge result>` + delta mono, título atenuado, chips, stepper, nota de patrón. Opacidad .92.

### `<PatternCard>`
Tarjeta en Biblioteca.
- **props**: `pattern`, `onClick()`.
- typeBadge + causeChip, título, footer (subChip + delta mono brand + `Reutilizado N×`).

### `<GateCard>`
El bloque de decisión de gate (patrón central del producto).
- **props**: `state: 'ready'|'blocked'|'running'`, `title`, `desc`, `missing?: string[]`, `actions: {label, onClick, variant}[]`.
- **ready**: verde (`--ok-bg`, borde `rgba(16,185,129,.4)`), icono ✓, 1 botón brand.
- **blocked**: ámbar (`--warn-bg`), icono !, 2 botones ("Cerrarlo primero" brand / "Avanzar con riesgo" outline).
- **running**: brand tint, icono ▷.
- Icono 20px cuadrado; título 13.5/700; desc 13px.

### `<DeliverableCard>` (B=MAP, Behavior Statement, Experiment Card…)
Card blanca con header de label uppercase + cuerpo. Filas de evidencia usan icono-badge 16px (verde ✓ confirmada / ámbar ! pendiente).

---

## Conversación

### `<MessageBubble>`
- **props**: `role: 'user'|'ai'`, `children`.
- **ai**: grid `27px 1fr`, avatar brand `◐`, texto 14.5px.
- **user**: `justify-self:end`, max 80%, `--surface-sunk`ish `#F0EFE9`, radius `13px 13px 4px 13px`.

### `<ThinkingBubble>`
Avatar + 3 dots animados (`@keyframes dotpulse`, delay escalonado 0/.16/.32s). Burbuja `--surface-sunk`, radius `12px 12px 12px 4px`.

### `<Composer>`
- **props**: `value`, `onChange`, `onSend`, `placeholder`, `slashCommands: string[]`.
- textarea auto-grow, fila de slash-chips mono (`/fuente` `/brief` `/experimento`), hint `⌘↵ enviar`, botón enviar 32px brand `➜`.
- `placeholder` cambia por fase.

---

## Layout / paneles

### `<DeliverableRail>` (panel derecho, workspace)
- Header: título + toggle `Brief / Experiment`, `<Badge live>`, progreso (barra + `6/11`) + botón **Exportar**.
- Cuerpo según fase: `BriefView` / `ExperimentView` / `PatternView`.
- Footer: "Riesgos asumidos" con lista de `<RiskItem>` (badge fase `Fx` + texto).

### `<Sidebar>` (izquierda)
Logo + (en workspace) "Ciclo activo" + `<PhaseRail>` + nav inferior (`<NavItem>` Ciclos / Biblioteca / Contexto).

### `<CommandPalette>` (⌘K)
Input + secciones "Navegar" / "Acciones" con `<PaletteItem icon,label,onClick>`.

### `<Modal>`
Overlay `rgba(20,20,20,.28)`, card radius `--r-2xl`, `--shadow-modal`, `animation: fadein`. Usado por Nuevo ciclo, Export.

### `<EmptyState>`
- **props**: `icon`, `title`, `body`, `cta?`.
- Ícono 52–56px en tile redondeado, centrado. Variantes: Home "Primer uso" (brand tile) y Biblioteca "Sin resultados" (neutral tile).

### `<Toast>`
Banner inline verde de confirmación (cierre de ciclo), con botón ×.

---

## Controles

### `<SegmentedControl>`
Track `--chip-bg` radius `--r-md`, thumb blanco con `--shadow-card`. Usos: `Con datos/Primer uso`, `Brief/Experiment`.

### `<FilterBar>` (Biblioteca)
Pills: `Todos · Patrón · Anti-patrón · M · A · P`. Activo = brand relleno; causa lleva dot de su color.
- **props**: `value`, `onChange`, con búsqueda de texto asociada.

### `<DecisionPicker>` (F5)
3 botones-tarjeta `Escalar / Matar / Iterar`; seleccionado toma color+bg de su semántica. Cada uno: título + subtítulo.
- **props**: `value`, `onChange`.

---

## Estados de export (modal)
`loading` (spinner `@keyframes spin` + "Generando…") → `error` (lista de `<ConfirmTag>` faltantes + "Exportar con supuestos" / "Completar campos") → `success` (descarga .md).
