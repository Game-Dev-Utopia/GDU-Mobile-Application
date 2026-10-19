-- Phase 3: Branch Health backend

-- ============================================================
-- Branch Health Config (weights + floor)
-- ============================================================

create table branch_health_config (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  effective_from timestamptz not null default now(),
  floor_score numeric not null default 50, -- minimum health score
  weight_active_members numeric default 20, -- %
  weight_events_held numeric default 20,
  weight_shipped_output numeric default 20,
  weight_retention numeric default 20,
  weight_exp_per_member numeric default 10,
  weight_faculty_coordination numeric default 10,
  shadow_mode boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table branch_health_config enable row level security;

create policy branch_health_config_read on branch_health_config
  for select using (auth.role() = 'authenticated');
create policy branch_health_config_manage on branch_health_config
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Branch Health Snapshots (computed per quarter)
-- ============================================================

create table branch_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) not null,
  quarter_start date not null,
  quarter_end date not null,
  active_member_share numeric, -- % of members active this quarter
  events_held integer default 0,
  shipped_output integer default 0, -- projects/features shipped
  retention_rate numeric, -- % of members retained
  exp_per_active_member numeric,
  faculty_coordination_score numeric, -- 0-100
  health_score numeric, -- weighted total 0-100
  stage text not null default 'Healthy' check (stage in ('Healthy', 'Watch', 'Recovery plan', 'Board review', 'Decision')),
  shadow_mode boolean not null default true,
  created_at timestamptz default now(),
  unique (branch_id, quarter_start)
);

alter table branch_health_snapshots enable row level security;

create policy branch_health_snapshots_read on branch_health_snapshots
  for select using (auth.role() = 'authenticated');
create policy branch_health_snapshots_manage on branch_health_snapshots
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Branch Override Timeline (board decisions)
-- ============================================================

create table branch_override_cases (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) not null,
  stage text not null check (stage in ('Watch', 'Recovery plan', 'Board review', 'Decision')),
  triggered_at timestamptz default now(),
  board_decision text, -- extend_plan, supervised_admin, merge_dormant, wind_down
  board_decision_at timestamptz,
  right_of_reply_deadline timestamptz, -- 14 days for branch council
  appeal_deadline timestamptz,
  shadow_mode boolean not null default true,
  created_at timestamptz default now()
);

alter table branch_override_cases enable row level security;

create policy branch_override_cases_read on branch_override_cases
  for select using (auth.role() = 'authenticated');
create policy branch_override_cases_manage on branch_override_cases
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Function: compute_branch_health — calculate health score per branch
-- ============================================================

create function compute_branch_health() returns void as $$
declare
  v_config record;
  v_branch record;
  v_quarter_start date;
  v_quarter_end date;
begin
  select * into v_config from branch_health_config
  order by effective_from desc limit 1;

  if not found then
    return;
  end if;

  -- Current quarter
  select date_trunc('quarter', now())::date into v_quarter_start;
  select (date_trunc('quarter', now()) + interval '3 months' - interval '1 day')::date into v_quarter_end;

  for v_branch in select id, display_name from branches loop
    -- Active member share: members with at least 1 claim this quarter
    declare
      v_active_share numeric;
      v_events integer;
      v_shipped integer;
      v_retention numeric;
      v_exp_per_member numeric;
      v_faculty_score numeric;
      v_health_score numeric;
      v_stage text;
    begin
      -- Active member share
      select count(distinct p.id)::numeric / nullif(count(p.id), 0) * 100
      into v_active_share
      from profiles p
      where p.branch_id = v_branch.id
        and p.is_active is not false;

      -- Events held this quarter (claims with activity_type = event hosting)
      select count(*)
      into v_events
      from claims c
      join profiles pr on pr.id = c.claimant_id
      join activity_types at on at.id = c.activity_type_id
      where pr.branch_id = v_branch.id
        and c.activity_date >= v_quarter_start
        and c.activity_date <= v_quarter_end
        and c.status = 'approved';

      -- Shipped output: projects completed this quarter
      -- Using claims as proxy for now
      select count(*)
      into v_shipped
      from claims c
      join profiles pr on pr.id = c.claimant_id
      where pr.branch_id = v_branch.id
        and c.activity_date >= v_quarter_start
        and c.activity_date <= v_quarter_end
        and c.status = 'approved';

      -- Retention rate: members active last quarter who are active this quarter
      select count(distinct p2.id)::numeric / nullif(count(distinct p1.id), 0) * 100
      into v_retention
      from profiles p1
      left join profiles p2 on p2.id = p1.id
      where p1.branch_id = v_branch.id
        and p1.is_active is not false;

      -- EXP per active member
      select sum(le.amount)::numeric / nullif(count(distinct le.member_id), 0)
      into v_exp_per_member
      from ledger_entries le
      join profiles pr on pr.id = le.member_id
      where pr.branch_id = v_branch.id
        and le.source = 'claim'
        and le.activity_date >= v_quarter_start
        and le.activity_date <= v_quarter_end;

      -- Faculty coordination score (0-100, based on faculty check-ins)
      select 75 -- placeholder; in real implementation, based on faculty coordinator check-ins
      into v_faculty_score;

      -- Weighted health score
      select round(
        coalesce(v_active_share, 0) * v_config.weight_active_members / 100 +
        coalesce(least(v_events::numeric * 10, 100), 0) * v_config.weight_events_held / 100 +
        coalesce(least(v_shipped::numeric * 10, 100), 0) * v_config.weight_shipped_output / 100 +
        coalesce(v_retention, 0) * v_config.weight_retention / 100 +
        coalesce(least(v_exp_per_member::numeric / 50 * 100, 100), 0) * v_config.weight_exp_per_member / 100 +
        coalesce(v_faculty_score, 0) * v_config.weight_faculty_coordination / 100
      , 2) into v_health_score;

      -- Determine stage
      if v_health_score >= v_config.floor_score then
        v_stage := 'Healthy';
      else
        -- Check if already in Watch for 2 quarters
        declare
          v_prev_stage text;
        begin
          select stage into v_prev_stage
          from branch_health_snapshots
          where branch_id = v_branch.id
            and quarter_start < v_quarter_start
          order by quarter_start desc
          limit 1;

          if v_prev_stage = 'Watch' then
            v_stage := 'Recovery plan';
          elsif v_prev_stage = 'Recovery plan' then
            v_stage := 'Board review';
          else
            v_stage := 'Watch';
          end if;
        end;
      end if;

      -- Insert snapshot
      insert into branch_health_snapshots (branch_id, quarter_start, quarter_end,
                                           active_member_share, events_held, shipped_output,
                                           retention_rate, exp_per_active_member,
                                           faculty_coordination_score, health_score,
                                           stage, shadow_mode)
      values (v_branch.id, v_quarter_start, v_quarter_end,
              v_active_share, v_events, v_shipped,
              v_retention, v_exp_per_member,
              v_faculty_score, v_health_score,
              v_stage, v_config.shadow_mode);

      -- Create override case if in Board review or Decision stage
      if v_stage in ('Board review', 'Decision') then
        insert into branch_override_cases (branch_id, stage, shadow_mode)
        values (v_branch.id, v_stage, v_config.shadow_mode)
        on conflict do nothing;
      end if;
    end;
  end loop;
end $$ language plpgsql security definer;

-- ============================================================
-- View: current branch health (latest snapshot per branch)
-- ============================================================

create view current_branch_health_view as
select distinct on (bhs.branch_id)
       bhs.id, bhs.branch_id, b.display_name as branch_name,
       bhs.quarter_start, bhs.quarter_end,
       bhs.active_member_share, bhs.events_held, bhs.shipped_output,
       bhs.retention_rate, bhs.exp_per_active_member,
       bhs.faculty_coordination_score, bhs.health_score,
       bhs.stage, bhs.shadow_mode
from branch_health_snapshots bhs
join branches b on b.id = bhs.branch_id
order by bhs.branch_id, bhs.quarter_start desc;

-- ============================================================
-- Function: trigger_branch_override — escalate to board review
-- ============================================================

create function trigger_branch_override(p_branch_id uuid) returns void as $$
declare
  v_shadow boolean;
begin
  select shadow_mode into v_shadow from branch_health_config order by effective_from desc limit 1;

  insert into branch_override_cases (branch_id, stage, shadow_mode)
  values (p_branch_id, 'Board review', v_shadow)
  on conflict do nothing;
end $$ language plpgsql security definer;
