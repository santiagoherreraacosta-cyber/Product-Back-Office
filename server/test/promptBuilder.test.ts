import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildPromptMessages, buildSystemPrompt, sendPromptToLlm } from '../src/services/promptBuilder.ts';

const context = {
  activeCycle: { id: 'cycle-123', name: 'Activación sellers Q3', owner: 'Producto' },
  currentPhase: 'F1',
  summarizedHistory: ['Se definió el comportamiento de conectar tienda'],
  currentBrief: { title: 'Reducir fricción de conexión', segment: 'sellers nuevos' },
  currentExperiment: { title: 'Checklist guiado' },
  openRisks: [{ id: 'risk-1', description: 'Baseline de activación sin confirmar' }],
  relevantPatterns: [{ name: 'Próximo paso explícito', cause: 'Claridad' }],
};

test('buildSystemPrompt incluye los tres archivos Markdown', async () => {
  const prompt = await buildSystemPrompt(context);

  for (const fileName of ['00_Orquestador.md', '01_Modulos_Fases.md', '02_Plantillas_Entregables.md']) {
    const content = await readFile(fileName, 'utf8');
    assert.match(prompt, new RegExp(`## ${fileName}`));
    assert.ok(prompt.includes(content));
  }
});

test('buildSystemPrompt incluye los datos dinámicos del ciclo', async () => {
  const prompt = await buildSystemPrompt(context);

  assert.match(prompt, /Contexto dinámico del ciclo/);
  assert.match(prompt, /cycle-123/);
  assert.match(prompt, /Activación sellers Q3/);
  assert.match(prompt, /F1/);
  assert.match(prompt, /Baseline de activación sin confirmar/);
  assert.match(prompt, /Próximo paso explícito/);
});

test('sendPromptToLlm envía mensajes al llmClient con respuesta JSON obligatoria', async () => {
  let request;
  const fakeClient = {
    async complete(receivedRequest) {
      request = receivedRequest;
      return { ok: true };
    },
  };

  const response = await sendPromptToLlm({ userMessage: 'Ayúdame a diagnosticar', context }, fakeClient);

  assert.deepEqual(response, { ok: true });
  assert.equal(request.responseFormat.type, 'json_object');
  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages[1].role, 'user');
  assert.match(request.messages[0].content, /assistantMessage/);
  assert.match(request.messages[0].content, /briefUpdates/);
  assert.match(request.messages[0].content, /experimentUpdates/);
  assert.match(request.messages[0].content, /riskUpdates/);
  assert.match(request.messages[0].content, /patternCandidate/);
  assert.match(request.messages[0].content, /nextQuestion/);
});

test('buildPromptMessages conserva el mensaje del usuario', async () => {
  const messages = await buildPromptMessages({ userMessage: 'Necesitamos mejorar onboarding', context });

  assert.equal(messages.at(-1)?.content, 'Necesitamos mejorar onboarding');
});
