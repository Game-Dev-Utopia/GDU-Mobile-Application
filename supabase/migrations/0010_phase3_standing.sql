-- Phase 3: Standing + Thresholds backend

-- ============================================================
-- Standing Config (half-life decay, window, shadow mode)
-- ============================================================

create table standing_config (
  id uuid primary key default gen_random_uuid(),
  window_days integer not null default 90,
  half_life_days integer not null default 30,
  shadow_mode boolean not null default true,
  effective_from timestamptz not null default now(),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table standing_config enable row level security;

create policy standing_config_read on standing_config
  for select using (auth.role() = 'authenticated');
create policy standing_config_manage on standing_config
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Threshold Config (position minimums per category)
-- Stored in positions.min_exp_per_category already
-- This table tracks threshold versions for shadow mode
-- ============================================================

create table threshold_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  effective_from timestamptz not null,
  shadow_mode boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table threshold_versions enable row level security;

create policy threshold_versions_read on threshold_versions
  for select using (auth.role() = 'authenticated');
create policy threshold_versions_manage on threshold_versions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Standing Computation View
-- Rolling 90-day window with half-life decay
-- Formula: EXP * (0.5 ^ (days_ago / half_life_days))
-- ============================================================

create view member_standing_view as
with config as (
  select window_days, half_life_days from standing_config
  order by effective_from desc limit 1
),
window_entries as (
  select le.member_id, le.amount, le.activity_date,
         (now()::date - le.activity_date) as days_ago
  from ledger_entries le
  cross join config
  where le.source = 'claim'
    and le.amount > 0
    and le.activity_date >= (now()::date - config.window_days)
),
decayed as (
  select member_id,
         sum(amount * (0.5 ^ (days_ago::float / half_life_days))) as standing_exp
  from window_entries
  cross join config
  group by member_id
)
select p.id as member_id,
       p.display_name,
       p.username,
       p.avatar_url,
       p.branch_id,
       p.domain_id,
       p.role,
       p.total_exp as lifetime_exp,
       coalesce(d.standing_exp, 0) as standing_exp,
       round(coalesce(d.standing_exp, 0)::numeric, 2) as standing,
       p.min_exp_total as position_min_total,
       p.min_exp_per_category as position_min_per_category
from profiles p
left join decayed d on d.member_id = p.id
where p.is_active is not false;

-- ============================================================
-- Category Standing View (per-category breakdown)
-- ============================================================

create view member_category_standing_view as
with config as (
  select window_days, half_life_days from standing_config
  order by effective_from desc limit 1
),
window_entries as (
  select le.member_id, le.category, le.amount, le.activity_date,
         (now()::date - le.activity_date) as days_ago
  from ledger_entries le
  cross join config
  where le.source = 'claim'
    and le.amount > 0
    and le.activity_date >= (now()::date - config.window_days)
),
decayed as (
  select member_id, category,
         sum(amount * (0.5 ^ (days_ago::float / half_life_days))) as standing_exp
  from window_entries
  cross join config
  group by member_id, category
)
select p.id as member_id,
       d.category,
       round(coalesce(d.standing_exp, 0)::numeric, 2) as standing,
       (p.min_exp_per_category ->> d.category)::int as position_min
from profiles p
cross join lateral (
  select unnest(array[
    'technology_innovation_wisdom',
    'motivation_initiative_learning_mindset',
    'social_soft_skills',
    'leadership_management'
  ]) as category
) cats
left join decayed d on d.member_id = p.id and d.category = cats.category
where p.is_active is not false;

-- ============================================================
-- Threshold Violations (shadow mode tracking)
-- ============================================================

create table threshold_violations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  category text,
  standing_value numeric not null,
  threshold_value integer not null,
  is_violation boolean not null,
  shadow_mode boolean not null default true,
  detected_at timestamptz default now(),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table threshold_violations enable row level security;

create policy threshold_violations_read on threshold_violations
  for select using (auth.role() = 'authenticated');
create policy threshold_violations_manage on threshold_violations
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Function: compute_all_standings — recalculate standings
-- ============================================================

create function compute_all_standings() returns void as $$
declare
  v_shadow boolean;
begin
  select shadow_mode into v_shadow from standing_config order by effective_from desc limit 1;

  -- Clear previous violations for this run
  delete from threshold_violations where shadow_mode = v_shadow and resolved_at is null;

  -- Insert new violations based on current standing
  insert into threshold_violations (member_id, category, standing_value, threshold_value, shadow_mode)
  select msv.member_id,
         mcs.category,
         mcs.standing,
         mcs.position_min,
         v_shadow
  from member_standing_view msv
  join member_category_standing_view mcs on mcs.member_id = msv.member_id
  where mcs.position_min is not null
    and mcs.standing < mcs.position_min;

  -- Also check total standing
  insert into threshold_violations (member_id, category, standing_value, threshold_value, shadow_mode)
  select msv.member_id,
         'overall',
         msv.standing,
         msv.position_min_total,
         v_shadow
  from member_standing_view msv
  where msv.position_min_total is not null
    and msv.position_min_total > 0
    and msv.standing < msv.position_min_total;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: get_member_standing — get standing for a member
-- ============================================================

create function get_member_standing(p_member_id uuid) returns record as $$
declare
  v_result record;
begin
  select * into v_result
  from member_standing_view
  where member_id = p_member_id;

  return v_result;
end $$ language plpgsql security definer;
