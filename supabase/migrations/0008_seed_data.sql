-- Seed Data Migration
-- Branches, Domains, Config Version, Activity Types, League Tiers, Badges, Quests

-- ============================================================
-- Branches
-- ============================================================

insert into branches (name, display_name) values
('GDU PICT', 'GDU PICT (Pune Institute of Computer Technology)'),
('GDU IIITK', 'GDU IIITK (Indian Institute of Information Technology, Kottayam)')
on conflict (name) do nothing;

-- ============================================================
-- Domains
-- ============================================================

insert into domains (name, display_name, branch_id) values
-- Game Dev (Coding) - both branches
('Game Dev (Coding)', 'Game Dev (Coding)', (select id from branches where name = 'GDU PICT')),
('Game Dev (Coding)', 'Game Dev (Coding)', (select id from branches where name = 'GDU IIITK')),
-- Web & DevOps
('Web & DevOps', 'Web & DevOps', (select id from branches where name = 'GDU PICT')),
('Web & DevOps', 'Web & DevOps', (select id from branches where name = 'GDU IIITK')),
-- AI & ML
('AI & ML', 'AI & ML', (select id from branches where name = 'GDU PICT')),
('AI & ML', 'AI & ML', (select id from branches where name = 'GDU IIITK')),
-- Marketing
('Marketing', 'Marketing', (select id from branches where name = 'GDU PICT')),
('Marketing', 'Marketing', (select id from branches where name = 'GDU IIITK')),
-- Content Creation (NEW)
('Content Creation', 'Content Creation', (select id from branches where name = 'GDU PICT')),
('Content Creation', 'Content Creation', (select id from branches where name = 'GDU IIITK')),
-- Eternal Affairs
('Eternal Affairs', 'Eternal Affairs', (select id from branches where name = 'GDU PICT')),
('Eternal Affairs', 'Eternal Affairs', (select id from branches where name = 'GDU IIITK')),
-- Design & Digital Arts
('Design & Digital Arts', 'Design & Digital Arts', (select id from branches where name = 'GDU PICT')),
('Design & Digital Arts', 'Design & Digital Arts', (select id from branches where name = 'GDU IIITK')),
-- Research & Development (R&D)
('Research & Development (R&D)', 'Research & Development (R&D)', (select id from branches where name = 'GDU PICT')),
('Research & Development (R&D)', 'Research & Development (R&D)', (select id from branches where name = 'GDU IIITK'))
on conflict (name) do nothing;

-- ============================================================
-- Positions
-- ============================================================

insert into positions (name, scope, min_exp_total, min_exp_per_category) values
('Member', 'self', 0, '{}'),
('Team Lead', 'team', 500, '{"leadership_management": 200}'),
('Domain Head', 'domain', 1500, '{"leadership_management": 600, "technology_innovation_wisdom": 400}'),
('Branch President', 'branch', 3000, '{"leadership_management": 1200}'),
('Branch VP', 'branch', 2500, '{"leadership_management": 1000}'),
('Board Member', 'org', 5000, '{"leadership_management": 2000}'),
('Faculty Advisor', 'org', 0, '{}'),
('Finance & Compliance Officer', 'org', 0, '{}')
on conflict do nothing;

-- ============================================================
-- Config Version v1
-- ============================================================

insert into config_versions (version_label, effective_from, created_by)
select 'v1', now(), id from profiles where role = 'board_member' limit 1
on conflict do nothing;

-- ============================================================
-- League Tiers (Bronze → Diamond)
-- ============================================================

insert into league_tiers (name, display_name, min_exp, max_exp, color, sort_order, is_locked) values
('bronze', 'Bronze', 0, 999, '#CD7F32', 1, false),
('silver', 'Silver', 1000, 2499, '#C0C0C0', 2, false),
('gold', 'Gold', 2500, 4999, '#FFD700', 3, false),
('platinum', 'Platinum', 5000, 7499, '#E5E4E2', 4, false),
('emerald', 'Emerald', 7500, 9999, '#10B981', 5, false),
('diamond', 'Diamond', 10000, NULL, '#B9F2FF', 6, false)
on conflict (name) do nothing;

-- ============================================================
-- Activity Subcategories
-- ============================================================

insert into activity_subcategories (category, name, display_name, description, sort_order, is_active) values
-- TECHNOLOGY, INNOVATION & WISDOM
('technology_innovation_wisdom', 'game_dev', 'Game Development', 'Game creation, prototyping, jams', 1, true),
('technology_innovation_wisdom', 'web_devops', 'Web & DevOps', 'Websites, deployment, CI/CD, infrastructure', 2, true),
('technology_innovation_wisdom', 'ai_ml', 'AI & ML', 'AI/ML prototypes, research, experiments', 3, true),
('technology_innovation_wisdom', 'open_source', 'Open Source', 'PRs, code reviews, documentation', 4, true),

-- MOTIVATION, INITIATIVE & LEARNING MINDSET
('motivation_initiative_learning_mindset', 'content', 'Content Creation', 'Blogs, articles, tutorials, writing', 1, true),
('motivation_initiative_learning_mindset', 'workshop', 'Workshops & Sessions', 'SIG sessions, teaching, facilitation', 2, true),
('motivation_initiative_learning_mindset', 'attendance', 'Participation', 'Session attendance, event participation', 3, true),

-- SOCIAL & SOFT SKILLS
('social_soft_skills', 'mentoring', 'Mentoring', 'Peer mentoring, onboarding buddies', 1, true),
('social_soft_skills', 'moderation', 'Community Moderation', 'Community management, conflict resolution', 2, true),
('social_soft_skills', 'social_media', 'Social Media', 'Posts, campaigns, outreach', 3, true),
('social_soft_skills', 'referral', 'Referrals', 'Member referrals (vested)', 4, true),

-- LEADERSHIP & MANAGEMENT
('leadership_management', 'events', 'Event Hosting', 'Organizing events, bootcamps, meetups', 1, true),
('leadership_management', 'projects', 'Project Leadership', 'Project lead, PM, milestone delivery', 2, true),
('leadership_management', 'sponsorship', 'Sponsorship & Partnerships', 'Sponsors, MoUs, funding', 3, true),
('leadership_management', 'governance', 'Governance', 'Positions, interviews, process docs', 4, true)
on conflict (category, name) do nothing;

-- ============================================================
-- Activity Types (2.7 Seed Data + Increment/Decrement lists)
-- ============================================================

-- Helper: get domain id by name
do $$
declare
  v_game_dev uuid;
  v_web_devops uuid;
  v_ai_ml uuid;
  v_marketing uuid;
  v_eternal_affairs uuid;
  v_design uuid;
  v_rd uuid;
  v_game_dev_sub uuid;
  v_web_devops_sub uuid;
  v_ai_ml_sub uuid;
  v_open_source_sub uuid;
  v_content_sub uuid;
  v_workshop_sub uuid;
  v_attendance_sub uuid;
  v_mentoring_sub uuid;
  v_moderation_sub uuid;
  v_social_media_sub uuid;
  v_referral_sub uuid;
  v_events_sub uuid;
  v_projects_sub uuid;
  v_sponsorship_sub uuid;
  v_governance_sub uuid;
  v_config_id uuid;
begin
  -- Get domain ids (use PICT branch domains)
  select id into v_game_dev from domains where name = 'Game Dev (Coding)' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;
  select id into v_web_devops from domains where name = 'Web & DevOps' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;
  select id into v_ai_ml from domains where name = 'AI & ML' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;
  select id into v_marketing from domains where name = 'Marketing' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;
  select id into v_eternal_affairs from domains where name = 'Eternal Affairs' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;
  select id into v_design from domains where name = 'Design & Digital Arts' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;
  select id into v_rd from domains where name = 'Research & Development (R&D)' and branch_id = (select id from branches where name = 'GDU PICT') limit 1;

  -- Get subcategory ids
  select id into v_game_dev_sub from activity_subcategories where name = 'game_dev';
  select id into v_web_devops_sub from activity_subcategories where name = 'web_devops';
  select id into v_ai_ml_sub from activity_subcategories where name = 'ai_ml';
  select id into v_open_source_sub from activity_subcategories where name = 'open_source';
  select id into v_content_sub from activity_subcategories where name = 'content';
  select id into v_workshop_sub from activity_subcategories where name = 'workshop';
  select id into v_attendance_sub from activity_subcategories where name = 'attendance';
  select id into v_mentoring_sub from activity_subcategories where name = 'mentoring';
  select id into v_moderation_sub from activity_subcategories where name = 'moderation';
  select id into v_social_media_sub from activity_subcategories where name = 'social_media';
  select id into v_referral_sub from activity_subcategories where name = 'referral';
  select id into v_events_sub from activity_subcategories where name = 'events';
  select id into v_projects_sub from activity_subcategories where name = 'projects';
  select id into v_sponsorship_sub from activity_subcategories where name = 'sponsorship';
  select id into v_governance_sub from activity_subcategories where name = 'governance';

  -- Get config version
  select id into v_config_id from config_versions where version_label = 'v1' limit 1;

  -- INCREMENT activities (from 2.7 seed data + increment list)
  insert into activity_types (name, category, subcategory_id, domain_id, exp_min, exp_max, season_cap, difficulty, evidence_required, approvers_needed, description, is_active, config_version_id) values
  -- 2.7 Seed Data
  ('Event Hosting', 'leadership_management', v_events_sub, v_eternal_affairs, 25, 150, 5, 4, true, 2, 'Host a community event (workshop, jam, meetup). Planning and execution matter.', true, v_config_id),
  ('Game Jam Participation', 'technology_innovation_wisdom', v_game_dev_sub, v_game_dev, 100, 500, 3, 5, true, 2, 'Participate in a game jam (48-72 hours). Submit a playable build with devlog.', true, v_config_id),
  ('SIG Session Conducted', 'motivation_initiative_learning_mindset', v_workshop_sub, v_web_devops, 40, 120, 6, 4, true, 1, 'Host a Special Interest Group session. Prep, delivery, and attendance matter.', true, v_config_id),
  ('Blog Post', 'motivation_initiative_learning_mindset', v_content_sub, v_design, 30, 100, 4, 3, true, 1, 'Write a technical blog post or article.', true, v_config_id),
  ('Project Development', 'technology_innovation_wisdom', v_projects_sub, v_game_dev, 50, 200, 4, 4, true, 2, 'Develop a game or software project. Scope determines EXP within range.', true, v_config_id),
  ('Mentoring', 'social_soft_skills', v_mentoring_sub, v_eternal_affairs, 20, 80, 5, 3, true, 1, 'Mentor a newcomer or peer. Mentee feedback determines EXP within range.', true, v_config_id),
  ('Interview Panel', 'leadership_management', v_governance_sub, v_rd, 30, 100, 4, 3, true, 1, 'Serve on an interview panel for new members or positions.', true, v_config_id),
  ('Volunteering', 'social_soft_skills', v_moderation_sub, v_eternal_affairs, 10, 60, 6, 2, true, 1, 'Volunteer for community tasks and event support.', true, v_config_id),
  ('Sponsorship Brought', 'leadership_management', v_sponsorship_sub, v_marketing, 100, 300, 2, 5, true, 3, 'Bring a sponsor or partner to GDU. Value and terms determine EXP.', true, v_config_id),
  ('Session Attendance', 'motivation_initiative_learning_mindset', v_attendance_sub, v_web_devops, 5, 25, 10, 1, false, 1, 'Attend a community session or event. Diminishing returns apply.', true, v_config_id),
  ('Referral', 'social_soft_skills', v_referral_sub, v_eternal_affairs, 0, 50, 3, 2, false, 2, 'Refer a new member. EXP vests after 60-90 days of referee activity.', true, v_config_id),
  ('Social Media Post', 'social_soft_skills', v_social_media_sub, v_design, 10, 40, 12, 1, true, 1, 'Post about GDU on social media. Reach and engagement affect EXP.', true, v_config_id),

  -- Increment List additions
  ('Getting Elected to Position', 'leadership_management', v_governance_sub, v_eternal_affairs, 100, 200, 1, 3, true, 2, 'Elected to a community position (Board, Council, Branch President, VP, etc.).', true, v_config_id),
  ('Taking Interviews', 'leadership_management', v_governance_sub, v_rd, 30, 100, 6, 3, true, 1, 'Conduct interviews for new member or position applications.', true, v_config_id),
  ('Community Accepted Proposal', 'leadership_management', v_governance_sub, v_eternal_affairs, 75, 150, 4, 3, true, 2, 'Create a proposal accepted by the community through governance process.', true, v_config_id),
  ('Donating Funds', 'leadership_management', v_sponsorship_sub, v_marketing, 0, 100, 2, 2, true, 2, 'Donate funds to the org. Earns Patron recognition separate from EXP.', true, v_config_id),
  ('Working on Project - Team Lead', 'technology_innovation_wisdom', v_projects_sub, v_game_dev, 100, 300, 2, 5, true, 2, 'Lead a project team. More EXP for higher responsibility roles.', true, v_config_id),
  ('Working on Project - Developer', 'technology_innovation_wisdom', v_projects_sub, v_game_dev, 50, 150, 3, 4, true, 1, 'Develop as a project team member.', true, v_config_id),
  ('Working on Project - Tester', 'technology_innovation_wisdom', v_projects_sub, v_game_dev, 40, 120, 3, 3, true, 1, 'Test and QA a project.', true, v_config_id),
  ('Working on Project - Designer', 'technology_innovation_wisdom', v_projects_sub, v_design, 50, 150, 3, 4, true, 1, 'Design assets for a project.', true, v_config_id),
  ('Working on Project - Project Manager', 'leadership_management', v_projects_sub, v_eternal_affairs, 80, 200, 3, 4, true, 2, 'Manage project timelines and delivery.', true, v_config_id),
  ('Working on Project - Marketer', 'leadership_management', v_projects_sub, v_marketing, 40, 120, 3, 3, true, 1, 'Marketing and promotion for a project.', true, v_config_id),
  ('Reporting Malpractice', 'social_soft_skills', v_moderation_sub, v_eternal_affairs, 50, 150, 3, 3, true, 2, 'Report malpractice or abrupt behavior. Rewarded only when verified through Conduct Panel.', true, v_config_id),
  ('Future Points Assignment', 'leadership_management', v_governance_sub, v_eternal_affairs, 0, 500, 1, 5, true, 3, 'Assign future points to another team. Encashed when provider team earns points.', true, v_config_id),
  ('Bringing Bounty/Funding', 'leadership_management', v_sponsorship_sub, v_marketing, 100, 300, 2, 5, true, 3, 'Bring bounty, sponsorship, or funding opportunity to the org.', true, v_config_id),
  ('Project Team Points Increase', 'technology_innovation_wisdom', v_projects_sub, v_game_dev, 25, 100, 6, 3, true, 1, 'When points of a project/team of which one has membership increases.', true, v_config_id),

  -- DECREMENT activities (penalties)
  ('Periodic Points Decay', 'leadership_management', v_governance_sub, v_eternal_affairs, -50, -10, 1, 1, false, 1, 'Standing decay over time cycle. Points get used up.', true, v_config_id),
  ('Confidential Data Leakage', 'social_soft_skills', v_moderation_sub, v_eternal_affairs, -200, -100, 1, 3, true, 3, 'Malpractice: confidential data leakage.', true, v_config_id),
  ('Negligence in Fund Usage', 'leadership_management', v_sponsorship_sub, v_marketing, -150, -75, 1, 3, true, 3, 'Malpractice: negligence in fund usage.', true, v_config_id),
  ('Discrimination', 'social_soft_skills', v_moderation_sub, v_eternal_affairs, -300, -150, 1, 3, true, 3, 'Abrupt behavior: discrimination or conscious/unconscious bias.', true, v_config_id),
  ('Harassment', 'social_soft_skills', v_moderation_sub, v_eternal_affairs, -300, -150, 1, 3, true, 3, 'Abrupt behavior: harassment.', true, v_config_id),
  ('Bad Mouthing', 'social_soft_skills', v_moderation_sub, v_eternal_affairs, -100, -50, 1, 2, true, 2, 'Abrupt behavior: bad mouthing.', true, v_config_id),
  ('Abandoning Project', 'leadership_management', v_projects_sub, v_game_dev, -150, -75, 1, 2, true, 2, 'Abandoning contribution to a project without genuine reason.', true, v_config_id);

end $$;

-- ============================================================
-- Badges (Phase 2)
-- ============================================================

insert into badges (name, slug, description, rarity, icon, color, xpReward, criteria) values
('First Claim', 'first_claim', 'Submit your first claim', 'common', 'FileCheck', '#22D3EE', 25, '{"type": "claim_count", "threshold": 1}'),
('Five Claims', 'five_claims', 'Submit 5 claims', 'common', 'FileCheck', '#22D3EE', 50, '{"type": "claim_count", "threshold": 5}'),
('Ten Claims', 'ten_claims', 'Submit 10 claims', 'uncommon', 'FileCheck', '#22D3EE', 100, '{"type": "claim_count", "threshold": 10}'),
('First Approval', 'first_approval', 'Review your first claim as an approver', 'uncommon', 'ClipboardList', '#A3E635', 50, '{"type": "review_count", "threshold": 1}'),
('Season Starter', 'season_starter', 'Earn EXP in the first week of a season', 'rare', 'Clock', '#7C5CFF', 100, '{"type": "season_start", "threshold": 1}'),
('High Performer', 'high_performer', 'Reach Gold league tier', 'rare', 'Trophy', '#FFD700', 150, '{"type": "league_tier", "threshold": "gold"}'),
('Domain Leader', 'domain_leader', 'Serve as a Domain Head', 'epic', 'Shield', '#B9F2FF', 200, '{"type": "role_held", "threshold": "domain_head"}'),
('Jam Participant', 'jam_participant', 'Participate in a game jam', 'rare', 'Zap', '#F59E0B', 75, '{"type": "activity_tag", "threshold": "jam"}'),
('Mentor', 'mentor', 'Mentor 3 newcomers', 'uncommon', 'User', '#22D3EE', 100, '{"type": "activity_tag", "threshold": "mentoring", "count": 3}'),
('Founding Member', 'founding_member', 'Joined GDU XP in the first season', 'legendary', 'Star', '#FFD700', 500, '{"type": "join_date", "threshold": "season_1"}')
on conflict (slug) do nothing;

-- ============================================================
-- Quests (Phase 2)
-- ============================================================

insert into quests (title, description, type, xpReward, coinReward, criteria, startsAt, endsAt, isActive, maxParticipants) values
('First Steps', 'Submit your first claim this week', 'weekly', 50, 5, '{"type": "claim_count", "threshold": 1, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Active Contributor', 'Submit 3 claims this week', 'weekly', 150, 10, '{"type": "claim_count", "threshold": 3, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Top Contributor', 'Submit 5 claims this week', 'weekly', 300, 25, '{"type": "claim_count", "threshold": 5, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Reviewer', 'Review 2 claims this week', 'weekly', 100, 5, '{"type": "review_count", "threshold": 2, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Season Starter', 'Earn 1000 EXP this season', 'seasonal', 500, 50, '{"type": "season_exp", "threshold": 1000}', now() - interval '90 days', now() + interval '90 days', true, null),
('Season Champion', 'Earn 5000 EXP this season', 'seasonal', 2000, 100, '{"type": "season_exp", "threshold": 5000}', now() - interval '90 days', now() + interval '90 days', true, null),
('Jam Participant', 'Participate in a game jam', 'one_time', 200, 20, '{"type": "activity_tag", "threshold": "jam"}', now() - interval '90 days', now() + interval '90 days', true, null),
('Mentor', 'Mentor a newcomer', 'one_time', 150, 15, '{"type": "activity_tag", "threshold": "mentoring"}', now() - interval '90 days', now() + interval '90 days', true, null)
on conflict do nothing;
