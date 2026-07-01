# Kit de implementación — Asistente Dropi

Handoff para llevar el prototipo `Asistente Dropi.dc.html` a producción. Cubre modelo de datos, la máquina de estados de fases/gates, componentes, contratos de API, eventos de tracking, y los estados/flujos e2e (incluye happy, loading, error, empty).

Stack sugerido: **React + TypeScript**, estado de servidor con **React Query/tRPC**, backend Node/Postgres, LLM vía streaming (SSE). El prototipo ya es React; los nombres de props/estado son 1:1 con la implementación.

---

## 1. Concepto núcleo

Un **Ciclo** avanza por 6 **fases** (F0–F5). Cada fase produce/actualiza un **entregable** y tiene un **gate** (condición de salida). El sistema **nunca** deja avanzar sin cumplir el gate, salvo "Avanzar con riesgo" (queda registrado). Al cerrar (F5) se destila un **Patrón** que va a la Biblioteca (memoria del equipo). El lenguaje de causas es **B=MAP** (Motivación / Ability / Prompt).

```
F0 Sense → F1 Diagnose → F2 Design → F3 Decide → F4 Deploy → F5 Distill
 (comportamiento)  (causa)   (hipótesis)  (experimento)  (corriendo)  (patrón)
```

---

## 2. Modelo de datos

### 2.1 Enums

```ts
type Cause = 'M' | 'A' | 'P';                    // Motivación, Ability, Prompt
type PhaseId = 'F0'|'F1'|'F2'|'F3'|'F4'|'F5';
type PhaseIndex = 0|1|2|3|4|5;
type CycleStatus = 'open' | 'closed';
type CycleResult = 'escalado' | 'matado' | 'iterando';
type CognitiveLevel = 'Setup' | 'Aha' | 'Hábito' | 'Maestría';
type PatternType = 'patron' | 'anti_patron';
type SourceStatus = 'confirmada' | 'pendiente';  // pendiente = [CONFIRMAR]
```

### 2.2 Entidades

```ts
interface Cycle {
  id: string;
  title: string;                 // el comportamiento en lenguaje natural
  behaviorStatement: string;     // versión canónica (F0)
  signal: { metric: string; value: number; unit: '%'|'pp'|'abs'; n: number; window: string };
  subProfile: string;            // sub-perfil (FK a ContextProfile)
  cause: Cause | null;           // se fija en F1
  levelFrom: CognitiveLevel;
  levelTo: CognitiveLevel;
  phase: PhaseIndex;             // fase activa
  skipped: PhaseIndex[];         // gates saltados "con riesgo"
  risks: number;                 // nº de riesgos asumidos
  iterated: boolean;             // pasó por un loop de iteración
  iterationCount: number;        // 1 = primer intento
  status: CycleStatus;
  result: CycleResult | null;    // sólo si closed
  delta: string | null;          // efecto medido, ej "+21pp publish 48h"
  patternId: string | null;      // patrón destilado (F5)
  lastActivityAt: string;        // ISO
  createdBy: string; createdAt: string; updatedAt: string;
}

interface Brief {                // entregable de F1/F2 (Intervention Brief)
  cycleId: string;
  targetBehavior: string;
  subProfile: string;
  cognitiveLevel: string;        // "Setup → Aha"
  cause: Cause | null;
  evidence: Evidence[];          // gate F1 exige >= 2 confirmadas
  interventionHypothesis: Field; // F2
  successMetric: Field;          // F3
}

interface Evidence { id: string; text: string; source: string; status: SourceStatus; }
interface Field { value: string | null; status: SourceStatus; } // status 'pendiente' => [CONFIRMAR]

interface Experiment {           // entregable de F3/F4 (Experiment Card)
  cycleId: string;
  hypothesis: string;
  variable: string;
  primaryMetric: string;
  stopCriterion: Field;          // gate F3 exige confirmado
  sampleSize: number;
  durationDays: number;
  tracking: string[];            // eventos, ej ['import_start','import_done','publish']
  status: 'borrador' | 'live' | 'cerrado';
  live?: { day: number; totalDays: number; sampled: number; current: number; baseline: number };
}

interface Pattern {              // entregable de F5 (Pattern Card) -> Biblioteca
  id: string;
  cycleId: string;
  type: PatternType;
  title: string;
  cause: Cause;
  subProfile: string;
  delta: string;
  reuseCount: number;
  createdAt: string;
}

interface Message {              // conversación por fase
  id: string; cycleId: string; phase: PhaseIndex;
  role: 'user' | 'ai' | 'system';
  text: string;
  attachments?: { kind: 'evidence'|'brief'|'experiment'; refId: string }[];
  createdAt: string;
}

interface ContextDoc {           // Contexto Dropi (versionado, editable por admin)
  version: number;
  doctrine: string;
  cognitiveMap: { level: CognitiveLevel; definition: Field; intervention: Field }[];
  subProfiles: { name: string; description: string; typicalFriction: Cause; status: SourceStatus }[];
  okrs: string;
  dropiScore: string;
}
```

---

## 3. Máquina de estados — Fases y Gates

Cada gate es una **función pura** `canAdvance(cycle, brief, experiment) → { ok: boolean; missing: string[] }`. La UI usa `missing` para pintar el gate abierto/bloqueado.

| Fase | Entregable | Regla de gate (`canAdvance`) |
|---|---|---|
| **F0 Sense** | Behavior Statement | comportamiento bien formado (quién·hace·no-hace·desde) **Y** `signal.value != null` |
| **F1 Diagnose** | Brief · causa | `evidence.filter(confirmada).length >= 2` **Y** `cause != null` |
| **F2 Design** | Brief · hipótesis | intervención mapeada a `cause` **Y** `interventionHypothesis` falsable/confirmada |
| **F3 Decide** | Experiment Card | `primaryMetric` **Y** `sampleSize && durationDays` **Y** `stopCriterion.status==='confirmada'` |
| **F4 Deploy** | Experiment · live | `experiment.status==='live'` **Y** `tracking.length>0` confirmado |
| **F5 Distill** | Pattern Card | `result != null` **Y** `pattern.title` no vacío |

Transiciones:

```
advance(cycle):
  if phase < 5 and canAdvance(): phase += 1
  if phase < 5 and !canAdvance() and userChoseRisk:
       skipped.push(phase); risks += 1; phase += 1     // "Avanzar con riesgo"
  if phase == 5: close(cycle)

close(cycle):
  result = escalado | matado  -> status='closed'; crear Pattern; mover a "Cerrados"; toast
  result = iterando           -> phase=1 (Diagnose); iterated=true; iterationCount+=1;
                                 risks+=1; NO se cierra (loop de re-diagnóstico)
```

**Validación del comportamiento (F0)** — regla de "feature vs comportamiento": rechazar si el input es una solución/feature (heurística LLM + lista de verbos de producto: "construir", "wizard", "botón", "pantalla"…). Devuelve el error inline en vez de aceptar.

---

## 4. Pantallas y sus estados

Ruta → estados que debe implementar cada una (happy / loading / error / empty):

### 4.1 Home · Ciclos (`/`)
- **happy**: grid "En curso" + "Cerrados" con tarjetas (fase, causa, transición cognitiva, mini-stepper, riesgos).
- **empty** (`Primer uso`): sin ciclos → CTA "Crear tu primer ciclo".
- **loading**: skeleton de tarjetas.
- **error**: banner "no se pudieron cargar los ciclos" + reintentar.

### 4.2 Workspace (`/cycles/:id`) — depende de `phase`
- Header: pill de fase activa + phase-bar clickable (jump) + botón `Avanzar a Fx` / `Cerrar ciclo` + ⌘K.
- Rail izq: ciclo activo + "Fases del ciclo" (stepper clickable, gate cerrado/abierto/saltado).
- Centro: conversación por fase + composer.
- Rail der: entregable en vivo (Brief / Experiment / Pattern según fase).
- **Estados de la conversación**:
  - **happy**: turnos + entregable actualizándose.
  - **loading / "IA pensando"**: burbuja con 3 puntos (`@keyframes dotpulse`) tras enviar; respuesta por streaming.
  - **error (gate bloqueado)**: tarjeta ámbar con `missing[]` + acciones "Cerrarlo primero" / "Avanzar con riesgo". (Ej. F3 sin `stopCriterion`.)
  - **error (F0 feature)**: burbuja roja "Eso es una solución, no un comportamiento".
  - **error (LLM)**: burbuja de sistema "No pude procesar, reintenta".
  - **loop (iteración)**: banner morado "Iteración 2 — de vuelta en F1".

### 4.3 Biblioteca de Patrones (`/library`)
- **happy**: grid filtrable (Todos / Patrón / Anti-patrón / M / A / P) + búsqueda por texto.
- **empty (sin resultados)**: filtro/búsqueda sin match → "Sin resultados" + "Limpiar filtros".
- **empty (biblioteca vacía)**: aún no se cierra ningún ciclo.
- **toast**: "Ciclo cerrado y patrón guardado — {título}" al llegar desde F5.

### 4.4 Contexto Dropi (`/context`)
- **happy**: doc versionado con TOC sticky; campos `[CONFIRMAR]` resaltados; banner "N campos sin confirmar — la IA los tratará como supuestos".
- Editable sólo por admin (permiso `context:write`).

### 4.5 Modales
- **Nuevo ciclo**: textarea de comportamiento + sub-perfil sugerido + transición cognitiva.
- **Command palette (⌘K)**: navegar + acciones.
- **Export**: loading (spinner) → **error** si el brief tiene campos `[CONFIRMAR]` (lista los campos, "Exportar con supuestos" / "Completar campos") → success (descarga Markdown).

---

## 5. Contratos de API

REST/tRPC. Todas las respuestas incluyen `updatedAt` para optimistic concurrency.

```
# Ciclos
GET    /cycles?status=open|closed            -> Cycle[]
POST   /cycles            { title }           -> Cycle            // crea en F0, corre validación de comportamiento
GET    /cycles/:id                            -> { cycle, brief, experiment, messages }
PATCH  /cycles/:id/advance { risk?: boolean } -> { cycle, gate }  // aplica máquina de fases
PATCH  /cycles/:id/phase   { index }          -> Cycle            // jump manual (review)
POST   /cycles/:id/close   { result, patternTitle? } -> { cycle, pattern? }  // maneja iterar
GET    /cycles/:id/gate                       -> { ok, missing[] } // para pintar gate en vivo

# Conversación (streaming)
POST   /cycles/:id/messages { text }          -> SSE  // emite tokens 'ai' + posibles updates de entregable
                                                        // durante streaming: estado "IA pensando"

# Entregables
PATCH  /cycles/:id/brief       { ...partial } -> Brief
PATCH  /cycles/:id/experiment  { ...partial } -> Experiment
POST   /cycles/:id/evidence    { text, source } -> Evidence

# Export
POST   /cycles/:id/export { format:'md', force?:boolean } -> 200 file | 422 { missing[] }
                                                            // 422 dispara el modal de error

# Biblioteca
GET    /patterns?q=&type=&cause=              -> Pattern[]
POST   /patterns/:id/reuse                    -> Pattern  // incrementa reuseCount

# Contexto
GET    /context                               -> ContextDoc
PATCH  /context { ...partial }                -> ContextDoc   // requiere context:write; crea nueva versión
```

**Gate en el backend**: `advance` y `close` re-validan el gate server-side (no confiar en la UI). `422` con `missing[]` si no cumple y `risk!==true`.

---

## 6. Eventos de tracking (analytics)

Emitir en cada transición para poder medir el propio proceso:

```
cycle_created            { cycleId, subProfile }
behavior_rejected        { cycleId, reason:'feature' }     // error F0
gate_passed              { cycleId, phase }
gate_skipped_with_risk   { cycleId, phase }                // "Avanzar con riesgo"
message_sent             { cycleId, phase, role:'user' }
ai_response              { cycleId, phase, latencyMs }
experiment_live          { cycleId }                        // + eventos del experimento: import_start / import_done / publish
cycle_closed             { cycleId, result }                // escalado|matado|iterando
cycle_iterated           { cycleId, iterationCount }
pattern_created          { patternId, type, cause }
pattern_reused           { patternId }
export_attempted         { cycleId, ok, missingCount }
```

---

## 7. Flujos e2e (aceptación)

**Crear → diagnosticar → decidir → cerrar (happy):**
1. Home → "Nuevo ciclo" → describir comportamiento → `POST /cycles` (F0).
2. F0: statement + señal → gate ok → Avanzar a F1.
3. F1: agregar ≥2 evidencias confirmadas + fijar causa → gate ok → F2.
4. F2: intervención mapeada + hipótesis → F3.
5. F3: completar `stopCriterion` → gate ok → F4.
6. F4: experimento `live` con tracking → F5.
7. F5: elegir resultado + nombrar patrón → `close` → patrón en Biblioteca + toast.

**Avanzar con riesgo:** en cualquier gate bloqueado, "Avanzar con riesgo" → `advance {risk:true}` → `skipped.push(phase)`, `risks++`, marca visible en stepper y en "Riesgos asumidos".

**Loop de iteración:** F5 → resultado `iterando` → `close {result:'iterando'}` → vuelve a F1, `iterated=true`, banner "Iteración 2", `risks++`.

**Export bloqueado:** rail der → "Exportar" → loading → `422 {missing}` → modal de error con campos `[CONFIRMAR]` → "Completar campos" (vuelve al brief) o "Exportar con supuestos" (`force:true`).

**IA pensando:** composer → enviar → burbuja usuario + indicador de puntos → stream de respuesta → entregable puede actualizarse en vivo.

---

## 8. Pendiente para la próxima sesión
- **Tokens de diseño** (colores B=MAP, tipografía Inter/JetBrains Mono, radios, sombras) + inventario de componentes reusables (Chip, CauseChip, Stepper, PhaseBar, GateCard, DeliverableRail, MessageBubble).
- Empaquetado del handoff con la skill **Handoff to Claude Code** (estructura de carpetas, componentes extraídos, README de arranque).

> Fuente de verdad visual e interactiva: `Asistente Dropi.dc.html` (todos los estados anteriores ya están construidos y navegables ahí).
