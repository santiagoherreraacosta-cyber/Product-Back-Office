import type { IncomingMessage, ServerResponse } from "node:http";
import { createCycle, getCycle, listCycles, updateCycle, type Phase } from "../services/cycleService.js";

export async function handleCycles(req: IncomingMessage, res: ServerResponse, body: unknown, pathParts: string[]): Promise<boolean> {
  if (pathParts[0] !== "api" || pathParts[1] !== "cycles") return false;
  const id = pathParts[2];

  if (req.method === "POST" && !id) {
    sendJson(res, 201, { cycle: createCycle(asRecord(body)) });
    return true;
  }

  if (req.method === "GET" && !id) {
    const url = new URL(req.url ?? "/", "http://localhost");
    sendJson(res, 200, { cycles: listCycles({ teamId: url.searchParams.get("teamId") ?? undefined, userId: url.searchParams.get("userId") ?? undefined }) });
    return true;
  }

  if (req.method === "GET" && id) {
    const cycle = getCycle(id);
    sendJson(res, cycle ? 200 : 404, cycle ? { cycle } : { error: "Cycle not found" });
    return true;
  }

  if (req.method === "PATCH" && id) {
    const input = asRecord(body);
    if (input.phase && !isPhase(input.phase)) return badRequest(res, "Invalid phase");
    const cycle = updateCycle(id, input);
    sendJson(res, cycle ? 200 : 404, cycle ? { cycle } : { error: "Cycle not found" });
    return true;
  }

  return false;
}

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && ["F0", "F1", "F2", "F3", "F4", "F5"].includes(value);
}

function asRecord(value: unknown): Record<string, never> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, never>) : {};
}

function badRequest(res: ServerResponse, error: string): true {
  sendJson(res, 400, { error });
  return true;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}
