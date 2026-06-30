import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildChatPrompt } from "../src/services/promptBuilder.ts";

// BUG-12 FIX: Use absolute paths from the repo root, not CWD-relative paths.
// The original test used readFile(fileName) which fails when CWD != repo root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const fakeCycle = {
  id: "cycle-123",
  teamId: "team-1",
  userId: "user-1",
  title: "Activación sellers Q3",
  phase: "F1" as const,
  status: "active" as const,
  risk: "low" as const,
  bmapCause: "Ability" as const,
  subprofile: "Rebuscador Digital",
  cognitiveTransition: "Setup → Aha",
  context: { segment: "sellers nuevos" },
  deliverables: { brief: { title: "Reducir fricción de conexión" } },
  messages: [
    { id: "m1", role: "user" as const, content: "Queremos aumentar activación.", phase: "F0" as const, createdAt: new Date().toISOString() },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("buildChatPrompt incluye datos del ciclo y mensaje del usuario", () => {
  const prompt = buildChatPrompt({ cycle: fakeCycle, message: "Ayúdame a diagnosticar", activePhase: "F1" });

  assert.match(prompt, /cycle-123/);
  assert.match(prompt, /Activación sellers Q3/);
  assert.match(prompt, /F1/);
  assert.match(prompt, /Ability/);
  assert.match(prompt, /Ayúdame a diagnosticar/);
  assert.match(prompt, /Rebuscador Digital/);
});

test("buildChatPrompt incluye historial reciente de mensajes", () => {
  const prompt = buildChatPrompt({ cycle: fakeCycle, message: "Segunda pregunta", activePhase: "F1" });
  assert.match(prompt, /Queremos aumentar activación/);
});

test("buildChatPrompt solicita respuesta JSON estructurada", () => {
  const prompt = buildChatPrompt({ cycle: fakeCycle, message: "test", activePhase: "F0" });
  assert.match(prompt, /JSON válido/);
  assert.match(prompt, /"reply"/);
  assert.match(prompt, /"actions"/);
});

test("archivos Markdown de contexto existen en el repo", async () => {
  // BUG-12 FIX: Verify the prompt context files are accessible via absolute path.
  for (const file of ["00_Orquestador.md", "01_Modulos_Fases.md", "02_Plantillas_Entregables.md"]) {
    const content = await readFile(resolve(REPO_ROOT, file), "utf8");
    assert.ok(content.length > 0, `${file} should not be empty`);
  }
});
