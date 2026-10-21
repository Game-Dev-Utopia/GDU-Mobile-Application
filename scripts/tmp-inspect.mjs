// Phase 8.3 admin console verification.
//
// Applies the migration, then exercises the new RPCs as an authenticated
// admin, checking that config publishing syncs the runtime tables, that
// feature flags propagate, that role grants and revocations are recorded in
// the history, and that the audit log captures everything.
//
// State is read back inside the same savepoint that made the change, since
// rolling back to a savepoint also undoes the change under test.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = {};
for (const line of readFileSync(process.env.ENV_PATH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const client = new pg.Client({
  connectionString: env.SUPABASE_TRANSACTION_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
client.on('notice', (n) => console.log('NOTICE:', n.message));

let sp = 0;
async function asUser(profileId, fn) {
  const name = `sp_${sp++}`;
  await client.query(`SAVEPOINT ${name}`);
  await client.query('set local role authenticated');
  await client.query(
    `set local request.jwt.claims = '${JSON.stringify({
      sub: profileId,
      role: 'authenticated',
    }).replace(/'/g, "''")}'`
  );
  try {
    return await fn();
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }
}

await client.query('BEGIN');
await client.query(readFileSync(process.env.MIGRATION_PATH, 'utf8'));
console.log('=== migration applied ===\n');

for (const t of ['motion_config', 'standing_config', 'threshold_versions', 'branch_health_config', 'league_tiers', 'feature_flags', 'config_versions']) {
  const n = await client.query(`select count(*)::int as n from public."${t}"`);
  console.log(`  ${t}: ${n.rows[0].n} row(s)`);
}
const lt = await client.query('select name, min_exp, max_exp, sort_order from public.league_tiers order by sort_order');
console.log('\nleague ladder:');
for (const r of lt.rows) console.log(`  ${r.sort_order}. ${r.name.padEnd(9)} ${r.min_exp} – ${r.max_exp ?? '∞'}`);

const mkUser = async (username) => {
  const u = await client.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                             email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
             'authenticated', $1, crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now())
     returning id`,
    [`${username}@test.local`]
  );
  return u.rows[0].id;
};
const mkProfile = async (userId, username) => {
  await client.query(
    `insert into profiles (id, username, display_name, role, onboarding_complete, total_exp)
     values ($1, $2, $2, 'member', true, 0)`,
    [userId, username]
  );
};
const adminUser = await mkUser('admin_probe');
const memberUser = await mkUser('member_probe');
const auditorUser = await mkUser('auditor_probe');
await mkProfile(adminUser, 'admin_probe');
await mkProfile(memberUser, 'member_probe');
await mkProfile(auditorUser, 'auditor_probe');
await client.query(
  `insert into role_assignments (profile_id, role, scope, is_active) values ($1, 'admin', 'org', true)`,
  [adminUser]
);
await client.query(
  `insert into role_assignments (profile_id, role, scope, is_active) values ($1, 'auditor', 'org', true)`,
  [auditorUser]
);

const cfg = await client.query('select config from public.config_versions limit 1');
const base = cfg.rows[0].config;

console.log('\n=== publish a config version (effective now) ===');
const nowVersion = { ...base, quorum: { ...base.quorum, board: 4 }, caps: { ...base.caps, season_exp_cap: 7500 } };
console.log(
  '  ',
  await asUser(adminUser, async () => {
    const r = await client.query(
      `select public.publish_admin_config_version('v2', now(), $1::jsonb, 'Raise board quorum') as id`,
      [JSON.stringify(nowVersion)]
    );
    const m = await client.query(
      'select board_quorum, effective_from <= now() as is_effective from public.motion_config order by effective_from desc limit 1'
    );
    return `published ${r.rows[0].id}; motion_config.board_quorum = ${m.rows[0].board_quorum} (effective: ${m.rows[0].is_effective})`;
  })
);

console.log('\n=== publish a scheduled (future) version ===');
console.log(
  '  ',
  await asUser(adminUser, async () => {
    const future = { ...base, quorum: { ...base.quorum, board: 9 } };
    await client.query(
      `select public.publish_admin_config_version('v3', now() + interval '7 days', $1::jsonb, 'Scheduled')`,
      [JSON.stringify(future)]
    );
    const m = await client.query(
      'select board_quorum, effective_from <= now() as is_effective from public.motion_config order by effective_from desc limit 1'
    );
    const eff = await client.query(
      'select board_quorum from public.motion_config where effective_from <= now() order by effective_from desc limit 1'
    );
    return `latest row quorum=${m.rows[0].board_quorum} (effective: ${m.rows[0].is_effective}); in-force quorum=${eff.rows[0].board_quorum}`;
  })
);

console.log('\n=== validation ===');
const invalidShares = await asUser(adminUser, async () => {
  try {
    const bad = { ...base, class_shares: { technical: 90, social: 5, soft: 5, management: 5 } };
    await client.query(`select public.publish_admin_config_version('vBad', now(), $1::jsonb, 'bad')`, [JSON.stringify(bad)]);
    return 'ACCEPTED (bug)';
  } catch (e) {
    return e.message;
  }
});
console.log('  class shares not summing to 100 ->', invalidShares);

const missingSection = await asUser(adminUser, async () => {
  try {
    const bad = { ...base };
    delete bad.caps;
    await client.query(`select public.publish_admin_config_version('vBad2', now(), $1::jsonb, 'bad')`, [JSON.stringify(bad)]);
    return 'ACCEPTED (bug)';
  } catch (e) {
    return e.message;
  }
});
console.log('  missing section ->', missingSection);

const nonAdmin = await asUser(memberUser, async () => {
  try {
    await client.query(`select public.publish_admin_config_version('v9', now(), $1::jsonb, 'nope')`, [JSON.stringify(base)]);
    return 'ACCEPTED (bug)';
  } catch (e) {
    return e.message;
  }
});
console.log('  non-admin publish ->', nonAdmin);

console.log('\n=== feature flags ===');
console.log(
  '  ',
  await asUser(adminUser, async () => {
    const r = await client.query(`select public.set_feature_flag('standing_enforcement', 'live', 'Enforce from this term') as msg`);
    const f = await client.query("select mode from public.feature_flags where key='standing_enforcement'");
    const s = await client.query('select shadow_mode from public.standing_config order by effective_from desc limit 1');
    return `${r.rows[0].msg}; flag=${f.rows[0].mode}; standing_config.shadow_mode=${s.rows[0].shadow_mode}`;
  })
);
const flagDenied = await asUser(memberUser, async () => {
  try {
    await client.query(`select public.set_feature_flag('cash', 'live', 'nope')`);
    return 'ACCEPTED (bug)';
  } catch (e) {
    return e.message;
  }
});
console.log('  non-admin flag change ->', flagDenied);

console.log('\n=== role assignment history ===');
const roleResult = await asUser(adminUser, async () => {
  const g = await client.query(
    `select public.grant_role($1, 'domain_head', 'domain', null, null, 'Promoted to domain head') as id`,
    [memberUser]
  );
  const hist = await client.query(
    'select action, role, scope, reason from public.role_assignment_history where profile_id = $1 order by changed_at, id',
    [memberUser]
  );
  const rev = await client.query(`select public.revoke_role($1, 'Stepped down') as msg`, [g.rows[0].id]);
  const hist2 = await client.query(
    'select action, role, reason from public.role_assignment_history where profile_id = $1 order by changed_at, id',
    [memberUser]
  );
  return {
    grant: g.rows[0].id,
    afterGrant: hist.rows.map((h) => `${h.action}:${h.role}/${h.scope}(${h.reason ?? '—'})`),
    revoke: rev.rows[0].msg,
    afterRevoke: hist2.rows.map((h) => `${h.action}:${h.role}/${h.scope}(${h.reason ?? '—'})`),
  };
});
console.log('  granted:', roleResult.grant);
console.log('  history after grant:', roleResult.afterGrant.join(' | '));
console.log('  revoke:', roleResult.revoke);
console.log('  history after revoke:', roleResult.afterRevoke.join(' | '));

console.log('\n=== audit log ===');
const audit = await asUser(adminUser, async () => {
  const r = await client.query('select action, table_name from public.audit_log order by created_at');
  return r.rows.map((a) => `${a.action}->${a.table_name}`);
});
console.log('  entries:', audit.join(' | '));
const auditorSees = await asUser(auditorUser, async () => {
  const r = await client.query('select count(*)::int as n from public.audit_log');
  return r.rows[0].n;
});
console.log('  auditor sees', auditorSees, 'audit rows');
const memberSees = await asUser(memberUser, async () => {
  const r = await client.query('select count(*)::int as n from public.audit_log');
  return r.rows[0].n;
});
console.log('  plain member sees', memberSees, 'audit rows (expected 0)');
const auditorRoles = await asUser(auditorUser, async () => {
  const r = await client.query('select count(*)::int as n from public.role_assignment_history');
  return r.rows[0].n;
});
console.log('  auditor sees', auditorRoles, 'role history rows');
const adminConfig = await asUser(adminUser, async () => {
  const r = await client.query('select count(*)::int as n from public.config_versions where config is not null');
  return r.rows[0].n;
});
console.log('  admin sees', adminConfig, 'config versions');
const memberConfig = await asUser(memberUser, async () => {
  const r = await client.query('select count(*)::int as n from public.config_versions where config is not null');
  return r.rows[0].n;
});
console.log('  plain member sees', memberConfig, 'config versions (read is open, write is not)');

await client.query('ROLLBACK');
console.log('\nrolled back');
await client.end();
