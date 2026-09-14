import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_ID = process.env['CLOUDBASE_ENV_ID'] ?? 'hackerson-d0g0z55d2fc446485';

function executeSql(sql: string) {
  // Use tcb db execute which handles splitting and escaping
  const res = execSync(`npx tcb db execute -e ${ENV_ID} --json`, {
    input: sql,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return res;
}

async function runCloudMigrations() {
  console.log(`🚀 Starting Cloud Migrations for env: ${ENV_ID}...`);

  const migrationsDir = path.resolve(__dirname, '../server/migrations');
  const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of sqlFiles) {
    console.log(`\n[Migration] Applying ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      execSync(`npx tcb db execute -e ${ENV_ID} --sql ${JSON.stringify(sql)}`, {
        stdio: 'inherit',
      });
      console.log(`✅ [Migration] ${file} applied successfully.`);
    } catch (err: any) {
      console.error(`❌ [Migration] Failed to apply ${file}:`, err.message);
      process.exit(1);
    }
  }

  // Seed disciplines
  console.log('\n🌱 Seeding disciplines into Cloud PostgreSQL...');
  const disciplinesDir = path.resolve(__dirname, '../disciplines');
  const indexData = JSON.parse(fs.readFileSync(path.join(disciplinesDir, 'index.json'), 'utf-8'));

  let fullSeedSql = '';

  for (const item of indexData) {
    const { slug, name, major } = item;
    console.log(`Preparing seed for discipline: [${slug}] ${name}...`);

    fullSeedSql += `
INSERT INTO disciplines (slug, name, major, origin)
VALUES ('${slug}', '${name}', '${major}', 'preset')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, major = EXCLUDED.major;
`;

    const discFilePath = path.join(disciplinesDir, `${slug}.json`);
    if (!fs.existsSync(discFilePath)) continue;

    const discData = JSON.parse(fs.readFileSync(discFilePath, 'utf-8'));
    const nodes = discData.nodes ?? [];

    for (const node of nodes) {
      const aliasesJson = JSON.stringify(node.aliases ?? []).replace(/'/g, "''");
      const title = (node.title ?? '').replace(/'/g, "''");
      const def = (node.definition ?? '').replace(/'/g, "''");
      const parentVal = node.parent_id ? `'${node.parent_id}'` : 'NULL';

      fullSeedSql += `
INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('${node.id}', '${slug}', ${parentVal}, '${title}', '${aliasesJson}'::jsonb, '${def}', ${node.sort_order ?? 0})
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;
`;
    }
  }

  const seedFile = path.resolve(__dirname, '../scratch/seed.sql');
  fs.writeFileSync(seedFile, fullSeedSql, 'utf-8');
  console.log(`Wrote ${fullSeedSql.length} bytes of seed SQL to ${seedFile}`);

  // Execute in transactions
  const lines = fullSeedSql.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('--'));
  // Execute via tcb db execute
  fs.writeFileSync(seedFile, `BEGIN;\n${fullSeedSql}\nCOMMIT;\n`, 'utf-8');
  execSync(`npx tcb db execute -e ${ENV_ID} --sql "$(cat ${seedFile})"`, {
    stdio: 'inherit',
    shell: '/bin/bash',
  });
  console.log('✅ All disciplines and nodes seeded successfully.');

  console.log('\n🎉 All cloud migrations and seeds completed successfully!');
}

runCloudMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
