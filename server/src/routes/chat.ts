import type { IncomingMessage, ServerResponse } from "node:http";
import { addMessage, getCycle, updateCycle, type Phase } from "../services/cycleService.js";
import { callLlm } from "../services/llmClient.js";
import { buildChatPrompt } from "../services/promptBuilder.js";

export async function handleChat(req: IncomingMessage, res: ServerResponse, body: unknown, pathParts: string[]): Promise<boolean> {
  if (req.method !== "POST" || pathParts.join("/") !== "api/chat") return false;
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const cycleId = input.cycleId;
  const message = input.message;
  const activePhase = input.activePhase;

  if (typeof cycleId !== "string" || typeof message !== "string" || !isPhase(activePhase)) {
    sendJson(res, 400, { error: "cycleId, message and activePhase are required" });
    return true;
  }

  const cycle = getCycle(cycleId);
  if (!cycle) {
    sendJson(res, 404, { error: "Cycle not found" });
    return true;
  }

  addMessage(cycle.id, { role: "user", content: message, phase: activePhase });
  const refreshedCycle = getCycle(cycle.id)!;
  const prompt = buildChatPrompt({ cycle: refreshedCycle, message, activePhase });
  const llmResult = await callLlm(prompt);
  const assistantMessage = addMessage(cycle.id, { role: "assistant", content: llmResult.reply, phase: activePhase, actions: llmResult.actions });
  const updatedCycle = updateCycle(cycle.id, { phase: activePhase });
  sendJson(res, 200, { reply: llmResult.reply, actions: llmResult.actions, message: assistantMessage, cycle: updatedCycle });
  return true;
}

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && ["F0", "F1", "F2", "F3", "F4", "F5"].includes(value);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}
