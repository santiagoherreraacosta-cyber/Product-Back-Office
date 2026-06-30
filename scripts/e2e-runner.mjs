#!/usr/bin/env node
// BUG-10 FIX: E2E runner uses Playwright with correct server startup.
// playwright.config.js uses "node server.js" as webServer command.
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  "npx",
  ["playwright", "test", "--config", "playwright.config.js"],
  { cwd: ROOT, stdio: "inherit", env: { ...process.env, CI: process.env.CI || "true" } },
);

process.exit(result.status || 0);
