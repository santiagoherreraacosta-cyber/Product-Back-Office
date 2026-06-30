import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDir = join(root, "data");
const patternsFile = join(dataDir, "patterns.json");
const port = Number(process.env.PORT || 8000);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
]);

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(patternsFile)) await writeFile(patternsFile, "[]\n", "utf8");
}

async function readPatterns() {
  await ensureStore();
  return JSON.parse(await readFile(patternsFile, "utf8"));
}

async function writePatterns(patterns) {
  await writeFile(patternsFile, `${JSON.stringify(patterns, null, 2)}\n`, "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizePattern(input, previous = {}) {
  const now = new Date().toISOString();
  const rawType = input.type || previous.type || "pattern";
  const type = rawType === "anti" || rawType === "anti-pattern" ? "anti" : "pattern";
  return {
    ...previous,
    id: previous.id || randomUUID(),
    type,
    name: String(input.name || previous.name || "Patrón sin nombre").trim(),
    learning: String(input.learning || previous.learning || "").trim(),
    cause: String(input.cause || previous.cause || "Ability").trim(),
    segment: String(input.segment || previous.segment || "Rebuscador Digital").trim(),
    stage: String(input.stage || previous.stage || "Setup → Aha").trim(),
    source_cycle: String(input.source_cycle || previous.source_cycle || "Ciclo actual").trim(),
    reuse_count: Number.isFinite(Number(previous.reuse_count)) ? Number(previous.reuse_count) : 0,
    created_at: previous.created_at || now,
    updated_at: now,
  };
}

async function handleApi(req, res, url) {
  const match = url.pathname.match(/^\/api\/patterns(?:\/([^/]+)(?:\/(reuse))?)?$/);
  if (!match) return false;
  const [, id, action] = match;
  const patterns = await readPatterns();

  if (req.method === "GET" && !id) return sendJson(res, 200, patterns);
  if (req.method === "GET" && id && !action) {
    const pattern = patterns.find((item) => item.id === id);
    return pattern ? sendJson(res, 200, pattern) : sendJson(res, 404, { error: "Pattern not found" });
  }
  if (req.method === "POST" && !id) {
    const pattern = normalizePattern(await readJson(req));
    patterns.unshift(pattern);
    await writePatterns(patterns);
    return sendJson(res, 201, pattern);
  }
  if (req.method === "PATCH" && id && !action) {
    const index = patterns.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { error: "Pattern not found" });
    patterns[index] = normalizePattern(await readJson(req), patterns[index]);
    await writePatterns(patterns);
    return sendJson(res, 200, patterns[index]);
  }
  if (req.method === "POST" && id && action === "reuse") {
    const pattern = patterns.find((item) => item.id === id);
    if (!pattern) return sendJson(res, 404, { error: "Pattern not found" });
    pattern.reuse_count = Number(pattern.reuse_count || 0) + 1;
    pattern.updated_at = new Date().toISOString();
    await writePatterns(patterns);
    return sendJson(res, 200, pattern);
  }
  return sendJson(res, 405, { error: "Method not allowed" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": mimeTypes.get(extname(filePath)) || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (await handleApi(req, res, url)) return;
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Dropi Product Assistant running on http://0.0.0.0:${port}`);
});
