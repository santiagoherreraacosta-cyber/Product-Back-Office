import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "..", "db", "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

export async function runMigrations({ pool = createPool(), directory = migrationsDir } = {}) {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    const executed = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await readFile(join(directory, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      executed.push(file);
    }

    return executed;
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then((executed) => {
      if (executed.length === 0) {
        console.log("No pending migrations.");
        return;
      }

      console.log(`Applied migrations: ${executed.join(", ")}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
