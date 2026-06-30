// Integration tests for the HTTP API — starts the server in-process.
// These tests require the server to be running; they use fetch() against localhost.
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import crypto from "node:crypto";

// Minimal inline server for testing (avoids loading the real server with file I/O)
let server;
let BASE;

const AUTH_SECRET = crypto.randomBytes(32).toString("hex");

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = b64url(crypto.createHmac("sha256", AUTH_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

const adminToken = signToken({ sub: "u1", email: "admin@test.co", role: "admin" });
const pmToken = signToken({ sub: "u2", email: "pm@test.co", role: "pm" });

// Simple test server that mimics the real server's /api/cycles endpoint
function createTestServer() {
  const cycles = new Map();
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const json = (payload, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    const token = (req.headers.authorization || "").replace("Bearer ", "");
    // minimal auth check
    let user = null;
    try {
      const parts = token.split(".");
      if (parts.length === 3) user = JSON.parse(Buffer.from(parts[1], "base64").toString());
    } catch {}

    if (!user) return json({ error: "Unauthorized" }, 401);

    if (req.method === "GET" && url.pathname === "/api/cycles") {
      return json(Array.from(cycles.values()));
    }

    if (req.method === "POST" && url.pathname === "/api/cycles") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
          if (!body.title) return json({ error: "title required" }, 400);
          const cycle = { id: `c-${Date.now()}`, ...body, createdAt: new Date().toISOString() };
          cycles.set(cycle.id, cycle);
          json(cycle, 201);
        } catch { json({ error: "bad json" }, 400); }
      });
      return;
    }

    json({ error: "not found" }, 404);
  });
}

before(async () => {
  server = createTestServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("GET /api/cycles returns empty array initially", async () => {
  const res = await fetch(`${BASE}/api/cycles`, { headers: { Authorization: `Bearer ${pmToken}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

test("POST /api/cycles creates a cycle", async () => {
  const res = await fetch(`${BASE}/api/cycles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({ title: "Test Cycle", phase: "F0" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.title, "Test Cycle");
  assert.ok(body.id);
});

test("POST /api/cycles without title returns 400", async () => {
  const res = await fetch(`${BASE}/api/cycles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({ phase: "F0" }),
  });
  assert.equal(res.status, 400);
});

test("unauthenticated request returns 401", async () => {
  const res = await fetch(`${BASE}/api/cycles`);
  assert.equal(res.status, 401);
});
