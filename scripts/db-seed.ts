// Database seed script: imports preset discipline skeletons into PG idempotently
// Complies with 作者本人开发计划 §4.5

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPgPool, closePgPool } from '../server/src/repositories/pg-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  const disciplinesDir = path.resolve(__dirname, '../disciplines');
  const indexPath = path.join(disciplinesDir, 'index.json');

  if (!fs.existsSync(indexPath)) {
    console.error('disciplines/index.json not found!');
    process.exit(1);
  }

  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const entry of indexData) {
      const { slug, name, major } = entry;
      const jsonPath = path.join(disciplinesDir, `${slug}.json`);

      if (!fs.existsSync(jsonPath)) {
        console.warn(`Discipline file ${jsonPath} not found, skipping.`);
        continue;
      }

      const fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      console.log(`Seeding discipline [${slug}]: ${name} (${major})...`);

      // 1. Upsert discipline
      await client.query(
        `INSERT INTO disciplines (slug, name, major, origin)
         VALUES ($1, $2, $3, 'preset')
         ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name, major = EXCLUDED.major`,
        [slug, name, major]
      );

      // 2. Upsert nodes in topological order (parents before children)
      const nodes = fileData.nodes ?? [];

      for (const node of nodes) {
        await client.query(
          `INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE
           SET title = EXCLUDED.title,
               aliases = EXCLUDED.aliases,
               definition = EXCLUDED.definition,
               sort_order = EXCLUDED.sort_order,
               parent_id = EXCLUDED.parent_id`,
          [
            node.id,
            slug,
            node.parent_id,
            node.title,
            JSON.stringify(node.aliases ?? []),
            node.definition,
            node.sort_order ?? 0,
          ]
        );
      }
      console.log(`Seeded ${nodes.length} nodes for [${slug}].`);
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await closePgPool();
  }
}

runSeed().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
