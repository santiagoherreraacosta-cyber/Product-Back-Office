import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 8000);
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-dropi-secret-change-me";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const AUDIT_FILE = path.join(DATA_DIR, "audit_events.json");

const users = [
  { id: "usr_pm_santiago", email: "santiago@dropi.local", name: "Santiago", role: "pm" },
  { id: "usr_admin_valentina", email: "valentina@dropi.local", name: "Valentina", role: "admin" },
  { id: "usr_viewer_mateo", email: "mateo@dropi.local", name: "Mateo", role: "viewer" },
];
const rolePermissions = { viewer: ["read"], pm: ["read", "write", "export", "gate:close", "risk:accept"], admin: ["read", "write", "export", "gate:close", "risk:accept", "admin"] };
const routePermissions = { "POST /api/chat": "read", "GET /api/cycles": "read", "POST /api/cycles": "write", "GET /api/context": "read", "PUT /api/context": "write", "GET /api/patterns": "read", "POST /api/patterns": "write" };
const auditableActions = new Set(["risk.accepted", "gate.closed", "context_dropi.edited", "brief.exported", "experiment.exported"]);
const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

let dropiContext = { doctrine: "Base de conocimiento editable para doctrina, perfiles, OKRs y Dropi Score.", profile: "Rebuscador Digital: seller que explora oportunidades y necesita claridad del siguiente paso rentable.", okrs: "[CONFIRMAR] baseline y meta Q3.", updatedAt: new Date().toISOString() };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(url, res);
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}).listen(PORT, () => console.log(`Dropi Product Back Office running on http://localhost:${PORT}`));

async function handleApi(req, res, url) {
  const routeKey = `${req.method} ${url.pathname}`;
  if (routeKey === "GET /api/auth/providers") return json(res, 200, { selected: "internal-sso", label: "SSO interno Dropi", supported: ["Google Workspace", "Auth0", "Clerk", "Supabase Auth", "SSO interno"], roles: Object.keys(rolePermissions) });
  if (routeKey === "POST /api/auth/login") {
    const body = await readJson(req);
    const user = users.find((candidate) => candidate.email === String(body.email || "").toLowerCase());
    return user ? json(res, 200, { token: signToken(user), user }) : json(res, 401, { error: "Usuario no autorizado en SSO interno" });
  }

  const user = authenticate(req);
  if (!user) return json(res, 401, { error: "Autenticación requerida" });
  const required = routePermissions[routeKey];
  if (required && !hasPermission(user.role, required)) return json(res, 403, { error: "Rol sin permisos" });

  if (routeKey === "GET /api/auth/me") return json(res, 200, { user, provider: "internal-sso" });
  if (routeKey === "POST /api/chat") {
    const body = await readJson(req);
    return json(res, 200, { reply: `Recibido por ${user.name}: ${String(body.message || "").slice(0, 240)}` });
  }
  if (routeKey === "GET /api/cycles") return json(res, 200, { cycles: [{ id: "cycle_activation_aha", name: "Cliff de activación post-Aha", phase: "F1", status: "in_progress" }] });
  if (routeKey === "POST /api/cycles") return json(res, 201, { cycle: { id: crypto.randomUUID(), ...(await readJson(req)), createdBy: user.id } });
  if (routeKey === "GET /api/context") return json(res, 200, { context: dropiContext });
  if (routeKey === "PUT /api/context") {
    dropiContext = { ...dropiContext, ...(await readJson(req)), updatedAt: new Date().toISOString(), updatedBy: user.id };
    await appendAuditEvent(user, "context_dropi.edited", "context_dropi", dropiContext);
    return json(res, 200, { context: dropiContext });
  }
  if (routeKey === "GET /api/patterns") return json(res, 200, { patterns: [{ id: "pattern_reduce_ability", type: "pattern", title: "Reducir pasos de Ability después del primer pedido" }] });
  if (routeKey === "POST /api/patterns") return json(res, 201, { pattern: { id: crypto.randomUUID(), ...(await readJson(req)), createdBy: user.id } });
  if (routeKey === "POST /api/audit-events") {
    const body = await readJson(req);
    const action = String(body.action || "");
    if (!auditableActions.has(action)) return json(res, 400, { error: "Acción auditable no soportada" });
    const permission = action === "risk.accepted" ? "risk:accept" : action === "gate.closed" ? "gate:close" : action.includes("exported") ? "export" : "write";
    if (!hasPermission(user.role, permission)) return json(res, 403, { error: "Rol sin permisos para auditar esta acción" });
    return json(res, 201, { event: await appendAuditEvent(user, action, body.target || "workspace", body.metadata || {}) });
  }
  if (routeKey === "GET /api/audit-events") return hasPermission(user.role, "admin") ? json(res, 200, { events: await readAuditEvents() }) : json(res, 403, { error: "Solo admin puede ver auditoría completa" });
  return json(res, 404, { error: "Endpoint no encontrado" });
}

async function serveStatic(url, res) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: "Ruta inválida" });
  try {
    await fs.access(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    json(res, 404, { error: "Archivo no encontrado" });
  }
}

function authenticate(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  return payload && users.find((candidate) => candidate.id === payload.sub);
}
function hasPermission(role, permission) { return rolePermissions[role]?.includes(permission); }
function signToken(user) {
  const body = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 28800 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url")}`;
}
function verifyToken(token) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
}
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function json(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(payload)); }
async function readAuditEvents() { try { return JSON.parse(await fs.readFile(AUDIT_FILE, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
async function appendAuditEvent(user, action, target, metadata) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const events = await readAuditEvents();
  const event = { id: crypto.randomUUID(), action, target, metadata, actorId: user.id, actorEmail: user.email, actorRole: user.role, occurredAt: new Date().toISOString() };
  events.push(event);
  await fs.writeFile(AUDIT_FILE, `${JSON.stringify(events, null, 2)}\n`);
  return event;
}
