// Phase gate engine (ported from server/src/domain/phaseEngine.ts to plain JS).
// The isMet() checks accept BOTH the generic English shape used by the original
// tests AND the live Spanish cycle schema produced by server.js / app.js
// (cycle.brief.<field>.value/confirmed, cycle.causa = "M"|"A"|"P", etc.), so the
// same engine works for the deployed data model.

const PHASES = ["F0", "F1", "F2", "F3", "F4", "F5"];

const GATE_REQUIREMENTS = {
  F0: [
    { key: "behaviorStatement", message: "Falta el comportamiento objetivo.", isMet: hasBehaviorStatement },
    { key: "quantitativeSignal", message: "Falta la señal cuantitativa.", isMet: hasQuantitativeSignal },
  ],
  F1: [
    { key: "sources", message: "Faltan al menos 2 fuentes de evidencia.", isMet: hasAtLeastTwoSources },
    { key: "bmapCause", message: "Falta la causa B=MAP (Motivación, Ability o Prompt).", isMet: hasBmapCause },
  ],
  F2: [
    { key: "intervention", message: "Falta la intervención.", isMet: hasIntervention },
    { key: "falsifiableHypothesis", message: "Falta la hipótesis falsable.", isMet: hasFalsifiableHypothesis },
  ],
  F3: [
    { key: "metric", message: "Falta la métrica de éxito.", isMet: hasMetric },
    { key: "sizeAndDuration", message: "Falta tamaño de muestra / duración.", isMet: hasSizeAndDuration },
    { key: "stopCriteria", message: "Falta el criterio de stop.", isMet: hasStopCriteria },
  ],
  F4: [{ key: "trackingConfirmed", message: "Falta confirmar el tracking.", isMet: hasTrackingConfirmed }],
  F5: [
    { key: "decision", message: "Falta la decisión de cierre.", isMet: hasDecision },
    { key: "namedPattern", message: "Falta nombrar el patrón.", isMet: hasNamedPattern },
  ],
};

export function getCurrentPhase(cycle) {
  const phase = cycle.fase_actual ?? cycle.currentPhase ?? cycle.activePhase ?? cycle.phase;
  return isPhase(phase) ? phase : "F0";
}

export function canClosePhase(cycle, phase) {
  return getMissingGateRequirements(cycle, phase).length === 0;
}

// Returns { key, message }[] of unmet requirements for the given phase.
export function getMissingGateRequirements(cycle, phase) {
  assertPhase(phase);
  return GATE_REQUIREMENTS[phase]
    .filter((req) => !req.isMet(cycle))
    .map((req) => ({ key: req.key, message: req.message }));
}

export function acceptRisk(cycle, phase, riskText, actor = {}) {
  assertPhase(phase);
  if (!String(riskText ?? "").trim()) throw new Error("Risk text is required.");
  const risk = {
    id: `${phase}-risk-${(cycle.risks ?? []).length + 1}`,
    phase,
    text: String(riskText).trim(),
    acceptedBy: actor,
    acceptedAt: new Date().toISOString(),
  };
  return { ...cycle, risks: [...(cycle.risks ?? []), risk] };
}

// --- Gate predicates (support generic + live schema) ---
const briefField = (cycle, name) => cycle.brief?.[name];
const briefHasValue = (cycle, name) => hasText(briefField(cycle, name)?.value);

function hasBehaviorStatement(cycle) {
  return hasText(cycle.behaviorStatement) || hasText(cycle.behavior?.statement) || briefHasValue(cycle, "behavior_statement");
}

function hasQuantitativeSignal(cycle) {
  return hasText(cycle.quantitativeSignal) || hasText(cycle.quantSignal) || briefHasValue(cycle, "senal_cuantitativa");
}

function hasAtLeastTwoSources(cycle) {
  const generic = cycle.sources ?? cycle.evidence?.sources;
  if (Array.isArray(generic) && generic.filter(Boolean).length >= 2) return true;
  // Live schema: primary evidence + second source both present.
  const primary = briefHasValue(cycle, "evidencia_primaria");
  const second = briefHasValue(cycle, "segunda_fuente");
  return primary && second;
}

function hasBmapCause(cycle) {
  const generic = cycle.cause ?? cycle.diagnosis?.cause ?? cycle.bmapCause;
  if (["Motivation", "Ability", "Prompt"].includes(String(generic ?? ""))) return true;
  return ["M", "A", "P"].includes(String(cycle.causa ?? ""));
}

function hasIntervention(cycle) {
  return hasText(cycle.intervention) || briefHasValue(cycle, "intervencion");
}

function hasFalsifiableHypothesis(cycle) {
  return hasText(cycle.falsifiableHypothesis) || hasText(cycle.hypothesis?.falsifiable) || briefHasValue(cycle, "hipotesis");
}

function hasMetric(cycle) {
  return hasText(cycle.metric) || briefHasValue(cycle, "senal_cuantitativa") || hasText(cycle.experiment?.metrica_primaria?.value);
}

function hasSizeAndDuration(cycle) {
  if (hasText(cycle.sizeAndDuration) || (hasText(cycle.size) && hasText(cycle.duration))) return true;
  return hasText(cycle.experiment?.tamano_muestra?.value) && hasText(cycle.experiment?.duracion?.value);
}

function hasStopCriteria(cycle) {
  return hasText(cycle.stopCriteria) || hasText(cycle.experiment?.criterio_stop?.value);
}

function hasTrackingConfirmed(cycle) {
  if (cycle.trackingConfirmed === true) return true;
  const t = cycle.experiment?.tracking_eventos;
  return Array.isArray(t) ? t.length > 0 : hasText(t?.value);
}

function hasDecision(cycle) {
  return hasText(cycle.decision) || hasText(cycle.resultado_cierre) || hasText(cycle.cierre?.decision);
}

function hasNamedPattern(cycle) {
  return hasText(cycle.namedPattern) || hasText(cycle.patternName) || hasText(cycle.cierre?.pattern_id);
}

function hasText(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function isPhase(value) {
  return typeof value === "string" && PHASES.includes(value);
}

function assertPhase(value) {
  if (!isPhase(value)) throw new Error(`Unknown phase: ${String(value)}.`);
}

export { PHASES };
