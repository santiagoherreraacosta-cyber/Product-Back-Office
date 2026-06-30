// BUG-6 FIX: Import extractionService.js directly instead of copying .ts to .mjs.
// The original test used copyFile + dynamic import to work around the .ts extension,
// which breaks as soon as any real TypeScript syntax is added.
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractValidatedPatches, validateModelResponse } from "../src/services/extractionService.js";

const conversation = [
  { role: "user", content: "Sellers no configuran el segundo envío." },
  { role: "assistant", content: "Identificamos un patrón de Ability: flujo de 7 pasos bloquea configuración." },
];

test("extractValidatedPatches retorna patches con campos válidos", () => {
  const response = {
    type: "brief",
    updates: [
      {
        phase: "F1",
        behavior: "Sellers no configuran el segundo envío.",
        cause: "Ability — flujo de envío bloqueado",
        source: "Sellers",
      },
    ],
  };
  const patches = extractValidatedPatches(response, conversation);
  assert.ok(Array.isArray(patches));
  assert.ok(patches.length > 0);
  const phasePatch = patches.find((p) => p.field === "phase");
  assert.ok(phasePatch, "Should have phase patch");
  assert.equal(phasePatch.animation, "fillpop");
});

test("extractValidatedPatches asigna confidence según status", () => {
  const response = {
    type: "brief",
    updates: [{ phase: "F1", behavior: "Sellers no configuran el segundo envío.", source: "Sellers" }],
  };
  const patches = extractValidatedPatches(response, conversation);
  for (const patch of patches) {
    assert.ok(typeof patch.confidence === "number");
    assert.ok(patch.confidence >= 0 && patch.confidence <= 1);
  }
});

test("extractValidatedPatches acepta tipo experiment", () => {
  const response = {
    type: "experiment",
    updates: [
      {
        phase: "F3",
        hypothesis: "Si reducimos pasos de configuración, aumentará el 2º envío.",
        intervention: "Guía asistida paso a paso",
      },
    ],
  };
  const patches = extractValidatedPatches(response, []);
  assert.ok(patches.length > 0);
  const hyp = patches.find((p) => p.field === "hypothesis");
  assert.ok(hyp, "Should have hypothesis patch");
});

test("extractValidatedPatches acepta tipo risk", () => {
  const response = {
    type: "risk",
    updates: [{ phase: "F1", risk: "Una sola fuente cuantitativa", reason: "No hay entrevistas todavía" }],
  };
  const patches = extractValidatedPatches(response, []);
  assert.ok(patches.length > 0);
});

test("extractValidatedPatches acepta tipo pattern", () => {
  const response = {
    type: "pattern",
    updates: [
      {
        name: "Guided Activation",
        trigger: "Setup → Aha bloqueado",
        evidence: ["cohorte 30d", "entrevistas"],
      },
    ],
  };
  const patches = extractValidatedPatches(response, []);
  assert.ok(patches.length > 0);
});

test("validateModelResponse es alias de extractValidatedPatches", () => {
  const response = {
    type: "brief",
    updates: [{ phase: "F0", behavior: "Test behavior" }],
  };
  const a = validateModelResponse(response, []);
  const b = extractValidatedPatches(response, []);
  assert.deepEqual(a, b);
});

test("extractValidatedPatches lanza error para tipo desconocido", () => {
  assert.throws(
    () => extractValidatedPatches({ type: "unknown" }, []),
    /Unsupported extraction type/,
  );
});

test("extractValidatedPatches acepta respuesta como string JSON", () => {
  const json = JSON.stringify({ type: "brief", updates: [{ phase: "F1", behavior: "Test" }] });
  const patches = extractValidatedPatches(json, []);
  assert.ok(Array.isArray(patches));
});
