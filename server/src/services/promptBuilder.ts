import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as llmClient from './llmClient.ts';
import type { LlmClient, LlmMessage } from './llmClient.ts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PromptBuilderContext = {
  activeCycle: JsonValue;
  currentPhase: string;
  summarizedHistory?: JsonValue;
  currentBrief?: JsonValue;
  currentExperiment?: JsonValue;
  openRisks?: JsonValue;
  relevantPatterns?: JsonValue;
};

export type PromptBuilderInput = {
  userMessage: string;
  context: PromptBuilderContext;
};

const PROMPT_FILES = [
  '00_Orquestador.md',
  '01_Modulos_Fases.md',
  '02_Plantillas_Entregables.md',
] as const;

const REQUIRED_JSON_SHAPE = {
  assistantMessage: 'string',
  phase: 'F0 | F1 | F2 | F3 | F4 | F5',
  briefUpdates: 'object | null',
  experimentUpdates: 'object | null',
  riskUpdates: 'array | null',
  patternCandidate: 'object | null',
  nextQuestion: 'string | null',
};

function repositoryRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}

async function readPromptFile(fileName: (typeof PROMPT_FILES)[number]): Promise<string> {
  return readFile(resolve(repositoryRoot(), fileName), 'utf8');
}

function formatJson(value: JsonValue | undefined): string {
  return JSON.stringify(value ?? null, null, 2);
}

export async function buildSystemPrompt(context: PromptBuilderContext): Promise<string> {
  const [orchestrator, phaseModules, deliverableTemplates] = await Promise.all(
    PROMPT_FILES.map(readPromptFile),
  );

  return [
    '# System prompt completo · Asistente IA de Producto Dropi',
    'Combina las reglas base, módulos operativos, plantillas y contexto dinámico para guiar la conversación.',
    '',
    `## ${PROMPT_FILES[0]}`,
    orchestrator,
    '',
    `## ${PROMPT_FILES[1]}`,
    phaseModules,
    '',
    `## ${PROMPT_FILES[2]}`,
    deliverableTemplates,
    '',
    '## Contexto dinámico del ciclo',
    `### Ciclo activo\n${formatJson(context.activeCycle)}`,
    `### Fase actual\n${context.currentPhase}`,
    `### Historial resumido\n${formatJson(context.summarizedHistory)}`,
    `### Brief actual\n${formatJson(context.currentBrief)}`,
    `### Experimento actual\n${formatJson(context.currentExperiment)}`,
    `### Riesgos abiertos\n${formatJson(context.openRisks)}`,
    `### Patrones relevantes\n${formatJson(context.relevantPatterns)}`,
    '',
    '## Contrato de salida obligatorio',
    'Responde únicamente con JSON válido. No incluyas Markdown fuera del JSON.',
    'El objeto raíz debe respetar exactamente estas claves:',
    JSON.stringify(REQUIRED_JSON_SHAPE, null, 2),
    'Usa null cuando no haya cambios para una clave. No inventes datos: marca [DATO FALTANTE], [HIPÓTESIS] o [CONFIRMAR] dentro de los campos cuando corresponda.',
  ].join('\n');
}

export async function buildPromptMessages(input: PromptBuilderInput): Promise<LlmMessage[]> {
  return [
    { role: 'system', content: await buildSystemPrompt(input.context) },
    { role: 'user', content: input.userMessage },
  ];
}

export async function sendPromptToLlm(
  input: PromptBuilderInput,
  client: LlmClient = llmClient,
): Promise<unknown> {
  return client.complete({
    messages: await buildPromptMessages(input),
    responseFormat: { type: 'json_object' },
    temperature: 0.2,
  });
}
