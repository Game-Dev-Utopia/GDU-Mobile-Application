-- Role Assignment Seed Data
-- IMPORTANT: Profiles are auto-created on Discord signup via the handle_new_user trigger.
-- You must run this migration AFTER each person has signed up via Discord,
-- replacing the placeholder profile_id values with their actual auth.users.id.

-- ============================================================
-- Board Members (org scope)
-- ============================================================
-- Himanshu Pandey - Board Member
-- Sai Tejashwin - Board Member
-- Apurv Henkare - Board Member
-- Mihir Ranade - Board Member
-- Prajwal Pawar - Board Member

-- ============================================================
-- Council Heads - GDU PICT (branch scope)
-- ============================================================
-- Bhuvan - President (council_member)
-- Pushkar - VP (council_member)
-- Aashita - Secretary + Admin & Ops (council_member)
-- Husain - AI Sub Head (domain_head, AI & ML)
-- Aryan - Coding Sub Head (domain_head, Game Dev (Coding))
-- Pushkar - Design Sub Head (domain_head, Design & Digital Arts)
-- Tanishq - External Affairs Sub Head (domain_head, Eternal Affairs)

-- ============================================================
-- Council Heads - GDU IIITK (branch scope)
-- ============================================================
-- Bhavesh - RnD (domain_head, Research & Development (R&D))
-- Ananya - Content Creation (domain_head, Content Creation)
-- Tanishq - Marketing (domain_head, Marketing)
-- Raman - Web & DevOps (domain_head, Web & DevOps)
-- Hussain - Coding (domain_head, Game Dev (Coding))
-- Adwaiy - Design (domain_head, Design & Digital Arts)

-- ============================================================
-- Template: Replace PLACEHOLDER_AUTH_USER_ID with actual IDs
-- ============================================================

-- Example (uncomment and replace after Discord signup):
/*
insert into role_assignments (profile_id, role, scope, scope_entity_id, granted_by, is_active) values
-- Board Members (org scope)
('PLACEHOLDER_Himanshu_Pandey_auth_id', 'board_member', 'org', null, null, true),
('PLACEHOLDER_Sai_Tejashwin_auth_id', 'board_member', 'org', null, null, true),
('PLACEHOLDER_Apurv_Henkare_auth_id', 'board_member', 'org', null, null, true),
('PLACEHOLDER_Mihir_Ranade_auth_id', 'board_member', 'org', null, null, true),
('PLACEHOLDER_Prajwal_Pawar_auth_id', 'board_member', 'org', null, null, true),

-- GDU PICT Council
('PLACEHOLDER_Bhuvan_auth_id', 'council_member', 'branch', (select id from branches where name = 'GDU PICT'), null, true),
('PLACEHOLDER_Pushkar_auth_id', 'council_member', 'branch', (select id from branches where name = 'GDU PICT'), null, true),
('PLACEHOLDER_Aashita_auth_id', 'council_member', 'branch', (select id from branches where name = 'GDU PICT'), null, true),

-- GDU PICT Domain Heads
('PLACEHOLDER_Husain_auth_id', 'domain_head', 'domain', (select id from domains where name = 'AI & ML' and branch_id = (select id from branches where name = 'GDU PICT')), null, true),
('PLACEHOLDER_Aryan_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Game Dev (Coding)' and branch_id = (select id from branches where name = 'GDU PICT')), null, true),
('PLACEHOLDER_Pushkar_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Design & Digital Arts' and branch_id = (select id from branches where name = 'GDU PICT')), null, true),
('PLACEHOLDER_Tanishq_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Eternal Affairs' and branch_id = (select id from branches where name = 'GDU PICT')), null, true),

-- GDU IIITK Domain Heads
('PLACEHOLDER_Bhavesh_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Research & Development (R&D)' and branch_id = (select id from branches where name = 'GDU IIITK')), null, true),
('PLACEHOLDER_Ananya_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Content Creation' and branch_id = (select id from branches where name = 'GDU IIITK')), null, true),
('PLACEHOLDER_Tanishq_IIITK_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Marketing' and branch_id = (select id from branches where name = 'GDU IIITK')), null, true),
('PLACEHOLDER_Raman_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Web & DevOps' and branch_id = (select id from branches where name = 'GDU IIITK')), null, true),
('PLACEHOLDER_Hussain_IIITK_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Game Dev (Coding)' and branch_id = (select id from branches where name = 'GDU IIITK')), null, true),
('PLACEHOLDER_Adwaiy_auth_id', 'domain_head', 'domain', (select id from domains where name = 'Design & Digital Arts' and branch_id = (select id from branches where name = 'GDU IIITK')), null, true);
*/
