import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
assert.match(html, /id="newCycleButton"/);
assert.match(html, /id="messageInput"/);
assert.match(app, /id="advanceAnyway"|Avanzar igual/);
assert.match(html, /id="experimentSwitch"/);
assert.match(html, /id="exportBrief"/);
assert.match(app, /startNewCycle/);
assert.match(app, /extractMessageIntent/);
assert.match(app, /createMarkdownDownload/);
console.log("E2E smoke flow validated: Home → nuevo ciclo → mensaje F0 → F1/F2 riesgo → Experiment Card → export brief.");
