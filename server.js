// BUG-1 FIX: Unified server.js merging PRs #12 (JWT/auth/audit) + #14 (CORS/rate-limit/validation)
// + #20 (pattern CRUD) + #11 (context API) + original static serving.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getContextDocuments, updateContextDocument } from "./src/contextStore.js";

const PORT = process.env.PORT || 8000;
const ROOT = process.cwd();
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:8000,http://localhost:3000").split(",").map((s) => s.trim());
const MAX_BODY_BYTES = 512 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// --- In-memory stores ---
const cycles = new Map();
const rateBuckets = new Map();
let auditEvents = [];
let patterns = [];

// Load persisted data at startup (best-effort)
async function loadData() {
  try {
    const raw = await fs.readFile(path.join(ROOT, "data/audit_events.json"), "utf8");
    auditEvents = JSON.parse(raw);
  } catch {}
  try {
    const raw = await fs.readFile(path.join(ROOT, "data/patterns.json"), "utf8");
    patterns = JSON.parse(raw);
  } catch {}
}

async function persistAuditEvents() {
  try { await fs.writeFile(path.join(ROOT, "data/audit_events.json"), JSON.stringify(auditEvents, null, 2)); } catch {}
}

async function persistPatterns() {
  try { await fs.writeFile(path.join(ROOT, "data/patterns.json"), JSON.stringify(patterns, null, 2)); } catch {}
}

// --- JWT (HMAC-SHA256, no external deps) ---
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = b64url(crypto.createHmac("sha256", AUTH_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = b64url(crypto.createHmac("sha256", AUTH_SECRET).update(`${parts[0]}.${parts[1]}`).digest());
  try {
    const expBuf = Buffer.from(expected);
    const actBuf = Buffer.from(parts[2]);
    if (expBuf.length !== actBuf.length) return null;
    if (!crypto.timingSafeEqual(expBuf, actBuf)) return null;
  } catch { return null; }
  try { return JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")); } catch { return null; }
}

// --- Users (demo in-memory; replace with DB in production) ---
const USERS = [
  { id: "u1", email: "admin@dropi.co", passwordHash: crypto.createHash("sha256").update("admin123").digest("hex"), role: "admin" },
  { id: "u2", email: "pm@dropi.co", passwordHash: crypto.createHash("sha256").update("pm123").digest("hex"), role: "pm" },
];

function findUser(email, password) {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return USERS.find((u) => u.email === email && u.passwordHash === hash) || null;
}

// --- Route permissions ---
const routePermissions = {
  "GET /api/auth/me": ["admin", "pm", "viewer"],
  "POST /api/auth/login": null, // public
  "GET /api/cycles": ["admin", "pm", "viewer"],
  "POST /api/cycles": ["admin", "pm"],
  "GET /api/context": ["admin", "pm", "viewer"],
  "PATCH /api/context": ["admin", "pm"],
  "GET /api/patterns": ["admin", "pm", "viewer"],
  "POST /api/patterns": ["admin", "pm"],
  "PATCH /api/patterns": ["admin", "pm"],
  "GET /api/audit-events": ["admin"],
};

function getRouteKey(method, pathname) {
  if (pathname.startsWith("/api/cycles/")) return `${method} /api/cycles`;
  if (pathname.startsWith("/api/context/")) return `${method} /api/context`;
  if (pathname.startsWith("/api/patterns/")) return `${method} /api/patterns`;
  return `${method} ${pathname}`;
}

// --- Rate limiting ---
function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + RATE_LIMIT_WINDOW_MS; }
  bucket.count++;
  rateBuckets.set(ip, bucket);
  return bucket.count <= RATE_LIMIT_MAX;
}

// --- Audit logging ---
function logAudit(actor, action, resource, meta = {}) {
  const event = { id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, actor, action, resource, meta, timestamp: new Date().toISOString() };
  auditEvents.push(event);
  if (auditEvents.length > 10000) auditEvents = auditEvents.slice(-10000);
  persistAuditEvents();
  return event;
}

// --- HTTP helpers ---
function cors(res, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Vary", "Origin");
}

function json(res, payload, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error("Payload too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

// --- Request handler ---
async function handle(req, res) {
  const origin = req.headers["origin"] || "";
  cors(res, origin);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const ip = getIp(req);
  if (!checkRateLimit(ip)) return json(res, { error: "Rate limit exceeded" }, 429);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  // Auth check
  const routeKey = getRouteKey(req.method, pathname);
  const requiredRoles = routePermissions[routeKey];
  let currentUser = null;

  if (requiredRoles !== undefined && requiredRoles !== null) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const claims = verifyToken(token);
    if (!claims) return json(res, { error: "Unauthorized" }, 401);
    if (!requiredRoles.includes(claims.role)) return json(res, { error: "Forbidden" }, 403);
    currentUser = claims;
  }

  // --- Auth routes ---
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    if (!body.email || !body.password) return json(res, { error: "email and password required" }, 400);
    const user = findUser(String(body.email), String(body.password));
    if (!user) { logAudit("anonymous", "login_failed", body.email); return json(res, { error: "Invalid credentials" }, 401); }
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    logAudit(user.email, "login", user.email);
    return json(res, { token, user: { id: user.id, email: user.email, role: user.role } });
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    return json(res, { id: currentUser.sub, email: currentUser.email, role: currentUser.role });
  }

  // --- Context routes (PR #11) ---
  if (req.method === "GET" && pathname === "/api/context") {
    return json(res, await getContextDocuments());
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/context/")) {
    const id = decodeURIComponent(pathname.split("/").pop());
    const body = await readBody(req);
    const updated = await updateContextDocument(id, body, currentUser?.role);
    logAudit(currentUser?.email || "system", "context_updated", id);
    return json(res, updated);
  }

  // --- Cycles routes (PR #12) ---
  if (req.method === "GET" && pathname === "/api/cycles") {
    return json(res, Array.from(cycles.values()));
  }

  if (req.method === "POST" && pathname === "/api/cycles") {
    const body = await readBody(req);
    if (!body.title) return json(res, { error: "title required" }, 400);
    const cycle = { id: `cycle-${Date.now()}`, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: currentUser?.sub };
    cycles.set(cycle.id, cycle);
    logAudit(currentUser?.email, "cycle_created", cycle.id);
    return json(res, cycle, 201);
  }

  if (pathname.startsWith("/api/cycles/")) {
    const cycleId = pathname.split("/")[3];
    if (req.method === "GET") {
      const cycle = cycles.get(cycleId);
      if (!cycle) return json(res, { error: "Not found" }, 404);
      return json(res, cycle);
    }
    if (req.method === "PATCH" || req.method === "PUT") {
      const cycle = cycles.get(cycleId);
      if (!cycle) return json(res, { error: "Not found" }, 404);
      const body = await readBody(req);
      const updated = { ...cycle, ...body, id: cycleId, updatedAt: new Date().toISOString() };
      cycles.set(cycleId, updated);
      logAudit(currentUser?.email, "cycle_updated", cycleId);
      return json(res, updated);
    }
    if (req.method === "DELETE") {
      if (!cycles.has(cycleId)) return json(res, { error: "Not found" }, 404);
      cycles.delete(cycleId);
      logAudit(currentUser?.email, "cycle_deleted", cycleId);
      return json(res, { ok: true });
    }
  }

  // --- Patterns routes (PR #20) ---
  if (req.method === "GET" && pathname === "/api/patterns") {
    return json(res, patterns);
  }

  if (req.method === "POST" && pathname === "/api/patterns") {
    const body = await readBody(req);
    if (!body.name) return json(res, { error: "name required" }, 400);
    const pattern = { id: `pat-${Date.now()}`, ...body, createdAt: new Date().toISOString(), createdBy: currentUser?.sub };
    patterns.push(pattern);
    await persistPatterns();
    logAudit(currentUser?.email, "pattern_created", pattern.id, { name: pattern.name });
    return json(res, pattern, 201);
  }

  if (pathname.startsWith("/api/patterns/")) {
    const patId = pathname.split("/")[3];
    const rest = pathname.split("/").slice(4).join("/");

    if (req.method === "PATCH" && !rest) {
      const idx = patterns.findIndex((p) => p.id === patId);
      if (idx === -1) return json(res, { error: "Not found" }, 404);
      const body = await readBody(req);
      patterns[idx] = { ...patterns[idx], ...body, id: patId, updatedAt: new Date().toISOString() };
      await persistPatterns();
      logAudit(currentUser?.email, "pattern_updated", patId);
      return json(res, patterns[idx]);
    }

    if (req.method === "POST" && rest === "reuse") {
      const pattern = patterns.find((p) => p.id === patId);
      if (!pattern) return json(res, { error: "Not found" }, 404);
      const body = await readBody(req);
      const reuse = { id: `pat-${Date.now()}`, ...pattern, ...body, id: `pat-${Date.now()}`, reusedFrom: patId, createdAt: new Date().toISOString(), createdBy: currentUser?.sub };
      patterns.push(reuse);
      await persistPatterns();
      logAudit(currentUser?.email, "pattern_reused", patId, { newId: reuse.id });
      return json(res, reuse, 201);
    }
  }

  // --- Audit events (PR #12) ---
  if (req.method === "GET" && pathname === "/api/audit-events") {
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    return json(res, auditEvents.slice(-limit).reverse());
  }

  // --- Static file serving with path traversal protection ---
  if (req.method !== "GET") return json(res, { error: "Method not allowed" }, 405);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) return json(res, { error: "Forbidden" }, 403);
  const content = await fs.readFile(filePath);
  res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
  res.end(content);
}

loadData().then(() => {
  http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (error) {
      if (error.code === "ENOENT") return json(res, { error: "Not found" }, 404);
      if (error instanceof SyntaxError) return json(res, { error: "Invalid JSON" }, 400);
      json(res, { error: error.message }, error.statusCode || 500);
    }
  }).listen(PORT, "0.0.0.0", () => console.log(`Dropi Product Assistant en http://0.0.0.0:${PORT}`));
});
