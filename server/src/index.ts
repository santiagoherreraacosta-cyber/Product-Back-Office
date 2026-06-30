import { createServer } from "node:http";
import { handleChat } from "./routes/chat.js";
import { handleCycles } from "./routes/cycles.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (req: any, res: any) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathParts = url.pathname.split("/").filter(Boolean);
    const body = await readJsonBody(req);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "dropi-product-assistant-server" });
      return;
    }

    if (await handleChat(req, res, body, pathParts)) return;
    if (await handleCycles(req, res, body, pathParts)) return;

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Dropi backend listening on http://0.0.0.0:${port}`);
});

async function readJsonBody(req: any): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: any[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as unknown;
}

function sendJson(res: any, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}
