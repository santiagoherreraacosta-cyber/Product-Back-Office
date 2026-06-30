import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = await mkdtemp(join(tmpdir(), "extraction-service-"));
const tempModule = join(tempDir, "extractionService.mjs");
await copyFile(new URL("../src/services/extractionService.ts", import.meta.url), tempModule);
const { extractValidatedPatches } = await import(tempModule);

test("F0: returns confirmed brief patches when conversation supports behavior, segment and metric", () => {
  const conversation = "F0: comportamiento: configurar segundo envío. Segmento: Rebuscador Digital. Métrica: dentro de 72h.";
  const patches = extractValidatedPatches({ type: "brief", phase: "F0", behavior: "configurar segundo envío", segment: "Rebuscador Digital", metric: "dentro de 72h" }, conversation);
  assert.equal(patches.length, 4);
  assert.ok(patches.every((patch) => patch.animation === "fillpop"));
  assert.equal(patches.find((patch) => patch.field === "behavior").status, "confirmed");
});

test("F1: downgrades invented confirmed cause to needs_confirmation without conversation evidence", () => {
  const conversation = "F1: solo sabemos que abandonan configuración de envío; falta segunda fuente.";
  const patches = extractValidatedPatches({ type: "brief", phase: "F1", cause: "precio de suscripción alto", fieldStatuses: { cause: "confirmed" } }, conversation);
  const cause = patches.find((patch) => patch.field === "cause");
  assert.equal(cause.status, "needs_confirmation");
  assert.equal(cause.source, "needs_confirmation");
});

test("F2: keeps intervention as hypothesis when model marks it as proposed change", () => {
  const conversation = "F2: propuesta: mostrar checklist de envío. Cambio esperado: reducir abandono.";
  const patches = extractValidatedPatches({ type: "brief", phase: "F2", intervention: "mostrar checklist de envío", expectedChange: "reducir abandono", status: "hypothesis" }, conversation);
  assert.equal(patches.find((patch) => patch.field === "intervention").status, "hypothesis");
  assert.equal(patches.find((patch) => patch.field === "expectedChange").confidence, 0.55);
});

test("F3: validates experiment card and marks unsupported sample as needs_confirmation", () => {
  const conversation = "F3: hipótesis: el checklist aumenta configuración. Criterio de éxito: +10% en 14 días.";
  const patches = extractValidatedPatches({ type: "experiment", phase: "F3", hypothesis: "el checklist aumenta configuración", successCriteria: "+10% en 14 días", sample: "1000 sellers enterprise", fieldStatuses: { sample: "confirmed" } }, conversation);
  assert.equal(patches.find((patch) => patch.field === "hypothesis").status, "confirmed");
  assert.equal(patches.find((patch) => patch.field === "sample").status, "needs_confirmation");
});

test("rejects unknown fields before persistence", () => {
  assert.throws(() => extractValidatedPatches({ type: "brief", phase: "F0", magicField: "invented" }, "F0"), /Unknown field/);
});
