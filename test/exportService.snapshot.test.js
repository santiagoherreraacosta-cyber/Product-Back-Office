import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDefaultExportState,
  generateInterventionBriefMarkdown,
  generateExperimentCardMarkdown,
  generateExecutiveSummaryMarkdown,
  generateFullCycleMarkdown,
  markdownToPdfHtml,
} from "../src/exportService.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

test("createDefaultExportState retorna estado completo", () => {
  const state = createDefaultExportState();
  assert.ok(state.cycle);
  assert.ok(state.behavior);
  assert.ok(Array.isArray(state.evidence));
  assert.ok(state.experiment);
  assert.ok(Array.isArray(state.conversation));
  assert.ok(state.risks.assumed);
  assert.ok(state.risks.resolved);
});

test("createDefaultExportState aplica overrides", () => {
  const state = createDefaultExportState({ cycle: "Test Cycle" });
  assert.equal(state.cycle, "Test Cycle");
});

test("generateInterventionBriefMarkdown coincide con snapshot", async () => {
  const snapshot = await readFile(resolve(ROOT, "snapshots/intervention-brief.md"), "utf8");
  const generated = generateInterventionBriefMarkdown();
  assert.equal(generated.trim(), snapshot.trim());
});

test("generateExperimentCardMarkdown coincide con snapshot", async () => {
  const snapshot = await readFile(resolve(ROOT, "snapshots/experiment-card.md"), "utf8");
  const generated = generateExperimentCardMarkdown();
  assert.equal(generated.trim(), snapshot.trim());
});

test("generateExecutiveSummaryMarkdown incluye decisión y riesgos", () => {
  const md = generateExecutiveSummaryMarkdown();
  assert.match(md, /Resumen ejecutivo/);
  assert.match(md, /Decisión/);
  assert.match(md, /Riesgos/);
});

test("generateFullCycleMarkdown incluye secciones de conversación y evidencia", () => {
  const md = generateFullCycleMarkdown();
  assert.match(md, /Ciclo completo/);
  assert.match(md, /Conversación/);
  assert.match(md, /Evidencia/);
  assert.match(md, /Intervention Brief/);
  assert.match(md, /Experiment Card/);
});

test("markdownToPdfHtml escapa HTML correctamente", () => {
  const html = markdownToPdfHtml("# Test <script>alert(1)</script> & more", "Test");
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("markdownToPdfHtml incluye window.print()", () => {
  const html = markdownToPdfHtml("# Test");
  assert.match(html, /window\.print/);
});
