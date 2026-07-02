import assert from "node:assert/strict";
import { test } from "node:test";
import { extractValidatedPatches, validateModelResponse } from "../../src/extraction.js";

const conversation = "Sellers no configuran el segundo envío. Identificamos Ability como causa.";

test("extractValidatedPatches returns patches array", () => {
  const patches = extractValidatedPatches(
    { type: "brief", updates: [{ phase: "F1", behavior: "Sellers no configuran el segundo envío." }] },
    conversation,
  );
  assert.ok(Array.isArray(patches));
  assert.ok(patches.length > 0);
  assert.ok(patches.every((p) => p.field && p.animation === "fillpop"));
});

test("patches include confidence between 0 and 1", () => {
  const patches = extractValidatedPatches(
    { type: "brief", updates: [{ phase: "F0", behavior: "Test behavior" }] },
    conversation,
  );
  for (const p of patches) {
    assert.ok(typeof p.confidence === "number");
    assert.ok(p.confidence >= 0 && p.confidence <= 1);
  }
});

test("validateModelResponse is alias of extractValidatedPatches", () => {
  const input = { type: "brief", updates: [{ phase: "F1", behavior: "test" }] };
  assert.deepEqual(
    extractValidatedPatches(input, conversation),
    validateModelResponse(input, conversation),
  );
});

test("throws for unknown type", () => {
  assert.throws(() => extractValidatedPatches({ type: "bogus" }, []), /Unsupported extraction type/);
});
