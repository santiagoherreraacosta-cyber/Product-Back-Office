import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultExportState, generateInterventionBriefMarkdown, generateExperimentCardMarkdown, markdownToPdfHtml } from "../../src/exportService.js";

test("createDefaultExportState returns complete state", () => {
  const state = createDefaultExportState();
  assert.ok(state.cycle);
  assert.ok(state.behavior);
  assert.ok(state.executiveSummary);
  assert.ok(Array.isArray(state.evidence));
  assert.ok(state.experiment);
});

test("createDefaultExportState applies overrides", () => {
  const state = createDefaultExportState({ cycle: "Custom Cycle", metric: "custom metric" });
  assert.equal(state.cycle, "Custom Cycle");
  assert.equal(state.metric, "custom metric");
  assert.ok(state.behavior);
});

test("generateInterventionBriefMarkdown contains key sections", () => {
  const md = generateInterventionBriefMarkdown();
  assert.match(md, /# Intervention Brief/);
  assert.match(md, /## Causa B=MAP/);
  assert.match(md, /## Evidencia/);
  assert.match(md, /## Hipótesis/);
  assert.match(md, /## Métrica/);
});

test("generateExperimentCardMarkdown contains experiment fields", () => {
  const md = generateExperimentCardMarkdown();
  assert.match(md, /# Experiment Card/);
  assert.match(md, /## Hipótesis/);
  assert.match(md, /## Duración/);
  assert.match(md, /## Tracking/);
});

test("markdownToPdfHtml escapes HTML entities", () => {
  const html = markdownToPdfHtml('<script>alert("xss")</script>');
  // The user-provided content should be escaped; the template's own <script> is fine
  assert.ok(html.includes("&lt;script&gt;alert"), "user script tag should be escaped");
  assert.ok(!html.includes('<script>alert'), "raw user script tag must not appear");
});

test("markdownToPdfHtml includes print trigger", () => {
  const html = markdownToPdfHtml("test");
  assert.match(html, /window\.print/);
  assert.match(html, /<!doctype html>/i);
});
