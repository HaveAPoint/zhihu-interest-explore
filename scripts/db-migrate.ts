// Migration runner script for PostgreSQL
// Executes ordered SQL migration files in server/migrations

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPgPool, closePgPool } from '../server/src/repositories/pg-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../server/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No server/migrations directory found. Skipping.');
    return;
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch applied migrations
    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id ASC'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 3. Find all SQL migration files
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of sqlFiles) {
      if (appliedSet.has(file)) {
        console.log(`[skip] Migration ${file} already applied.`);
        continue;
      }

      console.log(`[apply] Running migration ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[done] Migration ${file} successfully applied.`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[error] Migration ${file} failed:`, err);
        throw err;
      }
    }

    console.log(`Migrations complete. ${count} new migration(s) applied.`);
  } finally {
    client.release();
    await closePgPool();
  }
}

runMigrations().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
