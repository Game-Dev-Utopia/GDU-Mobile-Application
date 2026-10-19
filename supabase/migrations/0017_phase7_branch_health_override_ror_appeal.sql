-- Phase 7.1: Branch Health - Override Right of Reply & Appeal

-- Add decision columns to branch_override_cases (missing from 0011)
alter table branch_override_cases
  add column if not exists board_decision_reason text,
  add column if not exists board_yes_votes integer,
  add column if not exists board_total_votes integer;

-- ============================================================
-- Branch Override Right of Reply
-- Branch council, faculty coordinator, and college student council
-- are notified (no veto) before a board decision is finalised.
-- ============================================================

create table branch_override_right_of_reply (
  id uuid primary key default gen_random_uuid(),
  override_case_id uuid references branch_override_cases(id) not null,
  respondent_role text not null check (respondent_role in ('branch_council', 'faculty_coordinator', 'college_student_council')),
  respondent_id uuid references profiles(id) not null,
  reply_text text not null,
  submitted_at timestamptz default now(),
  unique (override_case_id, respondent_role, respondent_id)
);

alter table branch_override_right_of_reply enable row level security;

create policy branch_override_ror_read on branch_override_right_of_reply
  for select using (auth.role() = 'authenticated');
create policy branch_override_ror_manage on branch_override_right_of_reply
  for all using (
    auth.uid() = respondent_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Branch Override Appeal
-- One appeal allowed against a board decision.
-- ============================================================

create table branch_override_appeals (
  id uuid primary key default gen_random_uuid(),
  override_case_id uuid references branch_override_cases(id) not null,
  appellant_id uuid references profiles(id) not null,
  appeal_reason text not null,
  status text not null default 'pending' check (status in ('pending', 'upheld', 'overturned')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz default now(),
  unique (override_case_id, appellant_id)
);

alter table branch_override_appeals enable row level security;

create policy branch_override_appeal_read on branch_override_appeals
  for select using (auth.role() = 'authenticated');
create policy branch_override_appeal_manage on branch_override_appeals
  for all using (
    auth.uid() = appellant_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Function: submit_branch_override_right_of_reply
-- ============================================================

create function submit_branch_override_right_of_reply(
  p_override_case_id uuid,
  p_respondent_role text,
  p_respondent_id uuid,
  p_reply_text text
) returns text as $$
declare
  v_case record;
begin
  select * into v_case from branch_override_cases where id = p_override_case_id;
  if not found then
    raise exception 'Override case not found';
  end if;

  insert into branch_override_right_of_reply (override_case_id, respondent_role, respondent_id, reply_text)
  values (p_override_case_id, p_respondent_role, p_respondent_id, p_reply_text)
  on conflict (override_case_id, respondent_role, respondent_id) do update
  set reply_text = excluded.reply_text,
      submitted_at = now();

  return 'Right of reply submitted';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: file_branch_override_appeal
-- ============================================================

create function file_branch_override_appeal(
  p_override_case_id uuid,
  p_appellant_id uuid,
  p_appeal_reason text
) returns text as $$
declare
  v_case record;
  v_existing_appeal record;
begin
  select * into v_case from branch_override_cases where id = p_override_case_id;
  if not found then
    raise exception 'Override case not found';
  end if;

  -- Only one appeal allowed per case
  select * into v_existing_appeal from branch_override_appeals where override_case_id = p_override_case_id;
  if found then
    raise exception 'Appeal already filed for this case';
  end if;

  insert into branch_override_appeals (override_case_id, appellant_id, appeal_reason)
  values (p_override_case_id, p_appellant_id, p_appeal_reason);

  return 'Appeal filed';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: decide_branch_override
-- Board makes the final decision on an override case.
-- Decision options: extend, supervised_admin, merge_dormant, wind_down
-- Supervised administration requires 3/5 board concurrence.
-- Wind-down requires 4/5 board concurrence.
-- ============================================================

create function decide_branch_override(
  p_override_case_id uuid,
  p_decider_id uuid,
  p_decision text,
  p_decision_reason text,
  p_board_yes_votes integer,
  p_board_total_votes integer
) returns text as $$
declare
  v_case record;
  v_shadow boolean;
begin
  select * into v_case from branch_override_cases where id = p_override_case_id;
  if not found then
    raise exception 'Override case not found';
  end if;

  if v_case.board_decision is not null then
    raise exception 'Decision already made';
  end if;

  -- Validate decision threshold
  if p_decision = 'supervised_admin' then
    if p_board_yes_votes < 3 or p_board_total_votes < 5 then
      raise exception 'Supervised administration requires 3/5 board concurrence';
    end if;
  elsif p_decision = 'wind_down' then
    if p_board_yes_votes < 4 or p_board_total_votes < 5 then
      raise exception 'Wind-down requires 4/5 board concurrence';
    end if;
  end if;

  select shadow_mode into v_shadow from branch_health_config order by effective_from desc limit 1;

  update branch_override_cases
  set board_decision = p_decision,
      board_decision_reason = p_decision_reason,
      board_decision_at = now(),
      board_yes_votes = p_board_yes_votes,
      board_total_votes = p_board_total_votes,
      shadow_mode = v_shadow
  where id = p_override_case_id;

  return 'Decision recorded';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: decide_branch_override_appeal
-- Board decides on an appeal (uphold or overturn).
-- ============================================================

create function decide_branch_override_appeal(
  p_appeal_id uuid,
  p_decider_id uuid,
  p_status text,
  p_decision_reason text
) returns text as $$
declare
  v_appeal record;
begin
  select * into v_appeal from branch_override_appeals where id = p_appeal_id;
  if not found then
    raise exception 'Appeal not found';
  end if;

  if v_appeal.status <> 'pending' then
    raise exception 'Appeal already decided';
  end if;

  if p_status not in ('upheld', 'overturned') then
    raise exception 'Invalid appeal status';
  end if;

  update branch_override_appeals
  set status = p_status,
      decided_by = p_decider_id,
      decided_at = now(),
      decision_reason = p_decision_reason
  where id = p_appeal_id;

  return 'Appeal decided';
end $$ language plpgsql security definer;
