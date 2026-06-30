import { createTestApi } from "../../src/api.js";

describe("API integration", () => {
  it("creates cycle, sends message, updates brief, accepts risk, closes phase and creates pattern", () => {
    const api = createTestApi();
    const cycle = api.createCycle({ name: "Activación" });
    expect(cycle).toMatchObject({ id: "cycle-1", activePhase: "F0" });

    const messageResult = api.sendMessage(cycle.id, "segunda fuente desde entrevista");
    expect(messageResult.intent.type).toBe("second_source");
    expect(messageResult.cycle.brief.secondSource).toContain("Entrevistas rápidas");

    expect(api.updateBrief(cycle.id, { metric: "2º envío en 72h" })).toMatchObject({ metric: "2º envío en 72h" });
    expect(api.acceptRisk(cycle.id)).toMatchObject({ riskAccepted: true, activePhase: "F2" });
    expect(api.closePhase(cycle.id, "F2").activePhase).toBe("F3");
    expect(api.createPattern({ title: "Reducir pasos", type: "pattern" })).toMatchObject({ id: "pattern-1", title: "Reducir pasos" });
  });
});
