import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  generateExperimentCardMarkdown,
  generateInterventionBriefMarkdown,
} from "../server/src/services/exportService.js";

test("Intervention Brief Markdown matches snapshot", () => {
  const snapshot = readFileSync(new URL("./snapshots/intervention-brief.md", import.meta.url), "utf8");
  assert.equal(generateInterventionBriefMarkdown(), snapshot);
});

test("Experiment Card Markdown matches snapshot", () => {
  const snapshot = readFileSync(new URL("./snapshots/experiment-card.md", import.meta.url), "utf8");
  assert.equal(generateExperimentCardMarkdown(), snapshot);
});
