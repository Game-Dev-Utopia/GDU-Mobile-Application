-- Phase 8.3: Admin console
--
-- 1. `config_versions` becomes the versioned admin configuration: weights,
--    caps, thresholds, class shares, quorum and league sizes, each version
--    carrying an effective-from date.
-- 2. `feature_flags` holds the Shadow / Live switch for standing
--    enforcement, pink-slip, branch override and cash.
-- 3. `role_assignment_history` records every grant, change and revocation.
-- 4. An Audit Log viewer for Auditor and Admin (policy widened to `auditor`).
--
-- Publishing a config version also syncs the runtime tables the database
-- functions already read (motion_config, standing_config, threshold_versions,
-- branch_health_config, league_tiers) so there is a single source of truth.

-- ============================================================
-- 1. Versioned config
-- ============================================================

alter table config_versions
  add column if not exists config jsonb,
  add column if not exists notes text;

create index if not exists config_versions_effective_from_idx
  on config_versions (effective_from desc);

create unique index if not exists config_versions_label_key
  on config_versions (version_label);

-- The config payload must carry every section the console manages.
create or replace function public.validate_admin_config(p_config jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_section text;
  v_sum numeric;
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Config must be a JSON object';
  end if;

  foreach v_section in array array['weights','caps','thresholds','class_shares','quorum','league_sizes'] loop
    if not (p_config ? v_section) then
      raise exception 'Config is missing the required section: %', v_section;
    end if;
  end loop;

  -- Chamber weights must add up to 100.
  v_sum := coalesce((p_config->'weights'->>'board')::numeric, 0)
         + coalesce((p_config->'weights'->>'council')::numeric, 0)
         + coalesce((p_config->'weights'->>'member')::numeric, 0);
  if v_sum <> 100 then
    raise exception 'Chamber weights must sum to 100 (got %)', v_sum;
  end if;

  -- EXP class shares must add up to 100.
  v_sum := coalesce((p_config->'class_shares'->>'technical')::numeric, 0)
         + coalesce((p_config->'class_shares'->>'social')::numeric, 0)
         + coalesce((p_config->'class_shares'->>'soft')::numeric, 0)
         + coalesce((p_config->'class_shares'->>'management')::numeric, 0);
  if v_sum <> 100 then
    raise exception 'EXP class shares must sum to 100 (got %)', v_sum;
  end if;

  -- Motion thresholds are percentages.
  foreach v_section in array array['ordinary','serious','constitutional','recall'] loop
    if (p_config->'thresholds'->>v_section) is null then
      raise exception 'Threshold % is missing', v_section;
    end if;
    if (p_config->'thresholds'->>v_section)::numeric < 0
       or (p_config->'thresholds'->>v_section)::numeric > 100 then
      raise exception 'Threshold % must be between 0 and 100', v_section;
    end if;
  end loop;

  -- Quorum.
  if coalesce((p_config->'quorum'->>'board')::int, 0) < 1 then
    raise exception 'Board quorum must be at least 1';
  end if;
  if coalesce((p_config->'quorum'->>'council_percent')::numeric, 0) <= 0
     or (p_config->'quorum'->>'council_percent')::numeric > 100 then
    raise exception 'Council quorum percent must be between 0 and 100';
  end if;

  -- League ladder.
  if jsonb_typeof(p_config->'league_sizes') <> 'array'
     or jsonb_array_length(p_config->'league_sizes') = 0 then
    raise exception 'At least one league size is required';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_config->'league_sizes') x
    where x->>'name' is null or x->>'min_exp' is null
  ) then
    raise exception 'Every league size needs a name and a min_exp';
  end if;
end;
$$;

-- The config version that is in force right now.
create or replace function public.effective_admin_config()
returns jsonb
language sql
stable
as $$
  select c.config
  from public.config_versions c
  where c.config is not null
    and c.effective_from <= now()
  order by c.effective_from desc, c.created_at desc
  limit 1;
$$;

-- Copy a published config into the runtime tables the database functions read.
create or replace function public.sync_admin_config_to_runtime(
  p_version_label text,
  p_effective_from timestamptz,
  p_config jsonb,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motion_shadow boolean;
  v_standing_shadow boolean;
  v_pink_slip_shadow boolean;
  v_branch_shadow boolean;
begin
  select (mode = 'shadow') into v_standing_shadow
  from public.feature_flags where key = 'standing_enforcement';

  select (mode = 'shadow') into v_pink_slip_shadow
  from public.feature_flags where key = 'pink_slip';

  select (mode = 'shadow') into v_branch_shadow
  from public.feature_flags where key = 'branch_override';

  select shadow_mode into v_motion_shadow
  from public.motion_config order by effective_from desc limit 1;
  v_motion_shadow := coalesce(v_motion_shadow, true);

  -- Motion weights, quorum and thresholds.
  insert into public.motion_config (
    version_label, effective_from, board_weight, council_weight, member_weight,
    board_quorum, council_quorum_percent, ordinary_threshold, serious_threshold,
    constitutional_threshold, recall_threshold, recall_board_concurrence,
    shadow_mode, created_by
  ) values (
    p_version_label, p_effective_from,
    (p_config->'weights'->>'board')::numeric,
    (p_config->'weights'->>'council')::numeric,
    (p_config->'weights'->>'member')::numeric,
    (p_config->'quorum'->>'board')::int,
    (p_config->'quorum'->>'council_percent')::numeric,
    (p_config->'thresholds'->>'ordinary')::numeric,
    (p_config->'thresholds'->>'serious')::numeric,
    (p_config->'thresholds'->>'constitutional')::numeric,
    (p_config->'thresholds'->>'recall')::numeric,
    (p_config->'quorum'->>'recall_board_concurrence')::int,
    v_motion_shadow, p_actor
  );

  -- Standing window and half life.
  insert into public.standing_config (
    window_days, half_life_days, shadow_mode, effective_from, created_by
  ) values (
    (p_config->'thresholds'->>'standing_window_days')::int,
    (p_config->'thresholds'->>'standing_half_life_days')::int,
    coalesce(v_standing_shadow, true),
    p_effective_from, p_actor
  );

  -- Pink-slip threshold version marker.
  insert into public.threshold_versions (
    version_label, effective_from, shadow_mode, created_by
  ) values (
    p_version_label, p_effective_from,
    coalesce(v_pink_slip_shadow, true), p_actor
  );

  -- Branch health weights and floor.
  insert into public.branch_health_config (
    version_label, effective_from, floor_score,
    weight_active_members, weight_events_held, weight_shipped_output,
    weight_retention, weight_exp_per_member, weight_faculty_coordination,
    shadow_mode, created_by
  ) values (
    p_version_label, p_effective_from,
    coalesce((p_config->'thresholds'->>'branch_health_floor')::numeric, 40),
    (p_config->'weights'->'branch_health'->>'active_members')::numeric,
    (p_config->'weights'->'branch_health'->>'events_held')::numeric,
    (p_config->'weights'->'branch_health'->>'shipped_output')::numeric,
    (p_config->'weights'->'branch_health'->>'retention')::numeric,
    (p_config->'weights'->'branch_health'->>'exp_per_member')::numeric,
    (p_config->'weights'->'branch_health'->>'faculty_coordination')::numeric,
    coalesce(v_branch_shadow, true), p_actor
  );

  -- League ladder.
  delete from public.league_tiers;
  insert into public.league_tiers (
    name, display_name, min_exp, max_exp, color, sort_order, is_locked
  )
  select
    lower(x->>'name'),
    x->>'display_name',
    (x->>'min_exp')::int,
    nullif(x->>'max_exp', '')::int,
    coalesce(x->>'color', '#64748b'),
    (x->>'sort_order')::int,
    coalesce((x->>'is_locked')::boolean, false)
  from jsonb_array_elements(p_config->'league_sizes') x;
end;
$$;

-- Publish a new configuration version.
create or replace function public.publish_admin_config_version(
  p_version_label text,
  p_effective_from timestamptz,
  p_config jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.has_role(array['board', 'board_member', 'admin']) then
    raise exception 'Insufficient permissions to publish an admin config version';
  end if;

  if p_version_label is null or btrim(p_version_label) = '' then
    raise exception 'A version label is required';
  end if;

  if exists (
    select 1 from public.config_versions where version_label = btrim(p_version_label)
  ) then
    raise exception 'A config version labelled % already exists', btrim(p_version_label);
  end if;

  perform public.validate_admin_config(p_config);

  insert into public.config_versions (version_label, effective_from, config, notes, created_by)
  values (btrim(p_version_label), p_effective_from, p_config, p_notes, auth.uid())
  returning id into v_id;

  perform public.sync_admin_config_to_runtime(
    btrim(p_version_label), p_effective_from, p_config, auth.uid()
  );

  insert into public.audit_log (actor_id, action, table_name, record_id, new_values)
  values (
    auth.uid(), 'config.version_published', 'config_versions', v_id,
    jsonb_build_object(
      'version_label', btrim(p_version_label),
      'effective_from', p_effective_from,
      'notes', p_notes
    )
  );

  return v_id;
end;
$$;

-- ============================================================
-- 2. Feature flags
-- ============================================================

create table if not exists feature_flags (
  key text primary key,
  mode text not null check (mode in ('shadow', 'live')),
  description text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into feature_flags (key, mode, description) values
  ('standing_enforcement', 'shadow', 'Standing decay and threshold enforcement for members.'),
  ('pink_slip',            'shadow', 'Pink-slip issuance when a member falls below the standing threshold.'),
  ('branch_override',      'shadow', 'Board override of a branch health outcome.'),
  ('cash',                 'shadow', 'Cash release tracking, approval and settlement.')
on conflict (key) do nothing;

-- Read a flag from application code.
create or replace function public.feature_flag_mode(p_key text)
returns text
language sql
stable
as $$
  select f.mode from public.feature_flags f where f.key = p_key;
$$;

create or replace function public.set_feature_flag(
  p_key text,
  p_mode text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_found boolean;
begin
  if not public.has_role(array['board', 'board_member', 'admin']) then
    raise exception 'Insufficient permissions to change feature flags';
  end if;

  if p_mode not in ('shadow', 'live') then
    raise exception 'Invalid feature flag mode: % (expected shadow or live)', p_mode;
  end if;

  update public.feature_flags
  set mode = p_mode, updated_by = auth.uid(), updated_at = now()
  where key = p_key
  returning true into v_found;

  if not v_found then
    raise exception 'Unknown feature flag: %', p_key;
  end if;

  -- Keep the runtime shadow columns in step with the flag.
  if p_key = 'standing_enforcement' then
    update public.standing_config set shadow_mode = (p_mode = 'shadow');
  elsif p_key = 'pink_slip' then
    update public.threshold_versions set shadow_mode = (p_mode = 'shadow');
  elsif p_key = 'branch_override' then
    update public.branch_health_config set shadow_mode = (p_mode = 'shadow');
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, new_values)
  values (
    auth.uid(), 'flag.updated', 'feature_flags', null,
    jsonb_build_object('key', p_key, 'mode', p_mode, 'reason', p_reason)
  );

  return p_key || ' set to ' || p_mode;
end;
$$;

-- ============================================================
-- 3. Role assignment history
-- ============================================================

create table if not exists role_assignment_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  role text not null,
  scope text not null,
  scope_entity_id uuid,
  action text not null check (action in ('granted', 'revoked', 'expired', 'updated')),
  reason text,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb
);

create index if not exists role_assignment_history_profile_idx
  on role_assignment_history (profile_id, changed_at desc);
create index if not exists role_assignment_history_changed_at_idx
  on role_assignment_history (changed_at desc);

-- Every change to role_assignments is recorded. The reason is passed through a
-- transaction-local setting so the grant/revoke entry points can annotate the
-- row the trigger writes.
create or replace function public.log_role_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := nullif(current_setting('app.role_change_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.role_assignment_history (
      profile_id, role, scope, scope_entity_id, action, reason, changed_by, expires_at
    ) values (
      new.profile_id, new.role, new.scope, new.scope_entity_id, 'granted', v_reason, auth.uid(), new.expires_at
    );
  elsif tg_op = 'DELETE' then
    insert into public.role_assignment_history (
      profile_id, role, scope, scope_entity_id, action, reason, changed_by, expires_at
    ) values (
      old.profile_id, old.role, old.scope, old.scope_entity_id, 'revoked', v_reason, auth.uid(), old.expires_at
    );
  elsif tg_op = 'UPDATE' then
    if new.is_active is distinct from old.is_active then
      insert into public.role_assignment_history (
        profile_id, role, scope, scope_entity_id, action, reason, changed_by, expires_at
      ) values (
        new.profile_id, new.role, new.scope, new.scope_entity_id,
        case when new.is_active then 'granted' else 'revoked' end,
        v_reason, auth.uid(), new.expires_at
      );
    elsif new.role is distinct from old.role
      or new.scope is distinct from old.scope
      or new.expires_at is distinct from old.expires_at then
      insert into public.role_assignment_history (
        profile_id, role, scope, scope_entity_id, action, reason, changed_by, expires_at
      ) values (
        new.profile_id, new.role, new.scope, new.scope_entity_id, 'updated', v_reason, auth.uid(), new.expires_at
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists role_assignment_history_trigger on role_assignments;
create trigger role_assignment_history_trigger
after insert or update or delete on role_assignments
for each row execute function public.log_role_assignment_change();

create or replace function public.grant_role(
  p_profile_id uuid,
  p_role text,
  p_scope text,
  p_scope_entity_id uuid default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.has_role(array['board', 'board_member', 'admin']) then
    raise exception 'Insufficient permissions to grant roles';
  end if;

  if p_scope not in ('self', 'team', 'domain', 'branch', 'org') then
    raise exception 'Invalid scope: %', p_scope;
  end if;

  perform set_config('app.role_change_reason', coalesce(p_reason, ''), true);

  insert into public.role_assignments (
    profile_id, role, scope, scope_entity_id, granted_by, expires_at, is_active
  ) values (
    p_profile_id, p_role, p_scope, p_scope_entity_id, auth.uid(), p_expires_at, true
  )
  on conflict (profile_id, role, scope, scope_entity_id)
  do update set
    is_active = true,
    expires_at = excluded.expires_at,
    granted_by = auth.uid(),
    granted_at = now()
  returning id into v_id;

  insert into public.audit_log (actor_id, action, table_name, record_id, new_values)
  values (
    auth.uid(), 'role.granted', 'role_assignments', v_id,
    jsonb_build_object(
      'profile_id', p_profile_id, 'role', p_role, 'scope', p_scope,
      'scope_entity_id', p_scope_entity_id, 'expires_at', p_expires_at, 'reason', p_reason
    )
  );

  return v_id;
end;
$$;

create or replace function public.revoke_role(
  p_role_assignment_id uuid,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ra record;
begin
  if not public.has_role(array['board', 'board_member', 'admin']) then
    raise exception 'Insufficient permissions to revoke roles';
  end if;

  select * into v_ra from public.role_assignments where id = p_role_assignment_id;
  if not found then
    raise exception 'Role assignment not found';
  end if;

  perform set_config('app.role_change_reason', coalesce(p_reason, ''), true);

  update public.role_assignments
  set is_active = false, expires_at = coalesce(expires_at, now())
  where id = p_role_assignment_id;

  insert into public.audit_log (actor_id, action, table_name, record_id, new_values)
  values (
    auth.uid(), 'role.revoked', 'role_assignments', p_role_assignment_id,
    jsonb_build_object(
      'profile_id', v_ra.profile_id, 'role', v_ra.role, 'scope', v_ra.scope, 'reason', p_reason
    )
  );

  return 'Role revoked';
end;
$$;

-- ============================================================
-- 4. Runtime config readers honour the effective-from date
--
-- Every versioned config table is read with "order by effective_from desc
-- limit 1", so a version scheduled for a future date would take effect
-- immediately. Each reader now only considers versions that are in force.
-- ============================================================

do $$
declare
  r record;
  v_src text;
  v_new_src text;
  v_count integer := 0;
  c_pattern constant text :=
    'from[[:space:]]+(motion_config|standing_config|branch_health_config|config_versions|threshold_versions)([[:space:]]*)order by effective_from desc';
begin
  for r in
    select p.oid, p.prosrc, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ~ 'from[[:space:]]+(motion_config|standing_config|branch_health_config|config_versions|threshold_versions)[[:space:]]*order by effective_from desc'
  loop
    v_src := r.prosrc;
    v_new_src := regexp_replace(
      v_src, c_pattern,
      'from \1\2where effective_from <= now()\2order by effective_from desc', 'g'
    );

    if v_new_src is distinct from v_src then
      execute replace(r.def, r.prosrc, v_new_src);
      v_count := v_count + 1;
    end if;
  end loop;

  raise notice 'Updated % runtime config readers to honour effective_from', v_count;
end;
$$;

-- ============================================================
-- 5. Row level security
-- ============================================================

-- config_versions: readable by any signed-in member, writable by admins.
drop policy if exists config_versions_manage on config_versions;
create policy config_versions_manage on config_versions
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

alter table feature_flags enable row level security;

drop policy if exists feature_flags_read on feature_flags;
create policy feature_flags_read on feature_flags
  for select using (auth.role() = 'authenticated');

drop policy if exists feature_flags_manage on feature_flags;
create policy feature_flags_manage on feature_flags
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

alter table role_assignment_history enable row level security;

drop policy if exists role_assignment_history_read on role_assignment_history;
create policy role_assignment_history_read on role_assignment_history
  for select using (
    public.has_role(array['board', 'board_member', 'admin', 'auditor'])
  );

-- The Audit Log viewer is available to Auditor and Admin.
drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log
  for select using (
    public.has_role(array['board', 'board_member', 'admin', 'auditor'])
  );

drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log
  for insert with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

-- ============================================================
-- 6. Seed the first config version
-- ============================================================

-- The top tier has no upper bound, which assign_league_tier already allows.
alter table league_tiers alter column max_exp drop not null;

insert into public.config_versions (version_label, effective_from, config, notes)
select
  'v1',
  now(),
  $$
  {
    "weights": {
      "board": 40,
      "council": 35,
      "member": 25,
      "branch_health": {
        "active_members": 25,
        "events_held": 20,
        "shipped_output": 25,
        "retention": 15,
        "exp_per_member": 10,
        "faculty_coordination": 5
      }
    },
    "caps": {
      "season_exp_cap": 5000,
      "max_claims_per_day": 5,
      "max_claim_exp": 500
    },
    "thresholds": {
      "ordinary": 50,
      "serious": 66.67,
      "constitutional": 66.67,
      "recall": 66.67,
      "standing_window_days": 90,
      "standing_half_life_days": 45,
      "pink_slip_value": 40,
      "branch_health_floor": 40
    },
    "class_shares": {
      "technical": 40,
      "social": 20,
      "soft": 20,
      "management": 20
    },
    "quorum": {
      "board": 3,
      "council_percent": 50,
      "recall_board_concurrence": 2
    },
    "league_sizes": [
      { "name": "bronze",   "display_name": "Bronze",   "min_exp": 0,     "max_exp": 999,   "color": "#b45309", "sort_order": 1, "is_locked": false },
      { "name": "silver",   "display_name": "Silver",   "min_exp": 1000,  "max_exp": 2499,  "color": "#94a3b8", "sort_order": 2, "is_locked": false },
      { "name": "gold",     "display_name": "Gold",     "min_exp": 2500,  "max_exp": 4999,  "color": "#ca8a04", "sort_order": 3, "is_locked": false },
      { "name": "platinum", "display_name": "Platinum", "min_exp": 5000,  "max_exp": 9999,  "color": "#7dd3fc", "sort_order": 4, "is_locked": false },
      { "name": "emerald",  "display_name": "Emerald",  "min_exp": 10000, "max_exp": 19999, "color": "#34d399", "sort_order": 5, "is_locked": false },
      { "name": "diamond",  "display_name": "Diamond",  "min_exp": 20000, "max_exp": null,  "color": "#a78bfa", "sort_order": 6, "is_locked": true }
    ]
  }
  $$::jsonb,
  'Initial admin console configuration.'
where not exists (select 1 from public.config_versions where config is not null);

-- Bring the runtime tables in line with the seeded version.
do $$
declare
  v_version record;
begin
  select * into v_version
  from public.config_versions
  where config is not null
  order by effective_from desc, created_at desc
  limit 1;

  if found then
    perform public.sync_admin_config_to_runtime(
      v_version.version_label, v_version.effective_from, v_version.config, null
    );
  end if;
end;
$$;

-- The league ladder now exists, so align the profile default with it.
alter table profiles alter column league_tier set default 'bronze';
update profiles set league_tier = 'bronze' where league_tier is null or league_tier = 'obsidian';
