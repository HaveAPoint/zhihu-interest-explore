const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../disciplines');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
let sql = '-- Seed preset disciplines and global nodes\n';

for (const d of index) {
  const name = d.name.replace(/'/g, "''");
  const major = d.major.replace(/'/g, "''");
  sql += `INSERT INTO disciplines (slug, name, major, origin) VALUES ('${d.slug}', '${name}', '${major}', 'preset') ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, major = EXCLUDED.major;\n`;

  const nodePath = path.join(dir, `${d.slug}.json`);
  if (!fs.existsSync(nodePath)) continue;
  const data = JSON.parse(fs.readFileSync(nodePath, 'utf8'));
  for (const n of data.nodes || []) {
    const parentVal = n.parent_id ? `'${n.parent_id}'` : 'NULL';
    const title = (n.title || '').replace(/'/g, "''");
    const def = (n.definition || '').replace(/'/g, "''");
    const aliases = JSON.stringify(n.aliases || []).replace(/'/g, "''");
    const sort = n.sort_order || 0;
    sql += `INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order) VALUES ('${n.id}', '${d.slug}', ${parentVal}, '${title}', '${aliases}'::jsonb, '${def}', ${sort}) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;\n`;
  }
}

const outFile = path.join(__dirname, '../cloudbase/migrations/20260914000004_seed_data.sql');
fs.writeFileSync(outFile, sql, 'utf8');
console.log('Wrote seed SQL:', sql.length, 'bytes to', outFile);
