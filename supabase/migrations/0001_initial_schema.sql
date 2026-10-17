-- Enable extensions
create extension if not exists pgcrypto;

-- ============================================================
-- Core tables
-- ============================================================

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  created_at timestamptz default now()
);

create table domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  branch_id uuid references branches(id),
  created_at timestamptz default now()
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null,
  min_exp_total integer default 0,
  min_exp_per_category jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- Profiles (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id uuid references auth.users(id) primary key,
  discord_id text unique,
  username text not null,
  display_name text not null,
  avatar_url text,
  branch_id uuid references branches(id),
  domain_id uuid references domains(id),
  role text not null default 'member',
  onboarding_complete boolean default false,
  total_exp integer default 0,
  level integer default 1,
  league_tier text default 'obsidian',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Activity Types (rubric)
-- ============================================================

create table activity_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'technology_innovation_wisdom',
    'motivation_initiative_learning_mindset',
    'social_soft_skills',
    'leadership_management'
  )),
  domain_id uuid references domains(id),
  exp_min integer not null,
  exp_max integer not null,
  season_cap integer,
  difficulty integer default 3 check (difficulty between 1 and 5),
  evidence_required boolean default true,
  approvers_needed integer default 1 check (approvers_needed in (1, 2, 3)),
  description text,
  submission_format text,
  requirements text[] default '{}',
  tags text[] default '{}',
  posted_by text,
  is_active boolean default true,
  config_version_id uuid references config_versions(id),
  created_at timestamptz default now()
);

-- ============================================================
-- Claims
-- ============================================================

create table claims (
  id uuid primary key default gen_random_uuid(),
  claimant_id uuid references profiles(id) not null,
  activity_type_id uuid references activity_types(id) not null,
  title text not null,
  description text,
  activity_date date not null,
  evidence_links text[] default '{}',
  suggested_exp integer not null,
  analysis_pointers text not null,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected')),
  reviewer_id uuid references profiles(id),
  reviewed_at timestamptz,
  reviewed_score integer,
  review_reason text,
  config_version_id uuid references config_versions(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Split Agreements
-- ============================================================

create table split_agreements (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) not null,
  member_id uuid references profiles(id) not null,
  share_percent integer not null check (share_percent between 0 and 100),
  cosigned boolean default false,
  cosigned_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- Ledger Entries (append-only)
-- ============================================================

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id),
  member_id uuid references profiles(id) not null,
  amount integer not null,
  category text not null,
  source text not null default 'claim',
  activity_date date not null,
  config_version_id uuid references config_versions(id),
  created_at timestamptz default now()
);

-- ============================================================
-- Audit Log
-- ============================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- Config Versions
-- ============================================================

create table config_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  effective_from timestamptz not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- Approver Budgets (monthly)
-- ============================================================

create table approver_budgets (
  id uuid primary key default gen_random_uuid(),
  approver_id uuid references profiles(id) not null,
  month date not null,
  budget_cents integer default 0,
  spent_cents integer default 0,
  created_at timestamptz default now(),
  unique (approver_id, month)
);

-- ============================================================
-- League Tiers (bandwidths like Duolingo)
-- ============================================================

create table league_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  min_exp integer not null,
  max_exp integer not null,
  color text not null,
  sort_order integer not null,
  is_locked boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS: enable on all tables
-- ============================================================

alter table profiles enable row level security;
alter table branches enable row level security;
alter table domains enable row level security;
alter table positions enable row level security;
alter table activity_types enable row level security;
alter table claims enable row level security;
alter table split_agreements enable row level security;
alter table ledger_entries enable row level security;
alter table audit_log enable row level security;
alter table config_versions enable row level security;
alter table approver_budgets enable row level security;
alter table league_tiers enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Profiles: users read own; domain heads/team leads read domain members; board reads all
create policy profiles_own on profiles
  for select using (auth.uid() = id);
create policy profiles_domain_read on profiles
  for select using (
    exists (select 1 from profiles p2 where p2.id = auth.uid()
      and p2.domain_id = profiles.domain_id
      and p2.role in ('domain_head', 'team_lead', 'board', 'admin'))
  );
create policy profiles_board_read on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- Profiles: insert during signup via auth trigger; update own
create policy profiles_insert on profiles
  for insert with check (auth.uid() = id);
create policy profiles_update_own on profiles
  for update using (auth.uid() = id);

-- Branches/Domains/Positions/ActivityTypes/LeagueTiers: read by all authenticated
create policy branches_read on branches for select using (auth.role() = 'authenticated');
create policy domains_read on domains for select using (auth.role() = 'authenticated');
create policy positions_read on positions for select using (auth.role() = 'authenticated');
create policy activity_types_read on activity_types for select using (auth.role() = 'authenticated');
create policy league_tiers_read on league_tiers for select using (auth.role() = 'authenticated');

-- Claims: claimant reads own; domain head reads domain claims; board/admin reads all
create policy claims_claimant_read on claims for select using (auth.uid() = claimant_id);
create policy claims_domain_head_read on claims for select using (
  exists (select 1 from profiles p where p.id = auth.uid()
    and p.domain_id = (select domain_id from profiles where id = claimant_id)
    and p.role in ('domain_head', 'team_lead', 'board', 'admin'))
);
create policy claims_board_read on claims for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
);

-- Split Agreements: read by claimant and domain head
create policy splits_read on split_agreements for select using (
  auth.uid() in (select claimant_id from claims where id = claim_id)
  or exists (select 1 from profiles p where p.id = auth.uid()
    and p.domain_id = (select domain_id from profiles where id = claimant_id)
    and p.role in ('domain_head', 'team_lead', 'board', 'admin'))
);

-- Ledger Entries: read by all authenticated
create policy ledger_read on ledger_entries for select using (auth.role() = 'authenticated');

-- Audit Log: only board/admin
create policy audit_log_read on audit_log for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
);

-- Config Versions: read by all
create policy config_versions_read on config_versions for select using (auth.role() = 'authenticated');

-- Approver Budgets: read by the approver themselves
create policy approver_budgets_read on approver_budgets for select using (auth.uid() = approver_id);

-- ============================================================
-- Triggers: append-only ledger
-- ============================================================

create function block_ledger_changes() returns trigger as $$
begin
  raise exception 'ledger_entries is append-only';
end $$ language plpgsql;

create trigger ledger_no_update
  before update or delete on ledger_entries
  for each row execute function block_ledger_changes();

-- ============================================================
-- Triggers: auto-create profile on auth signup
-- ============================================================

create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, role, onboarding_complete)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'display_name', 'member', false);
  return new;
end $$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Views
-- ============================================================

create view my_ledger_view as
select le.id, le.amount, le.category, le.source, le.activity_date,
       at.name as activity_name, c.title as claim_title,
       le.created_at
from ledger_entries le
left join claims c on c.id = le.claim_id
left join activity_types at on at.id = c.activity_type_id
where le.member_id = auth.uid();

create view season_leaderboard_view as
select p.id as member_id, p.display_name, p.username, p.avatar_url,
       sum(le.amount) as season_exp,
       p.branch_id, p.domain_id, p.league_tier
from profiles p
join ledger_entries le on le.member_id = p.id
where le.source = 'claim'
  and le.activity_date >= (select max(activity_date) from ledger_entries) - interval '14 days'
group by p.id, p.display_name, p.username, p.avatar_url, p.branch_id, p.domain_id, p.league_tier
order by season_exp desc;

-- ============================================================
-- SQL Functions
-- ============================================================

create function submit_claim(
  p_activity_type_id uuid,
  p_title text,
  p_description text,
  p_activity_date date,
  p_evidence_links text[],
  p_suggested_exp integer,
  p_analysis_pointers text,
  p_contributors jsonb
) returns uuid as $$
declare
  v_claim_id uuid;
  v_at record;
  v_share_sum integer := 0;
begin
  select * into v_at from activity_types where id = p_activity_type_id;

  if not found then
    raise exception 'Activity type not found';
  end if;

  if p_suggested_exp < v_at.exp_min or p_suggested_exp > v_at.exp_max then
    raise exception 'Suggested EXP % outside range [%-%]', p_suggested_exp, v_at.exp_min, v_at.exp_max;
  end if;

  select sum((elem->>'share_percent')::int) into v_share_sum
  from jsonb_array_elements(p_contributors) as elem;

  if v_share_sum <> 100 then
    raise exception 'Contributor shares must total 100, got %', v_share_sum;
  end if;

  insert into claims (claimant_id, activity_type_id, title, description, activity_date,
                      evidence_links, suggested_exp, analysis_pointers, config_version_id)
  values (auth.uid(), p_activity_type_id, p_title, p_description, p_activity_date,
          p_evidence_links, p_suggested_exp, p_analysis_pointers,
          (select id from config_versions order by effective_from desc limit 1))
  returning id into v_claim_id;

  for v_member in select elem->>'member_id' as member_id, (elem->>'share_percent')::int as share_percent
                  from jsonb_array_elements(p_contributors) as elem
  loop
    insert into split_agreements (claim_id, member_id, share_percent)
    values (v_claim_id, v_member.member_id::uuid, v_member.share_percent);
  end loop;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'claim.submitted', 'claims', v_claim_id,
          jsonb_build_object('suggested_exp', p_suggested_exp, 'status', 'submitted'));

  return v_claim_id;
end $$ language plpgsql security definer;

create function review_claim(
  p_claim_id uuid,
  p_score integer,
  p_reason text
) returns text as $$
declare
  v_claim record;
  v_reviewer record;
begin
  select c.*, p.domain_id as claimant_domain_id into v_claim
  from claims c
  join profiles p on p.id = c.claimant_id
  where c.id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  select * into v_reviewer from profiles where id = auth.uid();

  if v_reviewer.domain_id is distinct from v_claim.claimant_domain_id
     or v_reviewer.role not in ('domain_head', 'team_lead', 'board', 'admin') then
    raise exception 'Only domain heads and above can review claims in their domain';
  end if;

  if auth.uid() = v_claim.claimant_id then
    raise exception 'Cannot review your own claim';
  end if;

  if exists (select 1 from split_agreements where claim_id = p_claim_id and member_id = auth.uid()) then
    raise exception 'Cannot review a claim you are a contributor to';
  end if;

  select exp_min, exp_max into v_claim.exp_min, v_claim.exp_max
  from activity_types where id = v_claim.activity_type_id;

  if p_score < v_claim.exp_min or p_score > v_claim.exp_max then
    raise exception 'Score % outside range [%-%]', p_score, v_claim.exp_min, v_claim.exp_max;
  end if;

  update claims
  set status = 'under_review', reviewer_id = auth.uid(), reviewed_at = now(),
      reviewed_score = p_score, review_reason = p_reason
  where id = p_claim_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'claim.reviewed', 'claims', p_claim_id,
          jsonb_build_object('score', p_score, 'reason', p_reason));

  return 'Review submitted.';
end $$ language plpgsql security definer;

create function finalize_claim(p_claim_id uuid) returns void as $$
declare
  v_claim record;
  v_config uuid;
begin
  select * into v_claim from claims where id = p_claim_id;

  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'under_review' then raise exception 'Claim not ready for finalization'; end if;

  select id into v_config from config_versions order by effective_from desc limit 1;

  for v_member in select sa.member_id, sa.share_percent from split_agreements sa where sa.claim_id = p_claim_id
  loop
    insert into ledger_entries (member_id, amount, category, source, activity_date, config_version_id)
    values (v_member.member_id,
            (v_claim.reviewed_score * v_member.share_percent / 100),
            (select category from activity_types where id = v_claim.activity_type_id),
            'claim', v_claim.activity_date, v_config);
  end loop;

  update claims set status = 'approved' where id = p_claim_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'claim.finalized', 'claims', p_claim_id,
          jsonb_build_object('final_score', v_claim.reviewed_score));
end $$ language plpgsql security definer;

create function reverse_entry(p_ledger_entry_id uuid, p_reason text) returns void as $$
declare
  v_entry record;
begin
  select * into v_entry from ledger_entries where id = p_ledger_entry_id;

  if not found then raise exception 'Ledger entry not found'; end if;

  if not exists (select 1 from profiles where id = auth.uid() and role in ('board', 'faculty', 'admin')) then
    raise exception 'Insufficient permissions to reverse ledger entry';
  end if;

  insert into ledger_entries (member_id, amount, category, source, activity_date, config_version_id)
  values (v_entry.member_id, -v_entry.amount, v_entry.category, 'reversal', now(),
          (select id from config_versions order by effective_from desc limit 1));

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'ledger.reversed', 'ledger_entries', p_ledger_entry_id,
          jsonb_build_object('reason', p_reason, 'reversed_amount', v_entry.amount));
end $$ language plpgsql security definer;

create function list_my_review_queue() returns setof claims as $$
begin
  return query
  select c.*
  from claims c
  join profiles p on p.id = c.claimant_id
  join profiles r on r.id = auth.uid()
  where c.status = 'submitted'
    and p.domain_id = r.domain_id
    and r.role in ('domain_head', 'team_lead', 'board', 'admin')
    and c.claimant_id <> auth.uid()
    and not exists (select 1 from split_agreements sa where sa.claim_id = c.id and sa.member_id = auth.uid())
  order by c.created_at asc;
end $$ language plpgsql security definer;
