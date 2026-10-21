// Migration runner for the GDU XP System.
//
// The Supabase CLI and psql are not available in this environment, so
// migrations are applied directly over the Postgres connection string.
//
//   node scripts/run-migrations.mjs            # apply every pending migration
//   node scripts/run-migrations.mjs --status   # show applied/pending only
//   node scripts/run-migrations.mjs 0019       # apply a single migration
//
// Each migration runs in its own transaction and is recorded in
// public.schema_migrations so it is never applied twice.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const migrationsDir = join(projectRoot, 'supabase', 'migrations');

function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    let raw;
    try {
      raw = readFileSync(join(projectRoot, file), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

function versionOf(file) {
  const m = file.match(/^(\d+)/);
  return m ? m[1] : null;
}

async function main() {
  const args = process.argv.slice(2);
  const statusOnly = args.includes('--status');
  const only = args.find((a) => /^\d+$/.test(a));

  const env = loadEnv();
  const cs = env.SUPABASE_TRANSACTION_CONNECTION_STRING;
  if (!cs) {
    console.error('SUPABASE_TRANSACTION_CONNECTION_STRING is not set in .env');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedRes = await client.query('select version from public.schema_migrations');
  const applied = new Set(appliedRes.rows.map((r) => r.version));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const migrations = files.map((f) => ({ file: f, version: versionOf(f) })).filter((m) => m.version);

  const pending = migrations.filter((m) => !applied.has(m.file));

  console.log(`Applied: ${applied.size}  Pending: ${pending.length}`);
  for (const m of migrations) {
    const state = applied.has(m.file) ? 'applied' : 'PENDING';
    console.log(`  ${m.version.padStart(4)}  ${state.padEnd(8)}  ${m.file}`);
  }

  if (statusOnly) {
    await client.end();
    return;
  }

  const toApply = only
    ? pending.filter((m) => m.version === only.padStart(4, '0') || m.version === only)
    : pending;

  if (toApply.length === 0) {
    console.log('\nNothing to apply.');
    await client.end();
    return;
  }

  for (const m of toApply) {
    const sql = readFileSync(join(migrationsDir, m.file), 'utf8');
    console.log(`\nApplying ${m.file} ...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'insert into public.schema_migrations (version) values ($1) on conflict (version) do nothing',
        [m.file]
      );
      await client.query('COMMIT');
      console.log(`  ok ${m.file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAILED ${m.file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  const after = await client.query('select count(*)::int as n from public.schema_migrations');
  console.log(`\nDone. schema_migrations now has ${after.rows[0].n} rows.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
