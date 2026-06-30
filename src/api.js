import { acceptRiskAndAdvance, closePhase, clonePhases, DEFAULT_PHASES, startNewCycle } from "./phase-engine.js";
import { extractBriefPatch, extractMessageIntent } from "./extraction-service.js";

export function createTestApi() {
  const state = { cycles: [], patterns: [] };
  return {
    createCycle(input = {}) {
      const cycle = { id: `cycle-${state.cycles.length + 1}`, name: input.name ?? "Nuevo ciclo", activePhase: "F0", phases: startNewCycle(clonePhases(DEFAULT_PHASES)), brief: {}, messages: [] };
      state.cycles.push(cycle);
      return cycle;
    },
    sendMessage(cycleId, text) {
      const cycle = findCycle(state, cycleId);
      const intent = extractMessageIntent(text);
      cycle.messages.push({ role: "user", text, intent: intent.type });
      Object.assign(cycle.brief, extractBriefPatch(text));
      return { intent, cycle };
    },
    updateBrief(cycleId, patch) {
      const cycle = findCycle(state, cycleId);
      cycle.brief = { ...cycle.brief, ...patch };
      return cycle.brief;
    },
    acceptRisk(cycleId) {
      const cycle = findCycle(state, cycleId);
      cycle.riskAccepted = true;
      cycle.activePhase = "F2";
      cycle.phases = acceptRiskAndAdvance(cycle.phases);
      return cycle;
    },
    closePhase(cycleId, phaseKey) {
      const cycle = findCycle(state, cycleId);
      cycle.phases = closePhase(cycle.phases, phaseKey);
      cycle.activePhase = cycle.phases.find((phase) => phase.state === "active")?.key ?? phaseKey;
      return cycle;
    },
    createPattern(input) {
      const pattern = { id: `pattern-${state.patterns.length + 1}`, ...input };
      state.patterns.push(pattern);
      return pattern;
    },
  };
}

function findCycle(state, cycleId) {
  const cycle = state.cycles.find(({ id }) => id === cycleId);
  if (!cycle) throw new Error(`Cycle not found: ${cycleId}`);
  return cycle;
}
