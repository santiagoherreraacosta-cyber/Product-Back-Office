import type { StructuredAction } from "./cycleService.js";

export interface LlmResult {
  reply: string;
  actions: StructuredAction[];
}

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function callLlm(prompt: string): Promise<LlmResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      reply: "Necesito una segunda fuente o evidencia concreta antes de avanzar. ¿Qué dato confirma el comportamiento observado?",
      actions: [{ type: "request_evidence", label: "Solicitar segunda fuente", payload: { reason: "OPENAI_API_KEY no configurada; respuesta simulada" } }],
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as Partial<LlmResult>;
  return { reply: parsed.reply ?? "No pude generar una respuesta.", actions: parsed.actions ?? [] };
}
