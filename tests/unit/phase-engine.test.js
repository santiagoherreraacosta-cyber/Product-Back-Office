import { acceptRiskAndAdvance, clonePhases, closePhase, DEFAULT_PHASES, selectPhase, startNewCycle } from "../../src/phase-engine.js";

describe("phase engine", () => {
  it("selects one active phase", () => {
    const phases = selectPhase(clonePhases(DEFAULT_PHASES), "F2");
    expect(phases.find((phase) => phase.state === "active").key).toBe("F2");
  });

  it("starts a new cycle in F0", () => {
    const phases = startNewCycle(clonePhases(DEFAULT_PHASES));
    expect(phases.find((phase) => phase.state === "active").key).toBe("F0");
    expect(phases.find((phase) => phase.key === "F1").state).toBe("todo");
  });

  it("accepts F1 risk and advances to F2", () => {
    const phases = acceptRiskAndAdvance(clonePhases(DEFAULT_PHASES));
    expect(phases.find((phase) => phase.key === "F1")).toMatchObject({ state: "done", note: "riesgo aceptado" });
    expect(phases.find((phase) => phase.key === "F2")).toMatchObject({ state: "active" });
  });

  it("closes a phase and activates the next one", () => {
    const phases = closePhase(startNewCycle(clonePhases(DEFAULT_PHASES)), "F0");
    expect(phases.find((phase) => phase.key === "F0").state).toBe("done");
    expect(phases.find((phase) => phase.key === "F1").state).toBe("active");
  });
});
