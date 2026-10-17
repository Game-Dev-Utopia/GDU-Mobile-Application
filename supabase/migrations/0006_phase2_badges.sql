-- Phase 2: Badges system

-- ============================================================
-- Badge definitions
-- ============================================================

create table badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null,
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  icon text not null, -- lucide icon name
  color text not null default '#7C5CFF', -- hex color
  xpReward integer default 0, -- bonus XP for earning
  criteria jsonb not null, -- JSON criteria for earning (e.g. {"type": "claim_count", "threshold": 10})
  isActive boolean default true,
  createdAt timestamptz default now()
);

alter table badges enable row level security;

create policy badges_read on badges
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Member badges (earned badges)
-- ============================================================

create table member_badges (
  id uuid primary key default gen_random_uuid(),
  memberId uuid references profiles(id) not null,
  badgeId uuid references badges(id) not null,
  earnedAt timestamptz default now(),
  unique (memberId, badgeId)
);

alter table member_badges enable row level security;

create policy member_badges_own on member_badges
  for select using (auth.uid() = memberId);
create policy member_badges_read on member_badges
  for select using (auth.role() = 'authenticated'); -- public badge display
create policy member_badges_insert on member_badges
  for insert with check (auth.uid() = memberId);

-- ============================================================
-- Seed badges
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
('Founding Member', 'founding_member', 'Joined GDU XP in the first season', 'legendary', 'Star', '#FFD700', 500, '{"type": "join_date", "threshold": "season_1"}');

-- ============================================================
-- Function: award_badge — award a badge to a member
-- ============================================================

create function award_badge(p_member_id uuid, p_badge_id uuid) returns void as $$
declare
  v_exists boolean;
begin
  -- Check if already awarded
  select exists (select 1 from member_badges where member_id = p_member_id and badge_id = p_badge_id) into v_exists;

  if not v_exists then
    insert into member_badges (member_id, badge_id)
    values (p_member_id, p_badge_id);

    -- Award XP if badge has xpReward
    -- (XP is awarded via ledger_entries through claims, not directly here)

    insert into audit_log (actor_id, action, table_name, record_id, new_values)
    values (auth.uid(), 'badge.awarded', 'member_badges', null,
            jsonb_build_object('member_id', p_member_id, 'badge_id', p_badge_id));
  end if;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: check_and_award_badges — evaluate all badges for a member
-- ============================================================

create function check_and_award_badges(p_member_id uuid) returns void as $$
declare
  v_badge record;
  v_claim_count integer;
  v_review_count integer;
begin
  for v_badge in select * from badges where is_active loop
    -- Skip if already earned
    if exists (select 1 from member_badges where member_id = p_member_id and badge_id = v_badge.id) then
      continue;
    end if;

    -- Evaluate criteria
    case (v_badge.criteria->>'type')
      when 'claim_count' then
        select count(*) into v_claim_count from claims where claimant_id = p_member_id;
        if v_claim_count >= (v_badge.criteria->>'threshold')::int then
          perform award_badge(p_member_id, v_badge.id);
        end if;

      when 'review_count' then
        select count(*) into v_review_count from claims where reviewer_id = p_member_id;
        if v_review_count >= (v_badge.criteria->>'threshold')::int then
          perform award_badge(p_member_id, v_badge.id);
        end if;

      when 'activity_tag' then
        -- Check if member has claims with matching activity tags
        -- This requires joining claims with activity_types tags
        if exists (
          select 1 from claims c
          join activity_types at on at.id = c.activity_type_id
          where c.claimant_id = p_member_id
          and at.tags @> (v_badge.criteria->>'threshold')::jsonb
        ) then
          perform award_badge(p_member_id, v_badge.id);
        end if;

      when 'role_held' then
        if exists (
          select 1 from role_assignments ra
          where ra.profile_id = p_member_id
          and ra.role = v_badge.criteria->>'threshold'
          and ra.is_active = true
        ) then
          perform award_badge(p_member_id, v_badge.id);
        end if;

      when 'league_tier' then
        -- Check league tier from profiles
        if exists (
          select 1 from profiles p
          join league_tiers lt on lt.name = p.league_tier
          where p.id = p_member_id
          and lt.sort_order >= (
            select sort_order from league_tiers where name = v_badge.criteria->>'threshold'
          )
        ) then
          perform award_badge(p_member_id, v_badge.id);
        end if;
    end case;
  end loop;
end $$ language plpgsql security definer;

-- ============================================================
-- Trigger: check badges on claim approval
-- ============================================================

create function on_claim_approved() returns trigger as $$
begin
  perform check_and_award_badges(new.claimant_id);
  return new;
end $$ language plpgsql;

create trigger claim_approved_trigger
  after update of status on claims
  for each row
  when (old.status <> 'approved' and new.status = 'approved')
  execute function on_claim_approved();
