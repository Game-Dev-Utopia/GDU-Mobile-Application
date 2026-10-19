-- Phase 3: Motions + Voting backend

-- ============================================================
-- Motions (three-list governance)
-- ============================================================

create table motions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  text text not null,
  tier text not null check (tier in ('ordinary', 'serious', 'constitutional', 'recall')),
  jurisdiction text not null check (jurisdiction in ('org', 'branch', 'concurrent')),
  status text not null default 'draft' check (status in ('draft', 'open', 'voting', 'result', 'closed')),
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  objection_window_deadline timestamptz,
  result text,
  result_details jsonb,
  attachment_urls text[] default '{}'
);

alter table motions enable row level security;

create policy motions_read on motions
  for select using (auth.role() = 'authenticated');
create policy motions_create on motions
  for insert with check (auth.uid() = created_by);
create policy motions_update on motions
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
    or auth.uid() = created_by
  );

-- ============================================================
-- Ballots (votes)
-- ============================================================

create table ballots (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid references motions(id) not null,
  voter_id uuid references profiles(id) not null,
  vote text not null check (vote in ('yes', 'no', 'abstain')),
  chamber text not null check (chamber in ('board', 'council', 'members')),
  weight numeric not null default 1,
  created_at timestamptz default now(),
  unique (motion_id, voter_id)
);

alter table ballots enable row level security;

create policy ballots_read on ballots
  for select using (auth.role() = 'authenticated');
create policy ballots_create on ballots
  for insert with check (auth.uid() = voter_id);

-- ============================================================
-- List Schedule (when each list meets)
-- ============================================================

create table list_schedule (
  id uuid primary key default gen_random_uuid(),
  list_name text not null check (list_name in ('org', 'branch', 'concurrent')),
  meeting_day text not null, -- day of week
  meeting_time time not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table list_schedule enable row level security;

create policy list_schedule_read on list_schedule
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Motion Config (quorums, weights, thresholds)
-- ============================================================

create table motion_config (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  effective_from timestamptz not null default now(),
  board_weight numeric not null default 40, -- %
  council_weight numeric not null default 35,
  member_weight numeric not null default 25,
  board_quorum integer not null default 3, -- of 5
  council_quorum_percent numeric not null default 50, -- %
  ordinary_threshold numeric not null default 50, -- % of weight cast
  serious_threshold numeric not null default 66.67, -- %
  constitutional_threshold numeric not null default 66.67, -- %
  recall_threshold numeric not null default 66.67, -- %
  recall_board_concurrence integer not null default 2, -- of other 4
  shadow_mode boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table motion_config enable row level security;

create policy motion_config_read on motion_config
  for select using (auth.role() = 'authenticated');
create policy motion_config_manage on motion_config
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Seed default motion config
-- ============================================================

insert into motion_config (version_label, board_weight, council_weight, member_weight,
                           board_quorum, council_quorum_percent,
                           ordinary_threshold, serious_threshold,
                           constitutional_threshold, recall_threshold,
                           recall_board_concurrence, shadow_mode)
values ('v1', 40, 35, 25, 3, 50, 50, 66.67, 66.67, 66.67, 2, true)
on conflict do nothing;

-- ============================================================
-- Seed list schedule
-- ============================================================

insert into list_schedule (list_name, meeting_day, meeting_time, frequency, is_active) values
('org', 'Monday', '10:00:00', 'weekly', true),
('branch', 'Tuesday', '10:00:00', 'weekly', true),
('concurrent', 'Wednesday', '10:00:00', 'biweekly', true)
on conflict do nothing;

-- ============================================================
-- Function: compute_motion_result — tally votes and determine pass/fail
-- ============================================================

create function compute_motion_result(p_motion_id uuid) returns jsonb as $$
declare
  v_motion record;
  v_config record;
  v_board_yes numeric := 0;
  v_board_total numeric := 0;
  v_council_yes numeric := 0;
  v_council_total numeric := 0;
  v_member_yes numeric := 0;
  v_member_total numeric := 0;
  v_total_weight numeric := 0;
  v_total_yes numeric := 0;
  v_result text;
  v_details jsonb;
begin
  select * into v_motion from motions where id = p_motion_id;
  if not found then
    raise exception 'Motion not found';
  end if;

  select * into v_config from motion_config order by effective_from desc limit 1;

  -- Tally votes by chamber
  select coalesce(sum(weight), 0) into v_board_total
  from ballots b
  join profiles p on p.id = b.voter_id
  where b.motion_id = p_motion_id
    and b.chamber = 'board'
    and p.role = 'board_member';

  select coalesce(sum(weight), 0) into v_board_yes
  from ballots b
  join profiles p on p.id = b.voter_id
  where b.motion_id = p_motion_id
    and b.chamber = 'board'
    and p.role = 'board_member'
    and b.vote = 'yes';

  select coalesce(sum(weight), 0) into v_council_total
  from ballots b
  join profiles p on p.id = b.voter_id
  where b.motion_id = p_motion_id
    and b.chamber = 'council'
    and p.role in ('domain_head', 'council_member', 'board_member');

  select coalesce(sum(weight), 0) into v_council_yes
  from ballots b
  join profiles p on p.id = b.voter_id
  where b.motion_id = p_motion_id
    and b.chamber = 'council'
    and p.role in ('domain_head', 'council_member', 'board_member')
    and b.vote = 'yes';

  select coalesce(sum(weight), 0) into v_member_total
  from ballots b
  where b.motion_id = p_motion_id
    and b.chamber = 'members';

  select coalesce(sum(weight), 0) into v_member_yes
  from ballots b
  where b.motion_id = p_motion_id
    and b.chamber = 'members'
    and b.vote = 'yes';

  v_total_weight := v_board_total + v_council_total + v_member_total;
  v_total_yes := v_board_yes + v_council_yes + v_member_yes;

  -- Determine pass/fail based on tier and jurisdiction
  if v_motion.tier = 'recall' then
    -- Recall: 2/3 weighted AND at least 2 of other 4 board members concur
    declare
      v_board_concurrence integer;
    begin
      select count(*) into v_board_concurrence
      from ballots b
      join profiles p on p.id = b.voter_id
      where b.motion_id = p_motion_id
        and b.chamber = 'board'
        and p.role = 'board_member'
        and p.id <> v_motion.created_by -- accused recused
        and b.vote = 'yes';

      if v_total_weight > 0 and (v_total_yes / v_total_weight * 100) >= v_config.recall_threshold
         and v_board_concurrence >= v_config.recall_board_concurrence then
        v_result := 'passed';
      else
        v_result := 'failed';
      end if;
    end;
  elsif v_motion.tier in ('serious', 'constitutional') then
    -- 2/3 weighted AND majority in both board and council
    if v_total_weight > 0
       and (v_total_yes / v_total_weight * 100) >= v_config.constitutional_threshold
       and v_board_total > 0 and (v_board_yes / v_board_total * 100) > 50
       and v_council_total > 0 and (v_council_yes / v_council_total * 100) > 50 then
      v_result := 'passed';
    else
      v_result := 'failed';
    end if;
  else
    -- Ordinary: over 50% of weight cast
    if v_total_weight > 0 and (v_total_yes / v_total_weight * 100) > v_config.ordinary_threshold then
      v_result := 'passed';
    else
      v_result := 'failed';
    end if;
  end if;

  v_details := jsonb_build_object(
    'board', jsonb_build_object('yes', v_board_yes, 'total', v_board_total),
    'council', jsonb_build_object('yes', v_council_yes, 'total', v_council_total),
    'members', jsonb_build_object('yes', v_member_yes, 'total', v_member_total),
    'total_weight', v_total_weight,
    'total_yes', v_total_yes,
    'pass_rate', case when v_total_weight > 0 then round(v_total_yes / v_total_weight * 100, 2) else 0 end,
    'result', v_result
  );

  -- Update motion
  update motions
  set status = 'result',
      closed_at = now(),
      result = v_result,
      result_details = v_details
  where id = p_motion_id;

  return v_details;
end $$ language plpgsql security definer;

-- ============================================================
-- View: motion results summary
-- ============================================================

create view motion_summary_view as
select m.id, m.title, m.text, m.tier, m.jurisdiction, m.status,
       m.created_by, p.display_name as proposer_name,
       m.created_at, m.opened_at, m.closed_at,
       m.result, m.result_details,
       (select count(*) from ballots b where b.motion_id = m.id) as vote_count
from motions m
join profiles p on p.id = m.created_by
order by m.created_at desc;

-- ============================================================
-- Motion Discussions (comment thread on each motion)
-- ============================================================

create table motion_discussions (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid references motions(id) not null,
  author_id uuid references profiles(id) not null,
  body text not null,
  parent_id uuid references motion_discussions(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table motion_discussions enable row level security;

create policy motion_discussions_read on motion_discussions
  for select using (auth.role() = 'authenticated');
create policy motion_discussions_create on motion_discussions
  for insert with check (auth.uid() = author_id);
create policy motion_discussions_update on motion_discussions
  for update using (auth.uid() = author_id);

