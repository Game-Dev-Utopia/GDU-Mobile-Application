import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const env = {};
for (const line of readFileSync(process.env.ENV_PATH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const referenced = new Set();
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  const re = /\.from\(\s*['"]([a-zA-Z_0-9]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) referenced.add(m[1]);
}

const client = new pg.Client({
  connectionString: env.SUPABASE_TRANSACTION_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const t = await client.query("select table_name from information_schema.tables where table_schema='public'");
const v = await client.query("select table_name from information_schema.views where table_schema='public'");
const b = await client.query('select id from storage.buckets');
const known = new Set([
  ...t.rows.map((r) => r.table_name),
  ...v.rows.map((r) => r.table_name),
  ...b.rows.map((r) => r.id),
]);

const missing = [...referenced].filter((r) => !known.has(r)).sort();
console.log(`tables: ${t.rows.length} | views: ${v.rows.length} | buckets: ${b.rows.length}`);
console.log(`referenced: ${referenced.size} | MISSING: ${missing.length ? missing.join(', ') : '(none)'}`);

const mig = await client.query('select count(*)::int as n from public.schema_migrations');
console.log('migrations applied:', mig.rows[0].n);

await client.end();
