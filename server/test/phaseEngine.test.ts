import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptRisk,
  advancePhase,
  canClosePhase,
  getCurrentPhase,
  getMissingGateRequirements,
  resolveRisk,
} from "../src/domain/phaseEngine.ts";

const actor = { id: "u1", name: "PM" };

const completeCycle = {
  currentPhase: "F0",
  behaviorStatement: "Sellers do not configure the second shipment.",
  quantitativeSignal: "Only 31% configure it within 7 days.",
  sources: ["analytics", "interviews"],
  // BUG-4 FIX: cause must be "Motivation", "Ability" or "Prompt" — not the literal "B=MAP"
  cause: "Ability",
  intervention: "Add guided setup prompt.",
  falsifiableHypothesis: "If guided setup works, second shipment configuration rises by 10pp.",
  metric: "second shipment configuration rate",
  sizeAndDuration: "500 sellers for 14 days",
  stopCriteria: "Stop if support tickets increase by 5%.",
  trackingConfirmed: true,
  decision: "ship",
  namedPattern: "Guided Activation",
} as const;

test("getCurrentPhase defaults to F0 and reads cycle phase", () => {
  assert.equal(getCurrentPhase({}), "F0");
  assert.equal(getCurrentPhase({ currentPhase: "F3" }), "F3");
});

test("F0 closes with behavior statement and quantitative signal", () => {
  assert.deepEqual(getMissingGateRequirements({}, "F0"), ["behaviorStatement", "quantitativeSignal"]);
  assert.equal(canClosePhase({ behaviorStatement: "behavior", quantitativeSignal: "42%" }, "F0"), true);
  assert.equal(advancePhase({ ...completeCycle, currentPhase: "F0" }, "F1", actor).currentPhase, "F1");
});

test("F1 closes with at least two sources and a concrete B=MAP cause (Motivation, Ability or Prompt)", () => {
  // One source + unknown cause → both gates missing
  const cycle = { ...completeCycle, currentPhase: "F1", sources: ["analytics"], cause: "Unknown" };
  assert.deepEqual(getMissingGateRequirements(cycle, "F1"), ["sources", "bmapCause"]);

  // Two sources + valid B=MAP cause → gate passes
  assert.equal(advancePhase({ ...completeCycle, currentPhase: "F1" }, "F2", actor).currentPhase, "F2");
});

test("F1 accepts Motivation, Ability and Prompt as valid B=MAP causes", () => {
  const base = { sources: ["analytics", "interviews"] };
  assert.equal(canClosePhase({ ...base, cause: "Motivation" }, "F1"), true);
  assert.equal(canClosePhase({ ...base, cause: "Ability" }, "F1"), true);
  assert.equal(canClosePhase({ ...base, cause: "Prompt" }, "F1"), true);
  assert.equal(canClosePhase({ ...base, cause: "Unknown" }, "F1"), false);
});

test("F2 closes with intervention and falsifiable hypothesis", () => {
  assert.deepEqual(getMissingGateRequirements({ intervention: "nudge" }, "F2"), ["falsifiableHypothesis"]);
  assert.equal(advancePhase({ ...completeCycle, currentPhase: "F2" }, "F3", actor).currentPhase, "F3");
});

test("F3 closes with metric, size/duration and stop criteria", () => {
  assert.deepEqual(getMissingGateRequirements({ metric: "activation", sizeAndDuration: "2 weeks" }, "F3"), ["stopCriteria"]);
  assert.equal(advancePhase({ ...completeCycle, currentPhase: "F3" }, "F4", actor).currentPhase, "F4");
});

test("F4 closes with confirmed tracking", () => {
  assert.deepEqual(getMissingGateRequirements({ trackingConfirmed: false }, "F4"), ["trackingConfirmed"]);
  assert.equal(advancePhase({ ...completeCycle, currentPhase: "F4" }, "F5", actor).currentPhase, "F5");
});

test("F5 closes with decision and named pattern", () => {
  assert.deepEqual(getMissingGateRequirements({ decision: "iterate" }, "F5"), ["namedPattern"]);
  assert.equal(canClosePhase(completeCycle, "F5"), true);
});

test("advancePhase blocks when an intermediate gate is incomplete", () => {
  assert.throws(
    () => advancePhase({ currentPhase: "F0", behaviorStatement: "behavior" }, "F2", actor),
    /F0 is missing quantitativeSignal/,
  );
});

test("acceptRisk records a phase risk and resolveRisk resolves it", () => {
  const withRisk = acceptRisk({}, "F1", "Proceeding with one qualitative source.", actor);
  assert.equal(withRisk.risks?.[0]?.phase, "F1");
  assert.equal(withRisk.risks?.[0]?.id, "F1-risk-1");

  const resolved = resolveRisk(withRisk, "F1-risk-1", actor);
  assert.equal(Boolean(resolved.risks?.[0]?.resolvedAt), true);
  assert.deepEqual(resolved.risks?.[0]?.resolvedBy, actor);
});
