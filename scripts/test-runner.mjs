#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync("node", args, { cwd: ROOT, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`✗ ${label} failed (exit ${result.status})`);
    process.exit(result.status || 1);
  }
  console.log(`✓ ${label} passed`);
}

// Syntax checks
run("syntax: server.js", ["--check", "server.js"]);
run("syntax: app.js", ["--check", "app.js"]);

// Snapshot tests (pure JS)
run("snapshot: exportService", ["--test", "test/exportService.snapshot.test.js"]);

// Unit tests (pure JS)
run("unit: phase-engine", ["--test", "tests/unit/phase-engine.test.js"]);
run("unit: export-service", ["--test", "tests/unit/export-service.test.js"]);
run("unit: extraction-service", ["--test", "tests/unit/extraction-service.test.js"]);

// Integration tests
run("integration: api", ["--test", "tests/integration/api.test.js"]);

// Harvested domain modules (src/): syntax + unit
run("syntax: src/phaseEngine", ["--check", "src/phaseEngine.js"]);
run("syntax: src/extraction", ["--check", "src/extraction.js"]);
run("syntax: src/exportService", ["--check", "src/exportService.js"]);

console.log("\n✅ All tests passed");
