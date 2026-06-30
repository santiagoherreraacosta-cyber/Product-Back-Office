export type Phase = "F0" | "F1" | "F2" | "F3" | "F4" | "F5";

export type Actor = {
  id?: string;
  name?: string;
};

export type AcceptedRisk = {
  id: string;
  phase: Phase;
  text: string;
  acceptedBy?: Actor;
  acceptedAt: string;
  resolvedBy?: Actor;
  resolvedAt?: string;
};

export type Cycle = Record<string, any> & {
  phase?: Phase;
  currentPhase?: Phase;
  risks?: AcceptedRisk[];
  phaseHistory?: Array<Record<string, any>>;
};

const PHASES: Phase[] = ["F0", "F1", "F2", "F3", "F4", "F5"];

const GATE_REQUIREMENTS: Record<Phase, Array<{ key: string; message: string; isMet: (cycle: Cycle) => boolean }>> = {
  F0: [
    { key: "behaviorStatement", message: "Falta behavior statement.", isMet: hasBehaviorStatement },
    { key: "quantitativeSignal", message: "Falta señal cuantitativa.", isMet: hasQuantitativeSignal },
  ],
  F1: [
    { key: "sources", message: "Faltan al menos 2 fuentes.", isMet: hasAtLeastTwoSources },
    { key: "bmapCause", message: "La causa debe ser B=MAP.", isMet: hasBmapCause },
  ],
  F2: [
    { key: "intervention", message: "Falta intervención.", isMet: hasIntervention },
    { key: "falsifiableHypothesis", message: "Falta hipótesis falsable.", isMet: hasFalsifiableHypothesis },
  ],
  F3: [
    { key: "metric", message: "Falta métrica.", isMet: hasMetric },
    { key: "sizeAndDuration", message: "Falta tamaño/duración.", isMet: hasSizeAndDuration },
    { key: "stopCriteria", message: "Falta stop criteria.", isMet: hasStopCriteria },
  ],
  F4: [{ key: "trackingConfirmed", message: "Falta tracking confirmado.", isMet: hasTrackingConfirmed }],
  F5: [
    { key: "decision", message: "Falta decisión.", isMet: hasDecision },
    { key: "namedPattern", message: "Falta patrón nombrado.", isMet: hasNamedPattern },
  ],
};

export function getCurrentPhase(cycle: Cycle): Phase {
  const phase = cycle.currentPhase ?? cycle.phase;
  return isPhase(phase) ? phase : "F0";
}

export function canClosePhase(cycle: Cycle, phase: Phase): boolean {
  return getMissingGateRequirements(cycle, phase).length === 0;
}

export function getMissingGateRequirements(cycle: Cycle, phase: Phase): string[] {
  assertPhase(phase);
  return GATE_REQUIREMENTS[phase].filter((requirement) => !requirement.isMet(cycle)).map((requirement) => requirement.key);
}

export function advancePhase(cycle: Cycle, requestedPhase: Phase, actor: Actor): Cycle {
  assertPhase(requestedPhase);
  const currentPhase = getCurrentPhase(cycle);
  const requestedIndex = PHASES.indexOf(requestedPhase);
  const currentIndex = PHASES.indexOf(currentPhase);

  if (requestedIndex <= currentIndex) {
    throw new Error(`Cannot advance from ${currentPhase} to ${requestedPhase}.`);
  }

  const blockingPhase = PHASES.slice(currentIndex, requestedIndex).find((phase) => !canClosePhase(cycle, phase));
  if (blockingPhase) {
    const missing = getMissingGateRequirements(cycle, blockingPhase).join(", ");
    throw new Error(`Cannot advance: ${blockingPhase} is missing ${missing}.`);
  }

  return {
    ...cycle,
    currentPhase: requestedPhase,
    phase: requestedPhase,
    phaseHistory: [
      ...(cycle.phaseHistory ?? []),
      { from: currentPhase, to: requestedPhase, actor, advancedAt: new Date().toISOString() },
    ],
  };
}

export function acceptRisk(cycle: Cycle, phase: Phase, riskText: string, actor: Actor): Cycle {
  assertPhase(phase);
  if (!riskText.trim()) throw new Error("Risk text is required.");

  const risk: AcceptedRisk = {
    id: createRiskId(cycle, phase),
    phase,
    text: riskText.trim(),
    acceptedBy: actor,
    acceptedAt: new Date().toISOString(),
  };

  return { ...cycle, risks: [...(cycle.risks ?? []), risk] };
}

export function resolveRisk(cycle: Cycle, riskId: string, actor: Actor): Cycle {
  let found = false;
  const risks = (cycle.risks ?? []).map((risk) => {
    if (risk.id !== riskId) return risk;
    found = true;
    return { ...risk, resolvedBy: actor, resolvedAt: new Date().toISOString() };
  });

  if (!found) throw new Error(`Risk ${riskId} was not found.`);
  return { ...cycle, risks };
}

function hasBehaviorStatement(cycle: Cycle): boolean {
  return hasText(cycle.behaviorStatement) || hasText(cycle.behavior?.statement) || hasText(cycle.f0?.behaviorStatement);
}

function hasQuantitativeSignal(cycle: Cycle): boolean {
  return hasText(cycle.quantitativeSignal) || hasText(cycle.quantSignal) || hasText(cycle.f0?.quantitativeSignal);
}

function hasAtLeastTwoSources(cycle: Cycle): boolean {
  const sources = cycle.sources ?? cycle.evidence?.sources ?? cycle.f1?.sources;
  return Array.isArray(sources) && sources.filter(Boolean).length >= 2;
}

function hasBmapCause(cycle: Cycle): boolean {
  const cause = cycle.cause ?? cycle.f1?.cause ?? cycle.diagnosis?.cause;
  return String(cause ?? "").toUpperCase() === "B=MAP";
}

function hasIntervention(cycle: Cycle): boolean {
  return hasText(cycle.intervention) || hasText(cycle.f2?.intervention);
}

function hasFalsifiableHypothesis(cycle: Cycle): boolean {
  return hasText(cycle.falsifiableHypothesis) || hasText(cycle.hypothesis?.falsifiable) || hasText(cycle.f2?.falsifiableHypothesis);
}

function hasMetric(cycle: Cycle): boolean {
  return hasText(cycle.metric) || hasText(cycle.f3?.metric) || hasText(cycle.experiment?.metric);
}

function hasSizeAndDuration(cycle: Cycle): boolean {
  return (hasText(cycle.size) && hasText(cycle.duration)) || hasText(cycle.sizeAndDuration) || hasText(cycle.f3?.sizeAndDuration);
}

function hasStopCriteria(cycle: Cycle): boolean {
  return hasText(cycle.stopCriteria) || hasText(cycle.f3?.stopCriteria) || hasText(cycle.experiment?.stopCriteria);
}

function hasTrackingConfirmed(cycle: Cycle): boolean {
  return cycle.trackingConfirmed === true || cycle.f4?.trackingConfirmed === true;
}

function hasDecision(cycle: Cycle): boolean {
  return hasText(cycle.decision) || hasText(cycle.f5?.decision);
}

function hasNamedPattern(cycle: Cycle): boolean {
  return hasText(cycle.namedPattern) || hasText(cycle.patternName) || hasText(cycle.f5?.namedPattern);
}

function hasText(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && PHASES.includes(value as Phase);
}

function assertPhase(value: unknown): asserts value is Phase {
  if (!isPhase(value)) throw new Error(`Unknown phase: ${String(value)}.`);
}

function createRiskId(cycle: Cycle, phase: Phase): string {
  return `${phase}-risk-${(cycle.risks ?? []).length + 1}`;
}
