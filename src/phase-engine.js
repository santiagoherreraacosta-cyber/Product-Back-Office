export const DEFAULT_PHASES = [
  { key: "F0", label: "Sense", state: "done" },
  { key: "F1", label: "Diagnose", state: "active", note: "falta 2ª fuente" },
  { key: "F2", label: "Design", state: "todo" },
  { key: "F3", label: "Decide", state: "todo", skipped: true, note: "gate saltado" },
  { key: "F4", label: "Deploy", state: "todo" },
  { key: "F5", label: "Distill", state: "todo" },
];

export function clonePhases(phases = DEFAULT_PHASES) {
  return phases.map((phase) => ({ ...phase }));
}

export function selectPhase(phases, phaseKey) {
  return phases.map((phase) => ({
    ...phase,
    state: phase.key === phaseKey ? "active" : phase.state === "active" ? "todo" : phase.state,
  }));
}

export function startNewCycle(phases = DEFAULT_PHASES) {
  return phases.map((phase) => ({
    ...phase,
    state: phase.key === "F0" ? "active" : phase.state === "done" || phase.key === "F1" ? "todo" : phase.state,
  }));
}

export function acceptRiskAndAdvance(phases, from = "F1", to = "F2") {
  return phases.map((phase) => {
    if (phase.key === from) return { ...phase, state: "done", note: "riesgo aceptado" };
    if (phase.key === to) return { ...phase, state: "active", note: "diseñar intervención" };
    return { ...phase, state: phase.state === "active" ? "todo" : phase.state };
  });
}

export function closePhase(phases, phaseKey) {
  const index = phases.findIndex((phase) => phase.key === phaseKey);
  return phases.map((phase, phaseIndex) => {
    if (phase.key === phaseKey) return { ...phase, state: "done", note: "gate cerrado" };
    if (phaseIndex === index + 1) return { ...phase, state: "active" };
    return { ...phase, state: phase.state === "active" ? "todo" : phase.state };
  });
}
