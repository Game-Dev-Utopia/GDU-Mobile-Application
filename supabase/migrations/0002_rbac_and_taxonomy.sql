-- Patch A: RBAC tables
-- Patch B1: Activity taxonomy (category → subcategory → activity)

-- ============================================================
-- Activity Subcategories (category → subcategory → activity)
-- ============================================================

create table activity_subcategories (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'technology_innovation_wisdom',
    'motivation_initiative_learning_mindset',
    'social_soft_skills',
    'leadership_management'
  )),
  name text not null,
  display_name text not null,
  description text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (category, name)
);

-- Update activity_types to reference subcategory
alter table activity_types
  add column subcategory_id uuid references activity_subcategories(id);

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
-- TECHNOLOGY, INNOVATION & WISDOM
('technology_innovation_wisdom', 'game_dev', 'Game Development', 'Game creation, prototyping, jams', 1),
('technology_innovation_wisdom', 'web_devops', 'Web & DevOps', 'Websites, deployment, CI/CD, infrastructure', 2),
('technology_innovation_wisdom', 'ai_rd', 'AI & R&D', 'AI/ML prototypes, research, experiments', 3),
('technology_innovation_wisdom', 'open_source', 'Open Source', 'PRs, code reviews, documentation', 4),

-- MOTIVATION, INITIATIVE & LEARNING MINDSET
('motivation_initiative_learning_mindset', 'content', 'Content Creation', 'Blogs, articles, tutorials, writing', 1),
('motivation_initiative_learning_mindset', 'workshop', 'Workshops & Sessions', 'SIG sessions, teaching, facilitation', 2),
('motivation_initiative_learning_mindset', 'attendance', 'Participation', 'Session attendance, event participation', 3),

-- SOCIAL & SOFT SKILLS
('social_soft_skills', 'mentoring', 'Mentoring', 'Peer mentoring, onboarding buddies', 1),
('social_soft_skills', 'moderation', 'Community Moderation', 'Discord moderation, community management', 2),
('social_soft_skills', 'social_media', 'Social Media', 'Posts, campaigns, outreach', 3),
('social_soft_skills', 'referral', 'Referrals', 'Member referrals (vested)', 4),

-- LEADERSHIP & MANAGEMENT
('leadership_management', 'events', 'Event Hosting', 'Organizing events, bootcamps, meetups', 1),
('leadership_management', 'projects', 'Project Leadership', 'Project lead, PM, milestone delivery', 2),
('leadership_management', 'sponsorship', 'Sponsorship & Partnerships', 'Sponsors, MoUs, funding', 3),
('leadership_management', 'governance', 'Governance', 'Positions, interviews, process docs', 4);

-- ============================================================
-- Seed role assignments for existing profiles
-- This will be populated when actual user data is available
-- ============================================================

-- ============================================================
-- Update activity_types with subcategory references
-- These will be populated by the admin when activity types are configured
-- ============================================================
