import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:8000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const TEAM_ACCESS = parseAccessMap(process.env.TEAM_ACCESS || "demo-team:demo-cycle");
const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const buckets = new Map();

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".md": "text/markdown;charset=utf-8",
};

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return sendJson(res, 403, { error: "Origen no permitido" });
  setCorsHeaders(res, origin);

  if (req.method === "OPTIONS") return end(res, 204);
  if (req.url === "/api/chat" && req.method === "POST") return handleChat(req, res);
  if (req.url?.startsWith("/api/")) return sendJson(res, 404, { error: "API no encontrada" });
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Dropi Product Assistant listening on http://localhost:${PORT}`);
});

async function handleChat(req, res) {
  if (!API_KEY) return sendJson(res, 503, { error: "Servicio de IA no configurado" });
  const actor = String(req.headers["x-user-id"] || "anonymous");
  const teamId = String(req.headers["x-team-id"] || "");
  const cycleId = String(req.headers["x-cycle-id"] || "");

  if (!isAuthorized(teamId, cycleId)) return sendJson(res, 403, { error: "Sin autorización para este ciclo/equipo" });
  if (!consumeRateLimit(`${actor}:${teamId}`)) return sendJson(res, 429, { error: "Rate limit excedido" });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "JSON inválido o body demasiado grande" });
  }
  const validation = validateChatPayload(body);
  if (!validation.ok) return sendJson(res, 400, { error: validation.error });

  const safeContext = sanitizeRagContext(body.context || []);
  const reply = buildGuardedReply(body.message, safeContext);
  return sendJson(res, 200, { reply, retention: "No se almacena contenido de chat en este servidor demo." });
}

function validateChatPayload(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Payload inválido" };
  if (typeof body.message !== "string" || body.message.trim().length < 1 || body.message.length > 2000) {
    return { ok: false, error: "message debe ser texto entre 1 y 2000 caracteres" };
  }
  if (body.context !== undefined && (!Array.isArray(body.context) || body.context.length > 10)) {
    return { ok: false, error: "context debe ser un arreglo de máximo 10 documentos" };
  }
  return { ok: true };
}

function sanitizeRagContext(context) {
  return context.map((item) => ({
    title: String(item?.title || "Sin título").slice(0, 120),
    content: stripPromptInjection(String(item?.content || "")).slice(0, 1000),
  }));
}

function stripPromptInjection(value) {
  return value.replace(/(ignore|olvida|reveal|muestra|system prompt|developer message|api key|secret)/gi, "[redacted]");
}

function buildGuardedReply(message, context) {
  const contextNote = context.length ? ` Contexto verificado: ${context.map((item) => item.title).join(", ")}.` : "";
  return `Recibido: ${message.trim().slice(0, 280)}.${contextNote} Mantendré instrucciones externas como datos no confiables y no expondré secretos.`;
}

function consumeRateLimit(key) {
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) Object.assign(bucket, { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS });
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= RATE_LIMIT_MAX;
}

function isAuthorized(teamId, cycleId) {
  return Boolean(teamId && cycleId && TEAM_ACCESS.get(teamId)?.has(cycleId));
}

function parseAccessMap(value) {
  const map = new Map();
  for (const pair of value.split(",")) {
    const [team, cycles] = pair.split(":");
    if (!team || !cycles) continue;
    map.set(team.trim(), new Set(cycles.split("|").map((cycle) => cycle.trim()).filter(Boolean)));
  }
  return map;
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new Error("Body demasiado grande");
  }
  return raw ? JSON.parse(raw) : null;
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url || "/", `http://${req.headers.host}`).pathname);
  const relativePath = urlPath === "/" ? "index.html" : normalize(urlPath).replace(/^\.\.(\/|\\|$)/, "").replace(/^\//, "");
  const filePath = join(__dirname, relativePath);
  if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) return sendJson(res, 404, { error: "No encontrado" });
  res.setHeader("Content-Type", mimeTypes[extname(filePath)] || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  createReadStream(filePath).pipe(res);
}

function setCorsHeaders(res, origin) {
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-User-Id,X-Team-Id,X-Cycle-Id");
}

function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json;charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  end(res, status, JSON.stringify(payload));
}

function end(res, status, body = "") {
  res.statusCode = status;
  res.end(body);
}
