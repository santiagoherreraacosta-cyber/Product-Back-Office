import pg from "pg";

const { Pool } = pg;

const DEFAULT_MAX_CONNECTIONS = 10;

let defaultPool;

export function createPool(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to Postgres");
  }

  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? DEFAULT_MAX_CONNECTIONS),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 5_000),
    ...options,
  });
}

export function getPool() {
  if (!defaultPool) {
    defaultPool = createPool();
  }

  return defaultPool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!defaultPool) return;

  await defaultPool.end();
  defaultPool = undefined;
}
