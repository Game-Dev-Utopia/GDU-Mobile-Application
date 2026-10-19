-- Patch A: RBAC tables
-- Patch B1: Activity taxonomy (category → subcategory → activity, kind "increment")
-- Patch B2: Activity kind "decrement" (penalty) + penalty workflow tables

-- ============================================================
-- Activity Subcategories (category → subcategory → activity)
-- Categories: technical, social, soft, management
-- ============================================================

create table activity_subcategories (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'technical',
    'social',
    'soft',
    'management'
  )),
  name text not null,
  display_name text not null,
  description text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (category, name)
);

-- Update activity_types to reference subcategory and add kind
alter table activity_types
  add column subcategory_id uuid references activity_subcategories(id);

alter table activity_types
  add column kind text not null default 'increment' check (kind in ('increment', 'decrement'));

-- ============================================================
-- Role Assignments (user can hold multiple roles with scopes)
-- ============================================================

create table role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  role text not null,
  scope text not null check (scope in ('self', 'team', 'domain', 'branch', 'org')),
  scope_entity_id uuid, -- references branches/domains/teams depending on scope
  granted_by uuid references profiles(id),
  granted_at timestamptz default now(),
  expires_at timestamptz,
  is_active boolean default true,
  unique (profile_id, role, scope, scope_entity_id)
);

alter table role_assignments enable row level security;

create policy role_assignments_own on role_assignments
  for select using (auth.uid() = profile_id);
create policy role_assignments_manage on role_assignments
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'board_member'))
  );

-- ============================================================
-- Position Assignments (position held by member in a scope)
-- ============================================================

create table position_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  position_id uuid references positions(id) not null,
  scope_entity_id uuid, -- branch_id, domain_id, or team_id
  scope_type text not null check (scope_type in ('branch', 'domain', 'team')),
  started_at date not null,
  ended_at date,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (profile_id, position_id, scope_entity_id, scope_type)
);

alter table position_assignments enable row level security;

create policy position_assignments_read on position_assignments
  for select using (auth.role() = 'authenticated');
create policy position_assignments_manage on position_assignments
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'board_member'))
  );

-- ============================================================
-- Seed activity subcategories
-- ============================================================

insert into activity_subcategories (category, name, display_name, description, sort_order) values
-- ============================================================
-- TECHNICAL
-- ============================================================
('technical', 'game_dev', 'Game Dev', 'Game creation, prototyping, jams', 1),
('technical', 'design_art', 'Design & Art', 'Art/animation assets, UI/UX design, 3D models, video/trailers', 2),
('technical', 'ai_rd', 'AI & R&D', 'AI/ML prototypes, research, experiments, AI tools', 3),
('technical', 'web_devops', 'Web & DevOps', 'Website features, deployment/CI-CD, security fixes', 4),
('technical', 'open_source', 'Open Source', 'PRs merged, code reviews, documentation', 5),

-- ============================================================
-- SOCIAL
-- ============================================================
('social', 'content', 'Content', 'Social posts, blogs/articles, videos/reels, courses/tutorials, impressions', 1),
('social', 'growth', 'Growth', 'Referrals (vested), campus outreach, cross-community collab', 2),
('social', 'funding_partnerships', 'Funding & Partnerships', 'Sponsorship/funding secured, partner/MoU brought', 3),

-- ============================================================
-- SOFT
-- ============================================================
('soft', 'communication', 'Communication', 'Host/emcee, talks/speaking, Discord moderation, external event representation', 1),
('soft', 'mentoring', 'Mentoring', 'Mentor newcomers, onboarding buddy, peer help', 2),
('soft', 'participation', 'Participation', 'Attend sessions/meetings, give feedback, vote in motions', 3),
('soft', 'culture', 'Culture', 'Verified ethics reports, conflict resolution', 4),

-- ============================================================
-- MANAGEMENT
-- ============================================================
('management', 'projects', 'Projects', 'Project lead, PM, milestone delivered, release shipped', 1),
('management', 'events_ops', 'Events & Ops', 'Organise events/bootcamps, volunteering, logistics, college coordination', 2),
('management', 'governance', 'Governance', 'Serving positions, proposals, interviews, process docs, finance/compliance admin', 3),
('management', 'faculty', 'Faculty', 'Students mobilised, bootcamps hosted, teams provided, branch check-ins', 4);

-- ============================================================
-- Seed activity types (kind = increment, with realistic EXP ranges and caps)
-- ============================================================

-- TECHNICAL → Game Dev
insert into activity_types (name, category, subcategory_id, kind, exp_min, exp_max, season_cap, difficulty, evidence_required, approvers_needed, description, tags, is_active) values
('Ship a Game / Prototype', 'technical', null, 'increment', 200, 500, 3, 4, true, 2, 'Publish a complete game or working prototype', ARRAY['game', 'ship', 'prototype'], true),
('Jam Submission', 'technical', null, 'increment', 100, 200, 5, 3, true, 1, 'Submit to a game jam', ARRAY['game', 'jam', 'submission'], true),
('Jam Win', 'technical', null, 'increment', 300, 500, 2, 5, true, 2, 'Win or place in a game jam', ARRAY['game', 'jam', 'win'], true),
('Feature Implemented', 'technical', null, 'increment', 150, 300, 5, 3, true, 1, 'Implement a feature in a game project', ARRAY['game', 'feature'], true),
('Bug Fix / QA', 'technical', null, 'increment', 50, 100, 10, 2, true, 1, 'Fix bugs or perform QA testing', ARRAY['game', 'bug', 'qa'], true),
('Playtest Feedback', 'technical', null, 'increment', 25, 50, 10, 1, false, 1, 'Provide playtest feedback on a game', ARRAY['game', 'playtest', 'feedback'], true),
('Release Tool / Plugin / Asset Pack', 'technical', null, 'increment', 100, 300, 4, 3, true, 1, 'Release a reusable tool, plugin, or asset pack', ARRAY['game', 'tool', 'plugin', 'asset'], true),

-- TECHNICAL → Design & Art
('Art / Animation Assets', 'technical', null, 'increment', 100, 250, 5, 3, true, 1, 'Create art or animation assets', ARRAY['art', 'animation', 'design'], true),
('UI / UX Design', 'technical', null, 'increment', 100, 250, 5, 3, true, 1, 'Design user interfaces or user experiences', ARRAY['ui', 'ux', 'design'], true),
('3D Model', 'technical', null, 'increment', 150, 300, 4, 4, true, 1, 'Create a 3D model', ARRAY['3d', 'model', 'design'], true),
('Video Edit / Trailer', 'technical', null, 'increment', 100, 250, 5, 3, true, 1, 'Edit video or create a trailer', ARRAY['video', 'edit', 'trailer'], true),

-- TECHNICAL → AI & R&D
('Research Report', 'technical', null, 'increment', 150, 300, 4, 4, true, 1, 'Write a research report on AI/ML topics', ARRAY['ai', 'research', 'report'], true),
('Prototype / Experiment', 'technical', null, 'increment', 200, 400, 4, 4, true, 1, 'Build an AI prototype or run an experiment', ARRAY['ai', 'prototype', 'experiment'], true),
('AI Tool Built', 'technical', null, 'increment', 300, 500, 3, 5, true, 2, 'Build an AI-powered tool', ARRAY['ai', 'tool', 'built'], true),

-- TECHNICAL → Web & DevOps
('Website Feature', 'technical', null, 'increment', 150, 300, 5, 3, true, 1, 'Implement a website feature', ARRAY['web', 'feature'], true),
('Deployment / CI-CD', 'technical', null, 'increment', 200, 350, 4, 4, true, 1, 'Set up deployment or CI/CD pipeline', ARRAY['web', 'devops', 'ci-cd'], true),
('Security Fix', 'technical', null, 'increment', 100, 200, 5, 4, true, 1, 'Fix a security vulnerability', ARRAY['web', 'security', 'fix'], true),

-- TECHNICAL → Open Source
('PR Merged', 'technical', null, 'increment', 50, 150, 10, 3, true, 1, 'Have a pull request merged', ARRAY['open-source', 'pr', 'code'], true),
('Code Review', 'technical', null, 'increment', 25, 75, 10, 2, false, 1, 'Review code in an open source project', ARRAY['open-source', 'review', 'code'], true),
('Documentation', 'technical', null, 'increment', 50, 150, 8, 2, true, 1, 'Write or improve documentation', ARRAY['open-source', 'docs'], true),

-- SOCIAL → Content
('Social Post', 'social', null, 'increment', 25, 50, 15, 1, false, 1, 'Create a social media post', ARRAY['content', 'social'], true),
('Blog / Article', 'social', null, 'increment', 100, 200, 5, 3, true, 1, 'Write a blog post or article', ARRAY['content', 'blog', 'article'], true),
('Video / Reel', 'social', null, 'increment', 150, 300, 4, 3, true, 1, 'Create a video or reel', ARRAY['content', 'video', 'reel'], true),
('Course / Tutorial', 'social', null, 'increment', 200, 400, 3, 4, true, 1, 'Create a course or tutorial', ARRAY['content', 'course', 'tutorial'], true),
('Impressions Top-up', 'social', null, 'increment', 10, 100, 10, 1, false, 1, 'Top-up based on content impressions', ARRAY['content', 'impressions'], true),

-- SOCIAL → Growth
('Referral', 'social', null, 'increment', 200, 500, 5, 3, true, 1, 'Refer a new member (vests after 60-90 days)', ARRAY['social', 'referral', 'growth'], true),
('Campus Outreach', 'social', null, 'increment', 100, 250, 5, 3, true, 1, 'Conduct campus outreach', ARRAY['social', 'campus', 'outreach'], true),
('Cross-Community Collab', 'social', null, 'increment', 150, 300, 4, 3, true, 1, 'Collaborate with another community', ARRAY['social', 'collab', 'cross-community'], true),

-- SOCIAL → Funding & Partnerships
('Sponsorship / Funding Secured', 'social', null, 'increment', 500, 1000, 2, 5, true, 3, 'Secure sponsorship or funding', ARRAY['social', 'funding', 'sponsorship'], true),
('Partner / MoU Brought', 'social', null, 'increment', 300, 600, 3, 4, true, 2, 'Bring a partner or MoU', ARRAY['social', 'partner', 'mou'], true),

-- SOFT → Communication
('Host / Emcee', 'soft', null, 'increment', 100, 200, 5, 3, true, 1, 'Host or emcee an event', ARRAY['soft', 'communication', 'host'], true),
('Talk / Speaker', 'soft', null, 'increment', 200, 400, 4, 4, true, 1, 'Give a talk or be a speaker', ARRAY['soft', 'communication', 'speaker'], true),
('Moderate Discord', 'soft', null, 'increment', 50, 150, 10, 2, true, 1, 'Moderate the Discord server', ARRAY['soft', 'communication', 'discord'], true),
('External Event Representation', 'soft', null, 'increment', 150, 300, 5, 3, true, 1, 'Represent GDU at an external event', ARRAY['soft', 'communication', 'representation'], true),

-- SOFT → Mentoring
('Mentor a Newcomer', 'soft', null, 'increment', 200, 400, 5, 4, true, 1, 'Mentor a new member', ARRAY['soft', 'mentoring'], true),
('Onboarding Buddy', 'soft', null, 'increment', 150, 300, 5, 3, true, 1, 'Serve as an onboarding buddy', ARRAY['soft', 'mentoring', 'onboarding'], true),
('Peer Help', 'soft', null, 'increment', 25, 75, 15, 1, false, 1, 'Help a peer with a question or issue', ARRAY['soft', 'mentoring', 'peer-help'], true),

-- SOFT → Participation
('Attend Session', 'soft', null, 'increment', 25, 50, 20, 1, false, 1, 'Attend a GDU session', ARRAY['soft', 'participation', 'attend'], true),
('Attend Important Meeting', 'soft', null, 'increment', 50, 100, 10, 1, false, 1, 'Attend an important meeting', ARRAY['soft', 'participation', 'meeting'], true),
('Give Feedback', 'soft', null, 'increment', 25, 50, 10, 1, false, 1, 'Provide feedback', ARRAY['soft', 'participation', 'feedback'], true),
('Vote in a Motion', 'soft', null, 'increment', 50, 100, 5, 1, false, 1, 'Vote in a governance motion', ARRAY['soft', 'participation', 'vote'], true),

-- SOFT → Culture
('Verified Ethics Report', 'soft', null, 'increment', 100, 200, 3, 3, true, 2, 'Submit a verified ethics report', ARRAY['soft', 'culture', 'ethics'], true),
('Conflict Resolution', 'soft', null, 'increment', 200, 400, 3, 4, true, 2, 'Resolve a conflict between members', ARRAY['soft', 'culture', 'conflict'], true),

-- MANAGEMENT → Projects
('Project Lead', 'management', null, 'increment', 300, 500, 3, 4, true, 2, 'Lead a project', ARRAY['management', 'projects', 'lead'], true),
('Project Manager', 'management', null, 'increment', 400, 600, 2, 5, true, 2, 'Serve as project manager', ARRAY['management', 'projects', 'pm'], true),
('Milestone Delivered', 'management', null, 'increment', 200, 400, 5, 3, true, 1, 'Deliver a project milestone', ARRAY['management', 'projects', 'milestone'], true),
('Release Shipped', 'management', null, 'increment', 300, 500, 3, 4, true, 2, 'Ship a release', ARRAY['management', 'projects', 'release'], true),

-- MANAGEMENT → Events & Ops
('Organise Event', 'management', null, 'increment', 300, 500, 3, 4, true, 2, 'Organise an event', ARRAY['management', 'events', 'organise'], true),
('Organise Bootcamp', 'management', null, 'increment', 400, 600, 2, 5, true, 2, 'Organise a bootcamp', ARRAY['management', 'events', 'bootcamp'], true),
('Volunteering', 'management', null, 'increment', 100, 200, 5, 2, true, 1, 'Volunteer for GDU activities', ARRAY['management', 'events', 'volunteering'], true),
('Logistics', 'management', null, 'increment', 150, 300, 5, 3, true, 1, 'Handle event logistics', ARRAY['management', 'events', 'logistics'], true),
('College Coordination', 'management', null, 'increment', 200, 350, 4, 3, true, 1, 'Coordinate with college', ARRAY['management', 'events', 'college'], true),

-- MANAGEMENT → Governance
('Serving a Position (per period)', 'management', null, 'increment', 500, 800, 1, 5, true, 3, 'Serve in a position for a period', ARRAY['management', 'governance', 'position'], true),
('Community-Accepted Proposal', 'management', null, 'increment', 300, 500, 3, 4, true, 2, 'Have a proposal accepted by the community', ARRAY['management', 'governance', 'proposal'], true),
('Taking Interviews', 'management', null, 'increment', 200, 300, 5, 3, true, 1, 'Conduct interviews for positions', ARRAY['management', 'governance', 'interviews'], true),
('Process Documentation', 'management', null, 'increment', 150, 300, 5, 2, true, 1, 'Create or improve process documentation', ARRAY['management', 'governance', 'docs'], true),
('Finance / Compliance Admin', 'management', null, 'increment', 200, 400, 3, 3, true, 2, 'Handle finance or compliance administration', ARRAY['management', 'governance', 'finance', 'compliance'], true),

-- MANAGEMENT → Faculty
('Students Mobilised', 'management', null, 'increment', 300, 500, 3, 4, true, 2, 'Mobilise students for GDU activities', ARRAY['management', 'faculty', 'students'], true),
('Bootcamp Hosted', 'management', null, 'increment', 400, 600, 2, 5, true, 2, 'Host a bootcamp', ARRAY['management', 'faculty', 'bootcamp'], true),
('Teams Provided', 'management', null, 'increment', 200, 400, 3, 3, true, 1, 'Provide teams for activities', ARRAY['management', 'faculty', 'teams'], true),
('Branch Check-in', 'management', null, 'increment', 100, 200, 5, 2, true, 1, 'Perform branch check-in', ARRAY['management', 'faculty', 'check-in'], true);

-- ============================================================
-- Penalty tables (Patch B2: Decrement activities + penalty workflow)
-- ============================================================

create table penalties (
  id uuid primary key default gen_random_uuid(),
  filed_by uuid references profiles(id) not null,
  member_id uuid references profiles(id) not null,
  activity_type_id uuid references activity_types(id) not null,
  severity text not null check (severity in ('minor', 'moderate', 'severe')),
  exp_deduction integer not null,
  description text not null,
  evidence_urls text[] default '{}',
  status text not null default 'filed' check (status in ('filed', 'responded', 'reviewed', 'decided', 'appealed', 'rejected', 'upheld')),
  response_deadline timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision text,
  decision_reason text,
  appealed boolean not null default false,
  appeal_deadline timestamptz,
  appeal_reviewed_by uuid references profiles(id),
  appeal_reviewed_at timestamptz,
  appeal_decision text,
  appeal_decision_reason text,
  is_confidential boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint not_self_file check (filed_by <> member_id)
);

alter table penalties enable row level security;

create policy penalties_read on penalties
  for select using (
    auth.uid() = member_id
    or auth.uid() = filed_by
    or auth.uid() = reviewed_by
    or auth.uid() = decided_by
    or exists (select 1 from profiles where id = auth.uid() and role in ('board_member', 'admin', 'conduct_panel_member', 'auditor'))
    or (is_confidential = false and exists (select 1 from profiles where id = auth.uid() and role in ('domain_head', 'council_member', 'team_lead')))
  );
create policy penalties_insert on penalties
  for insert with check (
    auth.uid() = filed_by
    and exists (select 1 from profiles where id = auth.uid() and role in ('team_lead', 'domain_head', 'council_member', 'board_member', 'conduct_panel_member', 'faculty'))
  );
create penalties_update on penalties
  for update using (
    auth.uid() = filed_by
    or auth.uid() = member_id
    or auth.uid() = reviewed_by
    or auth.uid() = decided_by
    or exists (select 1 from profiles where id = auth.uid() and role in ('board_member', 'admin', 'conduct_panel_member', 'auditor'))
  );

create table penalty_responses (
  id uuid primary key default gen_random_uuid(),
  penalty_id uuid references penalties(id) not null,
  member_id uuid references profiles(id) not null,
  response_text text not null,
  evidence_urls text[] default '{}',
  created_at timestamptz default now()
);

alter table penalty_responses enable row level security;

create table penalty_appeals (
  id uuid primary key default gen_random_uuid(),
  penalty_id uuid references penalties(id) not null,
  member_id uuid references profiles(id) not null,
  appeal_text text not null,
  evidence_urls text[] default '{}',
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'granted', 'denied')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz default now()
);

alter table penalty_appeals enable row level security;

-- ============================================================
-- Seed decrement activities (penalties) with severity levels
-- ============================================================

insert into activity_types (name, category, subcategory_id, kind, exp_min, exp_max, season_cap, difficulty, evidence_required, approvers_needed, description, tags, is_active) values
-- MINOR penalties (Team Lead)
('Missed Commitment Without Notice', 'soft', null, 'decrement', 25, 75, null, 2, true, 1, 'Failed to meet a commitment without prior notice', ARRAY['penalty', 'minor', 'soft'], true),
('Missed Important Meeting', 'soft', null, 'decrement', 15, 50, null, 1, true, 1, 'No-show at an important scheduled meeting', ARRAY['penalty', 'minor', 'soft'], true),
('Late Deliverable', 'management', null, 'decrement', 25, 100, null, 2, true, 1, 'Delivered work past the agreed deadline', ARRAY['penalty', 'minor', 'management'], true),
('No-Show at Hosted Session', 'soft', null, 'decrement', 20, 60, null, 1, true, 1, 'Failed to attend a session they committed to host', ARRAY['penalty', 'minor', 'soft'], true),

-- MODERATE penalties (Domain Head / Council)
('Project Abandoned Without Reason', 'management', null, 'decrement', 100, 300, null, 3, true, 2, 'Abandoned a project without communication or handover', ARRAY['penalty', 'moderate', 'management'], true),
('Negligent Fund Handling', 'management', null, 'decrement', 150, 400, null, 4, true, 2, 'Mishandled community funds through negligence', ARRAY['penalty', 'moderate', 'management'], true),
('Position Duties Neglected', 'management', null, 'decrement', 75, 200, null, 3, true, 2, 'Failed to fulfill duties of a held position', ARRAY['penalty', 'moderate', 'management'], true),
('Low-Quality or Plagiarised Work', 'technical', null, 'decrement', 50, 200, null, 3, true, 2, 'Submitted work below standard or plagiarised', ARRAY['penalty', 'moderate', 'technical'], true),

-- SEVERE penalties (Conduct Panel / Board only)
('Discrimination or Bias', 'soft', null, 'decrement', 300, 800, null, 5, true, 3, 'Discriminatory or biased behaviour toward members', ARRAY['penalty', 'severe', 'soft'], true),
('Harassment', 'soft', null, 'decrement', 400, 1000, null, 5, true, 3, 'Harassment of any member or community participant', ARRAY['penalty', 'severe', 'soft'], true),
('Bad-Mouthing', 'soft', null, 'decrement', 200, 500, null, 4, true, 2, 'Publicly disparaging the community or members', ARRAY['penalty', 'severe', 'soft'], true),
('Confidential Data Leak', 'management', null, 'decrement', 500, 1000, null, 5, true, 3, 'Leaked confidential community or member data', ARRAY['penalty', 'severe', 'management'], true),
('Falsified Claim or Fake Contributors', 'technical', null, 'decrement', 400, 1000, null, 5, true, 3, 'Submitted false claims or fabricated contributors', ARRAY['penalty', 'severe', 'technical'], true),
('False Malicious Report', 'soft', null, 'decrement', 300, 700, null, 4, true, 2, 'Filed a knowingly false report against another member', ARRAY['penalty', 'severe', 'soft'], true),
('Misuse of Funds', 'management', null, 'decrement', 500, 1000, null, 5, true, 3, 'Misappropriated or misused community funds', ARRAY['penalty', 'severe', 'management'], true);

-- ============================================================
-- Seed role assignments for existing profiles
-- This will be populated when actual user data is available
-- ============================================================

-- ============================================================
-- Penalty workflow RPC functions
-- ============================================================

create function file_penalty(
  p_member_id uuid,
  p_activity_type_id uuid,
  p_severity text,
  p_exp_deduction integer,
  p_description text,
  p_evidence_urls text[],
  p_response_deadline timestamptz
) returns uuid as $$
declare
  v_penalty_id uuid;
  v_filer record;
  v_member record;
  v_activity record;
begin
  select * into v_filer from profiles where id = auth.uid();
  if not found then
    raise exception 'Filer profile not found';
  end if;

  select * into v_member from profiles where id = p_member_id;
  if not found then
    raise exception 'Member profile not found';
  end if;

  -- Cannot file penalty against yourself
  if auth.uid() = p_member_id then
    raise exception 'Cannot file penalty against yourself';
  end if;

  select * into v_activity from activity_types where id = p_activity_type_id;
  if not found then
    raise exception 'Activity type not found';
  end if;

  -- Validate kind is decrement
  if v_activity.kind <> 'decrement' then
    raise exception 'Activity type is not a penalty';
  end if;

  -- Check severity permissions
  if p_severity = 'severe'
    and not exists (select 1 from profiles where id = auth.uid() and role in ('board_member', 'admin', 'conduct_panel_member')) then
    raise exception 'Only Board, Admin, or Conduct Panel can file severe penalties';
  end if;

  if p_severity = 'moderate'
    and not exists (select 1 from profiles where id = auth.uid() and role in ('domain_head', 'council_member', 'board_member', 'admin', 'conduct_panel_member')) then
    raise exception 'Insufficient role for moderate penalties';
  end if;

  if p_severity = 'minor'
    and not exists (select 1 from profiles where id = auth.uid() and role in ('team_lead', 'domain_head', 'council_member', 'board_member', 'admin', 'conduct_panel_member', 'faculty')) then
    raise exception 'Insufficient role for minor penalties';
  end if;

  -- Check scope: filer can only penalize within their scope
  -- (simplified: team_lead can only file for team members, etc.)
  -- This is enforced at the application level via can() checks

  -- Set response deadline (default 7 days from now)
  if p_response_deadline is null then
    p_response_deadline := now() + interval '7 days';
  end if;

  insert into penalties (filed_by, member_id, activity_type_id, severity, exp_deduction,
                          description, evidence_urls, response_deadline, status)
  values (auth.uid(), p_member_id, p_activity_type_id, p_severity, p_exp_deduction,
          p_description, p_evidence_urls, p_response_deadline, 'filed')
  returning id into v_penalty_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'penalty.filed', 'penalties', v_penalty_id,
          jsonb_build_object('member_id', p_member_id, 'severity', p_severity, 'exp_deduction', p_exp_deduction));

  return v_penalty_id;
end $$ language plpgsql security definer;

create function respond_to_penalty(
  p_penalty_id uuid,
  p_response_text text,
  p_evidence_urls text[]
) returns text as $$
declare
  v_penalty record;
  v_member record;
begin
  select * into v_penalty from penalties where id = p_penalty_id;
  if not found then
    raise exception 'Penalty not found';
  end if;

  select * into v_member from profiles where id = auth.uid();
  if not found then
    raise exception 'Member profile not found';
  end if;

  -- Only the penalized member can respond
  if auth.uid() <> v_penalty.member_id then
    raise exception 'Only the penalized member can respond';
  end if;

  -- Check response window
  if v_penalty.status <> 'filed' then
    raise exception 'Penalty is not in filed status';
  end if;

  if v_penalty.response_deadline < now() then
    raise exception 'Response window has expired';
  end if;

  insert into penalty_responses (penalty_id, member_id, response_text, evidence_urls)
  values (p_penalty_id, auth.uid(), p_response_text, p_evidence_urls);

  update penalties
  set status = 'responded',
      updated_at = now()
  where id = p_penalty_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'penalty.responded', 'penalties', p_penalty_id,
          jsonb_build_object('response_text', p_response_text));

  return 'Response submitted.';
end $$ language plpgsql security definer;

create function review_penalty(
  p_penalty_id uuid,
  p_review_notes text
) returns text as $$
declare
  v_penalty record;
  v_reviewer record;
begin
  select * into v_penalty from penalties where id = p_penalty_id;
  if not found then
    raise exception 'Penalty not found';
  end if;

  select * into v_reviewer from profiles where id = auth.uid();
  if not found then
    raise exception 'Reviewer profile not found';
  end if;

  -- Cannot review your own penalty
  if auth.uid() = v_penalty.filed_by then
    raise exception 'Cannot review a penalty you filed';
  end if;

  -- Check status: must be filed or responded
  if v_penalty.status not in ('filed', 'responded') then
    raise exception 'Penalty is not in a reviewable state';
  end if;

  -- Check role: reviewer must have penalty.file permission at appropriate scope
  if not exists (
    select 1 from profiles where id = auth.uid() and role in ('domain_head', 'council_member', 'board_member', 'admin', 'conduct_panel_member', 'faculty')
  ) then
    raise exception 'Insufficient role to review penalty';
  end if;

  update penalties
  set status = 'reviewed',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes,
      updated_at = now()
  where id = p_penalty_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'penalty.reviewed', 'penalties', p_penalty_id,
          jsonb_build_object('review_notes', p_review_notes));

  return 'Penalty reviewed.';
end $$ language plpgsql security definer;

create function decide_penalty(
  p_penalty_id uuid,
  p_decision text,
  p_decision_reason text
) returns text as $$
declare
  v_penalty record;
  v_decider record;
begin
  select * into v_penalty from penalties where id = p_penalty_id;
  if not found then
    raise exception 'Penalty not found';
  end if;

  select * into v_decider from profiles where id = auth.uid();
  if not found then
    raise exception 'Decider profile not found';
  end if;

  -- Cannot decide your own penalty
  if auth.uid() = v_penalty.filed_by then
    raise exception 'Cannot decide a penalty you filed';
  end if;

  -- Check status: must be reviewed
  if v_penalty.status <> 'reviewed' then
    raise exception 'Penalty is not in reviewed status';
  end if;

  -- Check role: decider must have penalty.file at org scope or be conduct panel/board
  if not exists (
    select 1 from profiles where id = auth.uid() and role in ('board_member', 'admin', 'conduct_panel_member')
  ) then
    raise exception 'Insufficient role to decide penalty';
  end if;

  if p_decision = 'upheld' then
    update penalties
    set status = 'decided',
        decided_by = auth.uid(),
        decided_at = now(),
        decision = p_decision,
        decision_reason = p_decision_reason,
        updated_at = now()
    where id = p_penalty_id;
  else
    update penalties
    set status = 'rejected',
        decided_by = auth.uid(),
        decided_at = now(),
        decision = p_decision,
        decision_reason = p_decision_reason,
        updated_at = now()
    where id = p_penalty_id;
  end if;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'penalty.decided', 'penalties', p_penalty_id,
          jsonb_build_object('decision', p_decision, 'decision_reason', p_decision_reason));

  return 'Penalty decision recorded.';
end $$ language plpgsql security definer;

create function appeal_penalty(
  p_penalty_id uuid,
  p_appeal_text text,
  p_evidence_urls text[]
) returns uuid as $$
declare
  v_penalty record;
  v_appeal_id uuid;
begin
  select * into v_penalty from penalties where id = p_penalty_id;
  if not found then
    raise exception 'Penalty not found';
  end if;

  -- Only the penalized member can appeal
  if auth.uid() <> v_penalty.member_id then
    raise exception 'Only the penalized member can appeal';
  end if;

  -- Check status: must be decided or upheld
  if v_penalty.status not in ('decided', 'upheld') then
    raise exception 'Penalty is not in an appealable state';
  end if;

  -- Check if already appealed
  if v_penalty.appealed then
    raise exception 'Penalty has already been appealed';
  end if;

  insert into penalty_appeals (penalty_id, member_id, appeal_text, evidence_urls, status)
  values (p_penalty_id, auth.uid(), p_appeal_text, p_evidence_urls, 'pending')
  returning id into v_appeal_id;

  update penalties
  set status = 'appealed',
      appealed = true,
      appeal_deadline = now() + interval '14 days',
      updated_at = now()
  where id = p_penalty_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'penalty.appealed', 'penalties', p_penalty_id,
          jsonb_build_object('appeal_text', p_appeal_text));

  return v_appeal_id;
end $$ language plpgsql security definer;

create function review_appeal(
  p_appeal_id uuid,
  p_status text,
  p_review_notes text
) returns text as $$
declare
  v_appeal record;
  v_penalty record;
  v_reviewer record;
begin
  select * into v_appeal from penalty_appeals where id = p_appeal_id;
  if not found then
    raise exception 'Appeal not found';
  end if;

  select * into v_penalty from penalties where id = v_appeal.penalty_id;
  if not found then
    raise exception 'Penalty not found';
  end if;

  select * into v_reviewer from profiles where id = auth.uid();
  if not found then
    raise exception 'Reviewer profile not found';
  end if;

  -- Cannot review your own appeal
  if auth.uid() = v_appeal.member_id then
    raise exception 'Cannot review your own appeal';
  end if;

  -- Check status: must be pending
  if v_appeal.status <> 'pending' then
    raise exception 'Appeal is not in pending status';
  end if;

  -- Check role: reviewer must be board/admin/conduct_panel
  if not exists (
    select 1 from profiles where id = auth.uid() and role in ('board_member', 'admin', 'conduct_panel_member')
  ) then
    raise exception 'Insufficient role to review appeal';
  end if;

  update penalty_appeals
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes
  where id = p_appeal_id;

  if p_status = 'granted' then
    update penalties
    set status = 'rejected',
        decision = 'overturned_on_appeal',
        decision_reason = p_review_notes,
        updated_at = now()
    where id = v_appeal.penalty_id;
  else
    update penalties
    set status = 'upheld',
        decision = 'upheld_on_appeal',
        decision_reason = p_review_notes,
        updated_at = now()
    where id = v_appeal.penalty_id;
  end if;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'penalty.appeal_reviewed', 'penalties', v_appeal.penalty_id,
          jsonb_build_object('appeal_status', p_status, 'review_notes', p_review_notes));

  return 'Appeal reviewed.';
end $$ language plpgsql security definer;


-- ============================================================
-- Link activity_types to subcategories
-- These will be populated by the admin when activity types are configured
-- ============================================================

-- ============================================================
-- Phase 5.2: Coach plan table
-- ============================================================

create table coach_plan (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  activity_type_id uuid references activity_types(id) not null,
  activity_title text not null,
  activity_category text not null,
  activity_domain uuid references domains(id),
  exp_reward integer not null default 0,
  day_of_week integer not null check (day_of_week between 0 and 6),
  added_at timestamptz default now(),
  is_completed boolean not null default false,
  completed_at timestamptz,
  unique (member_id, activity_type_id, day_of_week)
);

alter table coach_plan enable row level security;

create policy coach_plan_own on coach_plan
  for all using (auth.uid() = member_id);

create table coach_not_for_me (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  activity_type_id uuid references activity_types(id) not null,
  created_at timestamptz default now(),
  unique (member_id, activity_type_id)
);

alter table coach_not_for_me enable row level security;

create policy coach_not_for_me_own on coach_not_for_me
  for all using (auth.uid() = member_id);

-- ============================================================
-- Coach RPC functions
-- ============================================================

create function add_to_coach_plan(
  p_member_id uuid,
  p_activity_type_id uuid,
  p_activity_title text,
  p_activity_category text,
  p_activity_domain uuid,
  p_exp_reward integer,
  p_day_of_week integer
) returns uuid as $$
declare
  v_plan_id uuid;
begin
  -- Check if already planned for this day
  if exists (
    select 1 from coach_plan
    where member_id = p_member_id and day_of_week = p_day_of_week
  ) then
    raise exception 'You already have an activity planned for this day of the week.';
  end if;

  -- Check weekly cap (max 5 items)
  if (
    select count(*) from coach_plan
    where member_id = p_member_id
      and added_at >= date_trunc('week', now())
      and added_at < date_trunc('week', now()) + interval '7 days'
  ) >= 5 then
    raise exception 'Weekly plan capacity reached (max 5 items).';
  end if;

  insert into coach_plan (member_id, activity_type_id, activity_title, activity_category,
                          activity_domain, exp_reward, day_of_week)
  values (p_member_id, p_activity_type_id, p_activity_title, p_activity_category,
          p_activity_domain, p_exp_reward, p_day_of_week)
  returning id into v_plan_id;

  return v_plan_id;
end $$ language plpgsql security definer;

create function remove_from_coach_plan(
  p_plan_item_id uuid
) returns text as $$
declare
  v_plan record;
begin
  select * into v_plan from coach_plan where id = p_plan_item_id;
  if not found then
    raise exception 'Plan item not found';
  end if;

  if auth.uid() <> v_plan.member_id then
    raise exception 'Cannot remove another member\'s plan item';
  end if;

  delete from coach_plan where id = p_plan_item_id;
  return 'Plan item removed.';
end $$ language plpgsql security definer;

create function mark_coach_not_for_me(
  p_activity_type_id uuid
) returns text as $$
begin
  insert into coach_not_for_me (member_id, activity_type_id)
  values (auth.uid(), p_activity_type_id)
  on conflict (member_id, activity_type_id) do nothing;

  return 'Marked as not for me.';
end $$ language plpgsql security definer;

-- ============================================================
-- Phase 5.3: Notification system tables
-- ============================================================

create table notification_settings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null unique,
  in_app boolean not null default true,
  discord_dm boolean not null default false,
  email boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '08:00',
  max_proactive_nudges_per_week integer not null default 2,
  auto_pause_on_leave boolean not null default false,
  auto_pause_on_exams boolean not null default false,
  leave_until timestamptz,
  exam_until timestamptz,
  updated_at timestamptz default now(),
  unique (member_id)
);

alter table notification_settings enable row level security;

create policy notification_settings_own on notification_settings
  for all using (auth.uid() = member_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  type text not null check (type in ('weekly_digest', 'watch_warning', 'critical_alert', 'attendance_reminder', 'approver_reminder', 'system', 'claim_update', 'reward', 'penalty')),
  title text not null,
  body text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'discord_dm', 'email')),
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  data jsonb default '{}',
  created_at timestamptz default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

alter table notifications enable row level security;

create policy notifications_own on notifications
  for all using (auth.uid() = member_id);

create index idx_notifications_member_read on notifications(member_id, is_read);
create index idx_notifications_member_created on notifications(member_id, created_at desc);

-- ============================================================
-- Notification RPC functions
-- ============================================================

create function update_notification_settings(
  p_in_app boolean,
  p_discord_dm boolean,
  p_email boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_max_proactive_nudges_per_week integer,
  p_auto_pause_on_leave boolean,
  p_auto_pause_on_exams boolean,
  p_leave_until timestamptz,
  p_exam_until timestamptz
) returns text as $$
declare
  v_exists boolean;
begin
  select exists (select 1 from notification_settings where member_id = auth.uid()) into v_exists;

  if v_exists then
    update notification_settings
    set in_app = p_in_app,
        discord_dm = p_discord_dm,
        email = p_email,
        quiet_hours_start = p_quiet_hours_start,
        quiet_hours_end = p_quiet_hours_end,
        max_proactive_nudges_per_week = p_max_proactive_nudges_per_week,
        auto_pause_on_leave = p_auto_pause_on_leave,
        auto_pause_on_exams = p_auto_pause_on_exams,
        leave_until = p_leave_until,
        exam_until = p_exam_until,
        updated_at = now()
    where member_id = auth.uid();
  else
    insert into notification_settings (member_id, in_app, discord_dm, email,
                                       quiet_hours_start, quiet_hours_end,
                                       max_proactive_nudges_per_week,
                                       auto_pause_on_leave, auto_pause_on_exams,
                                       leave_until, exam_until)
    values (auth.uid(), p_in_app, p_discord_dm, p_email,
            p_quiet_hours_start, p_quiet_hours_end,
            p_max_proactive_nudges_per_week,
            p_auto_pause_on_leave, p_auto_pause_on_exams,
            p_leave_until, p_exam_until);
  end if;

  return 'Settings updated.';
end $$ language plpgsql security definer;

create function mark_notification_read(
  p_notification_id uuid
) returns text as $$
declare
  v_notif record;
begin
  select * into v_notif from notifications where id = p_notification_id;
  if not found then
    raise exception 'Notification not found';
  end if;

  if auth.uid() <> v_notif.member_id then
    raise exception 'Cannot mark another member\'s notification';
  end if;

  update notifications
  set is_read = true,
      read_at = now()
  where id = p_notification_id;

  return 'Notification marked as read.';
end $$ language plpgsql security definer;

create function dismiss_notification(
  p_notification_id uuid
) returns text as $$
declare
  v_notif record;
begin
  select * into v_notif from notifications where id = p_notification_id;
  if not found then
    raise exception 'Notification not found';
  end if;

  if auth.uid() <> v_notif.member_id then
    raise exception 'Cannot dismiss another member\'s notification';
  end if;

  update notifications
  set is_dismissed = true,
      dismissed_at = now()
  where id = p_notification_id;

  return 'Notification dismissed.';
end $$ language plpgsql security definer;

-- ============================================================
-- Seed sample notifications for demonstration
-- ============================================================

-- These will be inserted when the member first visits the notifications page
-- via the application layer (frontend generates sample nudges)


