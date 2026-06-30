# Security

## Authentication

- JWT tokens signed with HMAC-SHA256 using `AUTH_SECRET` environment variable
- Token verification uses `crypto.timingSafeEqual` to prevent timing attacks
- `AUTH_SECRET` defaults to a random 32-byte hex string per process start — set it explicitly in production

## Authorization

- Role-based: `admin`, `pm`, `viewer`
- Route-level permission table in `server.js` → `routePermissions`
- Audit log captures all mutating actions with actor identity

## Input Validation

- All request bodies are size-limited to `MAX_BODY_BYTES` (512 KB)
- Path traversal protection: static file paths are checked to stay within `ROOT`
- JSON parse errors return 400 (no stack trace exposed)

## CORS

- Explicit allowlist via `ALLOWED_ORIGINS` environment variable
- No wildcard `*` origin allowed

## Rate Limiting

- In-memory bucket: 60 requests per minute per IP
- Returns 429 when exceeded

## Audit Events

- All mutating API calls are logged to `data/audit_events.json`
- Log is capped at 10,000 entries (ring buffer)
- Only `admin` role can read audit events via `/api/audit-events`

## Production Hardening Checklist

- [ ] Set `AUTH_SECRET` to a cryptographically random value (≥32 bytes)
- [ ] Set `ALLOWED_ORIGINS` to your production domain(s)
- [ ] Use HTTPS (reverse proxy: nginx, Caddy, or cloud load balancer)
- [ ] Replace in-memory user store with database + bcrypt password hashing
- [ ] Set `DATABASE_URL` for PostgreSQL persistence
- [ ] Rotate `AUTH_SECRET` periodically; invalidate old tokens
- [ ] Monitor audit log for anomalies
