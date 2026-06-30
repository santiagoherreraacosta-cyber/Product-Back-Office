import { extractBriefPatch, extractMessageIntent } from "../../src/extraction-service.js";

describe("extraction service", () => {
  it("detects brief export commands", () => expect(extractMessageIntent("/brief")).toEqual({ type: "export_brief" }));
  it("detects second source evidence", () => expect(extractMessageIntent("Agregué segunda fuente").type).toBe("second_source"));
  it("builds a brief patch from experiment intent", () => expect(extractBriefPatch("/experimento")).toMatchObject({ progress: 8, hypothesis: expect.stringContaining("guía asistida") }));
});
