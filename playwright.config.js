// BUG-10 FIX: webServer command is "node server.js", not "npm run start -- --directory ."
// The original had an invalid flag that caused the web server to fail to start.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:8000",
    headless: true,
  },
  webServer: {
    command: "node server.js",
    url: "http://localhost:8000",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
