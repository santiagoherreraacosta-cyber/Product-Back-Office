// BUG-1 FIX: Unified server.js merging PRs #12 (JWT/auth/audit) + #14 (CORS/rate-limit/validation)
// + #20 (pattern CRUD) + #11 (context API) + original static serving.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getContextDocuments, updateContextDocument } from "./src/contextStore.js";

const PORT = process.env.PORT || 8000;
const ROOT = process.cwd();
// Persistence dir. Override with DATA_DIR to point at a Railway persistent
// volume (e.g. DATA_DIR=/data) so cycles/patterns survive redeploys.
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
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
let systemPrompt = "";

// Seed DATA_DIR from the bundled data/ on first boot. When DATA_DIR points at a
// fresh persistent volume it starts empty; copy any missing seed files (esp.
// context_documents.json, which the context store requires) so the app is
// functional immediately and then persists across redeploys.
async function seedDataDir() {
  const bundled = path.join(ROOT, "data");
  if (path.resolve(DATA_DIR) === path.resolve(bundled)) return; // no volume override
  const seedFiles = ["context_documents.json", "cycles.json", "patterns.json", "audit_events.json"];
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    for (const name of seedFiles) {
      const dest = path.join(DATA_DIR, name);
      try {
        await fs.access(dest);
      } catch {
        try {
          await fs.copyFile(path.join(bundled, name), dest);
          console.log(`Seeded ${name} into DATA_DIR`);
        } catch (err) {
          if (err.code !== "ENOENT") console.warn(`Could not seed ${name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn("Could not seed DATA_DIR:", err.message);
  }
}

// Load persisted data at startup (best-effort; missing files are expected on first run)
async function loadData() {
  await seedDataDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "audit_events.json"), "utf8");
    auditEvents = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("Could not load audit_events.json:", err.message);
  }
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "patterns.json"), "utf8");
    patterns = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("Could not load patterns.json:", err.message);
  }
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "cycles.json"), "utf8");
    JSON.parse(raw).forEach((c) => cycles.set(c.id, c));
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("Could not load cycles.json:", err.message);
  }
  try {
    systemPrompt = await fs.readFile(path.join(ROOT, "00_Orquestador.md"), "utf8");
  } catch {
    systemPrompt = "Eres Dropi, un asistente de producto experto en metodología B=MAP.";
  }
}

async function persistAuditEvents() {
  try {
    await fs.writeFile(path.join(DATA_DIR, "audit_events.json"), JSON.stringify(auditEvents, null, 2));
  } catch (err) {
    console.warn("Could not persist audit_events.json:", err.message);
  }
}

async function persistPatterns() {
  try {
    await fs.writeFile(path.join(DATA_DIR, "patterns.json"), JSON.stringify(patterns, null, 2));
  } catch (err) {
    console.warn("Could not persist patterns.json:", err.message);
  }
}

async function persistCycles() {
  try {
    await fs.writeFile(path.join(DATA_DIR, "cycles.json"), JSON.stringify(Array.from(cycles.values()), null, 2));
  } catch (err) {
    console.warn("Could not persist cycles.json:", err.message);
  }
}

// --- LLM structured extraction (Fase 1) ---
// After a chat turn, ask the model to extract Intervention Brief fields from the
// conversation as a forced tool call, returning the LIVE cycle schema directly.
// Only fields the model can infer are returned; the rest are omitted.
const BRIEF_EXTRACTION_TOOL = {
  name: "update_brief",
  description:
    "Extrae campos del Intervention Brief a partir de la conversación de producto (metodología B=MAP). " +
    "Devuelve SOLO los campos que se puedan inferir con evidencia de la conversación; omite los que no.",
  input_schema: {
    type: "object",
    properties: {
      behavior_statement: { type: "string", description: "Comportamiento objetivo: quién hace qué, cuándo, y no hace qué hoy." },
      sub_perfil: { type: "string", description: "Sub-perfil del usuario (ej. Rebuscador Digital, Seller Explorador)." },
      transicion: { type: "string", description: "Transición cognitiva (ej. Setup_Aha, Aha_Habito)." },
      causa: { type: "string", enum: ["M", "A", "P"], description: "Causa B=MAP: M=Motivación, A=Ability, P=Prompt." },
      evidencia_primaria: { type: "string", description: "Evidencia cuantitativa primaria del comportamiento." },
      segunda_fuente: { type: "string", description: "Segunda fuente de evidencia (triangulación)." },
      hipotesis: { type: "string", description: "Hipótesis de intervención falsable." },
      senal_cuantitativa: { type: "string", description: "Métrica de éxito / señal cuantitativa objetivo." },
    },
  },
};

const BRIEF_FIELD_KEYS = ["behavior_statement", "evidencia_primaria", "segunda_fuente", "hipotesis", "senal_cuantitativa"];
const CYCLE_TOP_KEYS = ["sub_perfil", "transicion", "causa"];

async function extractBriefUpdates(apiKey, model, cycle, userMessage, reply) {
  try {
    const context = JSON.stringify({
      fase: cycle.fase_actual ?? cycle.activePhase,
      brief_actual: cycle.brief ?? {},
      sub_perfil: cycle.sub_perfil, transicion: cycle.transicion, causa: cycle.causa,
    });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        tools: [BRIEF_EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "update_brief" },
        messages: [{
          role: "user",
          content:
            `Contexto del ciclo:\n${context}\n\n` +
            `Último turno de la conversación:\nUsuario: ${userMessage}\nAsistente: ${reply}\n\n` +
            `Extrae los campos del brief que se puedan inferir con evidencia. No inventes.`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const toolUse = (data.content ?? []).find((b) => b.type === "tool_use");
    return toolUse?.input ?? null;
  } catch (err) {
    console.warn("Brief extraction failed:", err.message);
    return null;
  }
}

// Merge extracted fields into the cycle without overwriting user-confirmed values.
function applyBriefUpdates(cycle, updates) {
  if (!updates || typeof updates !== "object") return { cycle, changed: [] };
  const brief = { ...(cycle.brief ?? {}) };
  const changed = [];
  for (const key of BRIEF_FIELD_KEYS) {
    const val = updates[key];
    if (typeof val !== "string" || !val.trim()) continue;
    if (brief[key]?.confirmed) continue; // never override a user-confirmed field
    brief[key] = { value: val.trim(), confirmed: false, source: "llm_suggested" };
    changed.push(`brief.${key}`);
  }
  const patch = { brief };
  for (const key of CYCLE_TOP_KEYS) {
    const val = updates[key];
    if (typeof val !== "string" || !val.trim()) continue;
    if (cycle[key]) continue; // don't override an existing top-level value
    patch[key] = val.trim();
    if (key === "causa") patch.causa_source = "llm_suggested";
    changed.push(key);
  }
  return { cycle: { ...cycle, ...patch }, changed };
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
// Passwords loaded from env vars. Each hash uses a random 16-byte salt (S2053: unpredictable salts).
// Format stored: "<saltHex>:<hashHex>" so salt travels with the hash.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = crypto.scryptSync(password, salt, 64);
  const actual = Buffer.from(hashHex, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function makeUser(id, emailEnv, emailDefault, passwordEnv, role) {
  const password = process.env[passwordEnv];
  if (!password) return null; // login disabled when env var not set
  return { id, email: process.env[emailEnv] || emailDefault, passwordHash: hashPassword(password), role };
}

const USERS = [
  makeUser("u1", "ADMIN_EMAIL", "admin@dropi.co", "ADMIN_PASSWORD", "admin"),
  makeUser("u2", "PM_EMAIL", "pm@dropi.co", "PM_PASSWORD", "pm"),
].filter(Boolean);

function findUser(email, password) {
  const user = USERS.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

// --- Route permissions ---
// null = public (no token required); array = allowed roles; undefined = default-deny
const routePermissions = {
  "GET /api/auth/me": ["admin", "pm", "viewer"],
  "POST /api/auth/login": null,
  // Context: public read; write requires admin JWT
  "GET /api/context": null,
  "PATCH /api/context": ["admin"],
  // Chat: public (rate limiting still applies)
  "POST /api/chat": null,
  // Health check: public
  "GET /health": null,
  "GET /api/cycles": ["admin", "pm", "viewer"],
  "POST /api/cycles": ["admin", "pm"],
  "PATCH /api/cycles": ["admin", "pm"],
  "PUT /api/cycles": ["admin", "pm"],
  "DELETE /api/cycles": ["admin", "pm"],
  "GET /api/patterns": ["admin", "pm", "viewer"],
  "POST /api/patterns": ["admin", "pm"],
  "PATCH /api/patterns": ["admin", "pm"],
  "POST /api/patterns/reuse": ["admin", "pm"],
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
  const event = { id: `evt-${crypto.randomUUID()}`, actor, action, resource, meta, timestamp: new Date().toISOString() };
  auditEvents.push(event);
  if (auditEvents.length > 10000) auditEvents = auditEvents.slice(-10000);
  // Fire-and-forget: explicitly void to satisfy linters
  void persistAuditEvents();
  return event;
}

// --- HTTP helpers ---
function cors(res, origin) {
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
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
    const now = new Date().toISOString();
    const cycle = {
      id: `cycle-${crypto.randomUUID()}`,
      title: body.title,
      sub_perfil: body.sub_perfil ?? null,
      segmento_objetivo: body.segmento_objetivo ?? null,
      transicion: body.transicion ?? null,
      causa: body.causa ?? null,
      causa_source: body.causa_source ?? null,
      fase_actual: body.fase_actual ?? "F0",
      estado: "activo",
      resultado_cierre: null,
      riesgos: body.riesgos ?? [],
      brief: body.brief ?? {},
      experiment: body.experiment ?? {},
      cierre: null,
      messages: [],
      // legacy fields (stepper UI still uses these)
      phases: body.phases ?? structuredClone([
        { key: "F0", label: "Sense", state: "active" },
        { key: "F1", label: "Diagnose", state: "todo" },
        { key: "F2", label: "Design", state: "todo" },
        { key: "F3", label: "Decide", state: "todo" },
        { key: "F4", label: "Deploy", state: "todo" },
        { key: "F5", label: "Distill", state: "todo" },
      ]),
      activePhase: body.activePhase ?? "F0",
      riskAccepted: false,
      createdAt: now,
      updatedAt: now,
      last_activity_at: now,
      createdBy: currentUser?.sub,
    };
    cycles.set(cycle.id, cycle);
    void persistCycles();
    logAudit(currentUser?.email, "cycle_created", cycle.id);
    return json(res, cycle, 201);
  }

  if (pathname.startsWith("/api/cycles/")) {
    const parts = pathname.split("/");
    const cycleId = parts[3];
    const rest = parts.slice(4).join("/");

    if (req.method === "POST" && rest === "close") {
      const cycle = cycles.get(cycleId);
      if (!cycle) return json(res, { error: "Not found" }, 404);
      const body = await readBody(req);
      if (!body.learning?.trim() || !body.pattern_name?.trim()) {
        return json(res, { error: "learning and pattern_name required" }, 400);
      }
      const now = new Date().toISOString();
      const patternId = `pat-${crypto.randomUUID()}`;
      const newPattern = {
        id: patternId,
        tipo: body.tipo ?? "patron",
        nombre: body.pattern_name.trim(),
        causa: cycle.causa ?? null,
        sub_perfil: cycle.sub_perfil ?? null,
        transicion: cycle.transicion ?? null,
        aprendizaje: body.learning.trim(),
        delta_metrica: body.delta?.trim() || null,
        evidencia: body.evidencia?.trim() || null,
        ciclo_origen_id: cycleId,
        veces_reutilizado: 0,
        createdAt: now,
        createdBy: currentUser?.sub,
      };
      const closedPhases = (cycle.phases ?? []).map((p) => ({
        ...p,
        state: p.key === "F5" ? "done" : p.state === "active" ? "done" : p.state,
      }));
      const closedCycle = {
        ...cycle,
        estado: "cerrado",
        fase_actual: "F5",
        activePhase: "F5",
        phases: closedPhases,
        resultado_cierre: body.resultado_cierre ?? body.decision ?? null,
        cierre: {
          metric_result: body.metric_result ?? null,
          delta: body.delta ?? null,
          decision: body.decision ?? null,
          learning: body.learning.trim(),
          pattern_id: patternId,
        },
        updatedAt: now,
        last_activity_at: now,
      };
      cycles.set(cycleId, closedCycle);
      patterns.push(newPattern);
      void persistCycles();
      void persistPatterns();
      logAudit(currentUser?.email, "cycle_closed", cycleId, { patternId });
      return json(res, { cycle: closedCycle, pattern: newPattern });
    }

    if (req.method === "GET" && !rest) {
      const cycle = cycles.get(cycleId);
      if (!cycle) return json(res, { error: "Not found" }, 404);
      return json(res, cycle);
    }
    if ((req.method === "PATCH" || req.method === "PUT") && !rest) {
      const cycle = cycles.get(cycleId);
      if (!cycle) return json(res, { error: "Not found" }, 404);
      const body = await readBody(req);
      const now = new Date().toISOString();
      const updated = { ...cycle, ...body, id: cycleId, updatedAt: now, last_activity_at: now };
      cycles.set(cycleId, updated);
      void persistCycles();
      logAudit(currentUser?.email, "cycle_updated", cycleId);
      return json(res, updated);
    }
    if (req.method === "DELETE" && !rest) {
      if (!cycles.has(cycleId)) return json(res, { error: "Not found" }, 404);
      cycles.delete(cycleId);
      void persistCycles();
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
    const pattern = { id: `pat-${crypto.randomUUID()}`, ...body, createdAt: new Date().toISOString(), createdBy: currentUser?.sub };
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
      // Increment reuse count
      const idx = patterns.findIndex((p) => p.id === patId);
      patterns[idx] = { ...pattern, veces_reutilizado: (pattern.veces_reutilizado ?? 0) + 1 };
      const now = new Date().toISOString();
      const newCycle = {
        id: `cycle-${crypto.randomUUID()}`,
        title: `[Reuso] ${pattern.nombre ?? pattern.name}`,
        sub_perfil: pattern.sub_perfil ?? null,
        segmento_objetivo: null,
        transicion: pattern.transicion ?? null,
        causa: pattern.causa ?? null,
        causa_source: "llm_suggested",
        fase_actual: "F0",
        estado: "activo",
        resultado_cierre: null,
        riesgos: [],
        brief: { hipotesis: { value: pattern.aprendizaje ?? "", confirmed: false } },
        experiment: {},
        cierre: null,
        messages: [],
        phases: [
          { key: "F0", label: "Sense", state: "active" },
          { key: "F1", label: "Diagnose", state: "todo" },
          { key: "F2", label: "Design", state: "todo" },
          { key: "F3", label: "Decide", state: "todo" },
          { key: "F4", label: "Deploy", state: "todo" },
          { key: "F5", label: "Distill", state: "todo" },
        ],
        activePhase: "F0",
        riskAccepted: false,
        reusedFromPattern: patId,
        createdAt: now,
        updatedAt: now,
        last_activity_at: now,
        createdBy: currentUser?.sub,
      };
      cycles.set(newCycle.id, newCycle);
      void persistCycles();
      void persistPatterns();
      logAudit(currentUser?.email, "pattern_reused", patId, { newCycleId: newCycle.id });
      return json(res, { pattern: patterns[idx], newCycle }, 201);
    }
  }

  // --- Chat endpoint (LLM via Anthropic API) ---
  if (req.method === "POST" && pathname === "/api/chat") {
    const body = await readBody(req);
    const { message, cycleId } = body;
    if (!message?.trim()) return json(res, { error: "message required" }, 400);

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return json(res, { reply: "[LLM no configurado — agrega ANTHROPIC_API_KEY al .env] " + message });
    }

    const cycle = cycleId ? cycles.get(cycleId) : null;
    // Build conversation history (last 20 messages)
    const history = (cycle?.messages ?? []).slice(-20).map((m) => ({ role: m.role, content: m.content }));
    // Build structured cycle context for system prompt
    const cycleCtx = cycle ? JSON.stringify({
      fase: cycle.fase_actual ?? cycle.activePhase,
      sub_perfil: cycle.sub_perfil,
      transicion: cycle.transicion,
      causa: cycle.causa,
      causa_source: cycle.causa_source,
      brief: cycle.brief,
      riesgos: cycle.riesgos,
      estado: cycle.estado,
    }, null, 2) : null;
    const systemWithCtx = cycleCtx
      ? `${systemPrompt}\n\n---\n## CICLO ACTIVO\n${cycleCtx}`
      : systemPrompt;

    const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemWithCtx,
        messages: [...history, { role: "user", content: message }],
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.json().catch(() => ({}));
      console.error("Anthropic API error:", err);
      return json(res, { error: "LLM request failed", detail: err?.error?.message ?? llmRes.status }, 502);
    }

    const data = await llmRes.json();
    const reply = data.content?.[0]?.text ?? "Sin respuesta del modelo.";

    // Persist messages + run structured extraction to auto-fill the brief (Fase 1)
    let updatedCycle = null;
    let extractionChanged = [];
    if (cycle) {
      const now = new Date().toISOString();
      const msgs = cycle.messages ?? [];
      msgs.push({ id: crypto.randomUUID(), role: "user", content: message, fase: cycle.fase_actual ?? cycle.activePhase, created_at: now });
      msgs.push({ id: crypto.randomUUID(), role: "assistant", content: reply, fase: cycle.fase_actual ?? cycle.activePhase, created_at: now });
      let next = { ...cycle, messages: msgs, last_activity_at: now };

      const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
      const updates = await extractBriefUpdates(ANTHROPIC_API_KEY, model, next, message, reply);
      const applied = applyBriefUpdates(next, updates);
      next = { ...applied.cycle, updatedAt: now };
      extractionChanged = applied.changed;

      cycles.set(cycleId, next);
      updatedCycle = next;
      void persistCycles();
      if (extractionChanged.length) logAudit(currentUser?.email || "anon", "brief_extracted", cycleId, { fields: extractionChanged });
    }

    logAudit(currentUser?.email || "anon", "chat_message", cycleId || "global");
    return json(res, { reply, cycle: updatedCycle, changed: extractionChanged });
  }

  // --- Health check ---
  if (req.method === "GET" && pathname === "/health") {
    return json(res, { status: "ok", uptime: Math.floor(process.uptime()) });
  }

  // --- Audit events (PR #12) ---
  if (req.method === "GET" && pathname === "/api/audit-events") {
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    return json(res, auditEvents.slice(-limit).reverse());
  }

  // --- Static file serving ---
  if (req.method !== "GET") return json(res, { error: "Method not allowed" }, 405);
  const staticRoot = path.resolve(ROOT);
  const relativePart = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  // Only serve files with known safe extensions — prevents leaking .env, data files, etc.
  const reqExt = path.extname(relativePart).toLowerCase();
  if (!TYPES[reqExt]) return json(res, { error: "Not found" }, 404);
  // path.resolve canonicalizes the path (resolves ..), then we verify it stays inside staticRoot
  const filePath = path.resolve(staticRoot, relativePart);
  if (!filePath.startsWith(staticRoot + path.sep)) {
    return json(res, { error: "Forbidden" }, 403);
  }
  const content = await fs.readFile(filePath);
  res.writeHead(200, { "Content-Type": TYPES[reqExt] });
  res.end(content);
}

loadData()
  .then(() => {
    http.createServer(async (req, res) => {
      try {
        await handle(req, res);
      } catch (error) {
        if (error.code === "ENOENT") return json(res, { error: "Not found" }, 404);
        if (error instanceof SyntaxError) return json(res, { error: "Invalid JSON" }, 400);
        json(res, { error: error.message }, error.statusCode || 500);
      }
    }).listen(PORT, "0.0.0.0", () => console.log(`Dropi Product Assistant en http://0.0.0.0:${PORT}`));
  })
  .catch((err) => { console.error("Failed to start server:", err); process.exit(1); });
