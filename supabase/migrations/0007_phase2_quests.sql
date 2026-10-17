-- Phase 2: Quests system

-- ============================================================
-- Quest definitions (weekly, seasonal, team quests)
-- ============================================================

create table quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null check (type in ('weekly', 'seasonal', 'team', 'one_time')),
  xpReward integer not null,
  coinReward integer default 0,
  criteria jsonb not null, -- e.g. {"type": "claim_count", "threshold": 3, "period": "weekly"}
  startsAt timestamptz not null,
  endsAt timestamptz not null,
  isActive boolean default true,
  maxParticipants integer, -- null = unlimited
  createdAt timestamptz default now()
);

alter table quests enable row level security;

create policy quests_read on quests
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Member quests (quest progress per member)
-- ============================================================

create table member_quests (
  id uuid primary key default gen_random_uuid(),
  memberId uuid references profiles(id) not null,
  questId uuid references quests(id) not null,
  progress integer default 0,
  completed boolean default false,
  claimed boolean default false,
  startedAt timestamptz default now(),
  completedAt timestamptz,
  claimedAt timestamptz,
  unique (memberId, questId)
);

alter table member_quests enable row level security;

create policy member_quests_own on member_quests
  for select using (auth.uid() = memberId);
create policy member_quests_read on member_quests
  for select using (auth.role() = 'authenticated');
create policy member_quests_insert on member_quests
  for insert with check (auth.uid() = memberId);
create policy member_quests_update on member_quests
  for update using (auth.uid() = memberId);

-- ============================================================
-- Seed quests (weekly quests that reset each week)
-- ============================================================

insert into quests (title, description, type, xpReward, coinReward, criteria, startsAt, endsAt, isActive, maxParticipants) values
('First Steps', 'Submit your first claim this week', 'weekly', 50, 5, '{"type": "claim_count", "threshold": 1, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Active Contributor', 'Submit 3 claims this week', 'weekly', 150, 10, '{"type": "claim_count", "threshold": 3, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Top Contributor', 'Submit 5 claims this week', 'weekly', 300, 25, '{"type": "claim_count", "threshold": 5, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Reviewer', 'Review 2 claims this week', 'weekly', 100, 5, '{"type": "review_count", "threshold": 2, "period": "weekly"}', now() - interval '7 days', now() + interval '7 days', true, null),
('Season Starter', 'Earn 1000 EXP this season', 'seasonal', 500, 50, '{"type": "season_exp", "threshold": 1000}', now() - interval '90 days', now() + interval '90 days', true, null),
('Season Champion', 'Earn 5000 EXP this season', 'seasonal', 2000, 100, '{"type": "season_exp", "threshold": 5000}', now() - interval '90 days', now() + interval '90 days', true, null),
('Jam Participant', 'Participate in a game jam', 'one_time', 200, 20, '{"type": "activity_tag", "threshold": "jam"}', now() - interval '90 days', now() + interval '90 days', true, null),
('Mentor', 'Mentor a newcomer', 'one_time', 150, 15, '{"type": "activity_tag", "threshold": "mentoring"}', now() - interval '90 days', now() + interval '90 days', true, null);

-- ============================================================
-- Function: get_or_create_member_quest — ensure member has a quest record
-- ============================================================

create function get_or_create_member_quest(p_member_id uuid, p_quest_id uuid) returns uuid as $$
declare
  v_member_quest_id uuid;
begin
  select id into v_member_quest_id
  from member_quests
  where member_id = p_member_id and quest_id = p_quest_id;

  if v_member_quest_id is null then
    insert into member_quests (member_id, quest_id, progress, completed, claimed)
    values (p_member_id, p_quest_id, 0, false, false)
    returning id into v_member_quest_id;
  end if;

  return v_member_quest_id;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: update_quest_progress — increment progress on a quest
-- ============================================================

create function update_quest_progress(p_member_id uuid, p_quest_id uuid, p_increment integer default 1) returns void as $$
declare
  v_mq_id uuid;
  v_quest record;
  v_progress integer;
begin
  select id into v_mq_id
  from member_quests
  where member_id = p_member_id and quest_id = p_quest_id;

  if v_mq_id is null then
    select get_or_create_member_quest(p_member_id, p_quest_id) into v_mq_id;
  end if;

  select * into v_quest from quests where id = p_quest_id;

  update member_quests
  set progress = progress + p_increment,
      completed = case when progress + p_increment >= (v_quest.criteria->>'threshold')::int then true else completed end,
      completedAt = case when progress + p_increment >= (v_quest.criteria->>'threshold')::int and completed = false then now() else completedAt end
  where id = v_mq_id;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: claim_quest_reward — claim XP reward for completed quest
-- ============================================================

create function claim_quest_reward(p_member_quest_id uuid) returns integer as $$
declare
  v_mq record;
  v_xp_reward integer;
begin
  select * into v_mq from member_quests where id = p_member_quest_id;
  if not found then
    raise exception 'Member quest not found';
  end if;

  if not v_mq.completed then
    raise exception 'Quest not completed';
  end if;

  if v_mq.claimed then
    raise exception 'Quest reward already claimed';
  end if;

  select xpReward into v_xp_reward from quests where id = v_mq.quest_id;

  update member_quests
  set claimed = true, claimedAt = now()
  where id = p_member_quest_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'quest.reward_claimed', 'member_quests', p_member_quest_id,
          jsonb_build_object('quest_id', v_mq.quest_id, 'xp_reward', v_xp_reward));

  return v_xp_reward;
end $$ language plpgsql security definer;

-- ============================================================
-- Trigger: update quest progress when claim is approved
-- ============================================================

create function on_claim_approved_for_quests() returns trigger as $$
declare
  v_quests record;
begin
  -- For weekly quests with claim_count criteria, update progress
  for v_quests in
    select q.id, mq.id as mq_id, mq.progress, mq.completed
    from quests q
    join member_quests mq on mq.quest_id = q.id
    where mq.member_id = new.claimant_id
      and mq.completed = false
      and q.type = 'weekly'
      and q.criteria->>'type' = 'claim_count'
  loop
    perform update_quest_progress(new.claimant_id, v_quests.id, 1);
  end loop;

  return new;
end $$ language plpgsql;

create trigger claim_approved_for_quests_trigger
  after update of status on claims
  for each row
  when (old.status <> 'approved' and new.status = 'approved')
  execute function on_claim_approved_for_quests();
