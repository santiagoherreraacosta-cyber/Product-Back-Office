import { buildPhasePrompt, nextPrompt } from "../../src/prompt-builder.js";

describe("prompt builder", () => {
  it("includes phase and missing fields", () => expect(buildPhasePrompt({ phaseKey: "F1", label: "Diagnose", missing: ["2ª fuente"] })).toContain("Falta confirmar: 2ª fuente"));
  it("rotates prompts", () => expect(nextPrompt(3, ["a", "b", "c", "d"])).toEqual({ index: 0, text: "a" }));
});
