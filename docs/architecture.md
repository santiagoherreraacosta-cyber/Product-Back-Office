# Architecture

## Overview

Dropi Product Back-Office is a vanilla JS web application backed by a Node.js HTTP server (no framework). It implements the B=MAP product cycle methodology: Sense (F0) → Diagnose (F1) → Design (F2) → Decide (F3) → Deploy (F4) → Distill (F5).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS + CSS custom properties |
| Backend | Node.js HTTP server (ESM, no framework) |
| Auth | JWT (HMAC-SHA256, `node:crypto`) |
| Database | PostgreSQL (optional; in-memory fallback) |
| LLM | OpenAI API (optional; fallback response when key missing) |
| Tests | Node.js built-in test runner (`node:test`) |
| E2E | Playwright |

## Directory Structure

```
/
├── server.js            # Unified HTTP server (auth + API + static serving)
├── app.js               # Frontend application logic
├── index.html           # Frontend HTML
├── styles.css           # Frontend styles
├── src/                 # Frontend source modules (contextStore, contextRetriever)
├── data/                # Persisted JSON stores (patterns, audit events)
├── server/
│   ├── src/
│   │   ├── domain/      # Phase engine (pure logic, no I/O)
│   │   ├── routes/      # HTTP route handlers (chat, cycles)
│   │   ├── services/    # LLM client, prompt builder, cycle service, export, extraction
│   │   └── db/          # PostgreSQL connection pool and migrations
│   ├── db/migrations/   # SQL migration files
│   └── test/            # TypeScript tests (phaseEngine, promptBuilder)
├── test/                # JS snapshot tests (exportService)
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests (API)
│   └── e2e/             # End-to-end tests (Playwright)
├── web/                 # React + TypeScript + Vite frontend (parallel to vanilla)
├── scripts/             # Build and test helper scripts
└── docs/                # Architecture and security docs
```

## Auth Flow

1. Client POSTs to `/api/auth/login` with `{ email, password }`
2. Server returns `{ token, user }` — token is a JWT signed with `AUTH_SECRET`
3. Client includes `Authorization: Bearer <token>` on subsequent requests
4. Server verifies signature with `crypto.timingSafeEqual` to prevent timing attacks

## Phase Gate Logic

Each phase has gate requirements validated in `server/src/domain/phaseEngine.ts`. A phase cannot be closed until all gates pass. Gates check fields on the cycle object.

| Phase | Gates |
|---|---|
| F0 Sense | behaviorStatement, quantitativeSignal |
| F1 Diagnose | ≥2 sources, bmapCause ∈ {Motivation, Ability, Prompt} |
| F2 Design | intervention, falsifiableHypothesis |
| F3 Decide | metric, sizeAndDuration, stopCriteria |
| F4 Deploy | trackingConfirmed |
| F5 Distill | decision, namedPattern |
