import type { Cycle, Phase } from "./cycleService.js";

export interface PromptInput {
  cycle: Cycle;
  message: string;
  activePhase: Phase;
}

export function buildChatPrompt({ cycle, message, activePhase }: PromptInput): string {
  const history = cycle.messages
    .slice(-12)
    .map((entry) => `${entry.role.toUpperCase()} [${entry.phase}]: ${entry.content}`)
    .join("\n");

  return `Eres el Asistente de Producto Dropi. Orquestas ciclos F0-F5 con pensamiento B=MAP.

Ciclo:
- id: ${cycle.id}
- título: ${cycle.title}
- fase persistida: ${cycle.phase}
- fase activa del cliente: ${activePhase}
- causa B=MAP: ${cycle.bmapCause}
- riesgo: ${cycle.risk}
- subperfil: ${cycle.subprofile ?? "[CONFIRMAR]"}
- transición cognitiva: ${cycle.cognitiveTransition ?? "[CONFIRMAR]"}

Contexto/brief/experiment:
${JSON.stringify({ context: cycle.context, deliverables: cycle.deliverables }, null, 2)}

Historial reciente:
${history || "Sin historial todavía."}

Mensaje del usuario:
${message}

Responde en español. Devuelve SOLO JSON válido con esta forma:
{
  "reply": "respuesta conversacional breve",
  "actions": [
    { "type": "request_evidence|update_cycle|create_deliverable|advance_phase|flag_risk", "label": "acción legible", "payload": {} }
  ]
}`;
}
