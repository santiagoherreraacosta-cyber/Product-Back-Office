// Unit tests for phase gate logic (JS-only subset — full TS tests in server/test/)
import assert from "node:assert/strict";
import { test } from "node:test";

// Minimal phase gate reimplementation for JS-only testing
const BMAP_CAUSES = ["Motivation", "Ability", "Prompt"];

function canCloseF0(cycle) {
  return Boolean(cycle.behaviorStatement?.trim()) && Boolean(cycle.quantitativeSignal?.trim());
}

function canCloseF1(cycle) {
  const sources = cycle.sources ?? [];
  const hasTwoSources = Array.isArray(sources) && sources.filter(Boolean).length >= 2;
  const cause = cycle.cause ?? cycle.bmapCause;
  const hasValidCause = BMAP_CAUSES.includes(String(cause ?? ""));
  return hasTwoSources && hasValidCause;
}

function canCloseF2(cycle) {
  return Boolean(cycle.intervention?.trim()) && Boolean(cycle.falsifiableHypothesis?.trim());
}

test("F0 requires behaviorStatement and quantitativeSignal", () => {
  assert.equal(canCloseF0({}), false);
  assert.equal(canCloseF0({ behaviorStatement: "test" }), false);
  assert.equal(canCloseF0({ behaviorStatement: "test", quantitativeSignal: "42%" }), true);
});

test("F1 requires two sources and valid B=MAP cause", () => {
  assert.equal(canCloseF1({ sources: ["analytics"], cause: "Ability" }), false);
  assert.equal(canCloseF1({ sources: ["analytics", "interviews"], cause: "Unknown" }), false);
  assert.equal(canCloseF1({ sources: ["analytics", "interviews"], cause: "Ability" }), true);
  assert.equal(canCloseF1({ sources: ["analytics", "interviews"], cause: "Motivation" }), true);
  assert.equal(canCloseF1({ sources: ["analytics", "interviews"], cause: "Prompt" }), true);
  // BUG-4: "B=MAP" literal should NOT be accepted
  assert.equal(canCloseF1({ sources: ["analytics", "interviews"], cause: "B=MAP" }), false);
});

test("F2 requires intervention and falsifiable hypothesis", () => {
  assert.equal(canCloseF2({}), false);
  assert.equal(canCloseF2({ intervention: "nudge" }), false);
  assert.equal(canCloseF2({ intervention: "nudge", falsifiableHypothesis: "If X then Y" }), true);
});
