-- Phase 9.2: Integrations and Import
--
-- 1. `integrations` — connected providers (GitHub, Discord, social) with a
--    connected/not-connected state and a note on what is ingested (mock for now).
-- 2. `import_jobs` — CSV import job tracking (pending / completed / failed).
-- 3. `claims.imported` — flag so imported entries are tagged in history.
-- 4. RPCs: `toggle_integration` and `import_csv_claims` (validates rows, creates
--    claims + ledger entries + audit_log entries tagged 'claim.imported').

-- ============================================================
-- 1. Integrations
-- ============================================================

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('github', 'discord', 'social')),
  connected boolean not null default false,
  connected_at timestamptz,
  connected_by uuid references profiles(id),
  config jsonb default '{}',
  last_sync_at timestamptz,
  ingested_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);

-- Seed the three integration cards as disconnected by default.
insert into integrations (provider, connected, ingested_summary) values
  ('github', false, 'Pull request merges, issue closes and review activity.'),
  ('discord', false, 'Message reactions, event attendance and voice hours.'),
  ('social', false, 'Public repo stars, shares and community mentions.')
on conflict (provider) do nothing;

alter table integrations enable row level security;

drop policy if exists integrations_read on integrations;
create policy integrations_read on integrations
  for select using (auth.role() = 'authenticated');

drop policy if exists integrations_manage on integrations;
create policy integrations_manage on integrations
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

create or replace function public.toggle_integration(
  p_provider text,
  p_connected boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from integrations where provider = p_provider) then
    insert into integrations (provider, connected, connected_by, connected_at)
    values (p_provider, p_connected,
            case when p_connected then auth.uid() else null end,
            case when p_connected then now() else null end);
  else
    update integrations
    set connected = p_connected,
        connected_by = case when p_connected then auth.uid() else connected_by end,
        connected_at = case when p_connected then now() else connected_at end,
        updated_at = now()
    where provider = p_provider;
  end if;

  return p_provider || ' ' || case when p_connected then 'connected' else 'disconnected' end;
end;
$$;

-- ============================================================
-- 2. Import jobs
-- ============================================================

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  row_count integer not null default 0,
  imported_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists import_jobs_created_by_idx on import_jobs (created_by);
create index if not exists import_jobs_created_at_idx on import_jobs (created_at desc);

alter table import_jobs enable row level security;

drop policy if exists import_jobs_read on import_jobs;
create policy import_jobs_read on import_jobs
  for select using (
    public.has_role(array['board', 'board_member', 'admin'])
  );

drop policy if exists import_jobs_manage on import_jobs;
create policy import_jobs_manage on import_jobs
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

-- ============================================================
-- 3. Tag imported claims in history
-- ============================================================

alter table claims add column if not exists imported boolean default false;

create index if not exists claims_imported_idx on claims (imported);

-- ============================================================
-- 4. Bulk import RPC
-- ============================================================

create or replace function public.import_csv_claims(
  p_job_id uuid,
  p_claims jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_imported integer := 0;
  v_errors text[] := '{}';
  v_config uuid;
  v_member uuid;
  v_activity uuid;
  v_exp_min integer;
  v_exp_max integer;
  v_category text;
  v_exp integer;
  v_claim_id uuid;
  elem jsonb;
  r record;
begin
  select id into v_config from config_versions order by effective_from desc limit 1;

  for r in select * from jsonb_array_elements(p_claims) as t(elem) loop
    select id into v_member
    from profiles
    where username = r.elem->>'member' or display_name = r.elem->>'member'
    limit 1;
    if v_member is null then
      v_errors := v_errors || ('Member not found: ' || coalesce(r.elem->>'member', ''));
      continue;
    end if;

    select id, exp_min, exp_max, category
    into v_activity, v_exp_min, v_exp_max, v_category
    from activity_types
    where name = r.elem->>'activity' and is_active
    limit 1;
    if v_activity is null then
      v_errors := v_errors || ('Activity not found: ' || coalesce(r.elem->>'activity', ''));
      continue;
    end if;

    v_exp := (r.elem->>'exp')::int;
    if v_exp is null or v_exp < v_exp_min or v_exp > v_exp_max then
      v_errors := v_errors || ('Invalid EXP for ' || coalesce(r.elem->>'member', '') || ': ' || coalesce(r.elem->>'exp', ''));
      continue;
    end if;

    if (r.elem->>'date') is null then
      v_errors := v_errors || ('Missing date for ' || coalesce(r.elem->>'member', ''));
      continue;
    end if;

    insert into claims (
      claimant_id, activity_type_id, title, description, activity_date,
      evidence_links, suggested_exp, analysis_pointers, config_version_id,
      status, reviewer_id, reviewed_score, reviewed_at, imported
    ) values (
      v_member, v_activity, 'Imported: ' || r.elem->>'activity', 'Imported via CSV admin wizard',
      (r.elem->>'date')::date, '{}', v_exp, 'Imported via CSV admin wizard', v_config,
      'approved', auth.uid(), v_exp, now(), true
    ) returning id into v_claim_id;

    insert into ledger_entries (member_id, amount, category, source, activity_date, config_version_id)
    values (v_member, v_exp, v_category, 'import', (r.elem->>'date')::date, v_config);

    insert into audit_log (actor_id, action, table_name, record_id, new_values)
    values (
      auth.uid(), 'claim.imported', 'claims', v_claim_id,
      jsonb_build_object(
        'member_id', v_member,
        'activity', r.elem->>'activity',
        'exp', v_exp,
        'source', 'csv_import'
      )
    );

    v_imported := v_imported + 1;
  end loop;

  update import_jobs
  set status = 'completed',
      imported_count = v_imported,
      error_count = coalesce(array_length(v_errors, 1), 0),
      completed_at = now()
  where id = p_job_id;

  return jsonb_build_object('imported', v_imported, 'errors', v_errors);
end;
$$;
