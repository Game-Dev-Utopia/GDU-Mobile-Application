-- Phase 4: Conduct Panel, penalties, probation

-- ============================================================
-- Conduct Cases
-- ============================================================

create table conduct_cases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  reason_code text not null,
  severity text not null check (severity in ('minor', 'moderate', 'severe')),
  description text not null,
  evidence_links text[] default '{}',
  filed_by uuid references profiles(id) not null,
  filed_at timestamptz default now(),
  status text not null default 'notice' check (status in ('notice', 'response', 'panel_review', 'decision', 'board_ratification', 'appeal', 'resolved')),
  notice_sent_at timestamptz,
  response_deadline timestamptz,
  response_submitted_at timestamptz,
  response_text text,
  panel_reviewed_at timestamptz,
  panel_reviewed_by uuid references profiles(id),
  panel_decision text,
  board_ratified_at timestamptz,
  board_ratified_by uuid references profiles(id),
  appeal_deadline timestamptz,
  appeal_submitted_at timestamptz,
  appeal_decision text,
  sensitive boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table conduct_cases enable row level security;

create policy conduct_cases_own on conduct_cases
  for select using (auth.uid() = member_id or auth.uid() = filed_by);
create policy conduct_cases_panel on conduct_cases
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'conduct_panel_member'))
  );
create policy conduct_cases_insert on conduct_cases
  for insert with check (auth.uid() = filed_by);
create policy conduct_cases_update on conduct_cases
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'conduct_panel_member'))
    or auth.uid() = filed_by
  );

-- ============================================================
-- Penalties
-- ============================================================

create table penalties (
  id uuid primary key default gen_random_uuid(),
  conduct_case_id uuid references conduct_cases(id),
  member_id uuid references profiles(id) not null,
  reason_code text not null,
  severity text not null check (severity in ('minor', 'moderate', 'severe')),
  exp_deduction integer default 0,
  description text not null,
  evidence_links text[] default '{}',
  filed_by uuid references profiles(id) not null,
  filed_at timestamptz default now(),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'applied', 'appealed', 'resolved')),
  appeal_deadline timestamptz,
  created_at timestamptz default now()
);

alter table penalties enable row level security;

create policy penalties_own on penalties
  for select using (auth.uid() = member_id or auth.uid() = filed_by);
create policy penalties_panel on penalties
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'conduct_panel_member'))
  );
create policy penalties_insert on penalties
  for insert with check (auth.uid() = filed_by);

-- ============================================================
-- Probation tracking
-- ============================================================

create table probation_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  stage text not null check (stage in ('healthy', 'at_risk', 'probation', 'hearing', 'decision', 'resolved')),
  reason text,
  support_plan text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table probation_records enable row level security;

create policy probation_own on probation_records
  for select using (auth.uid() = member_id);
create policy probation_panel on probation_records
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'conduct_panel_member'))
  );
create policy probation_insert on probation_records
  for insert with check (auth.uid() = member_id);

-- ============================================================
-- Leave of absence / exam freeze
-- ============================================================

create table leave_of_absence (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  reason text not null check (reason in ('exams', 'internship', 'personal', 'medical')),
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'active', 'ended')),
  approved_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table leave_of_absence enable row level security;

create policy loa_own on leave_of_absence
  for select using (auth.uid() = member_id);
create policy loa_panel on leave_of_absence
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'domain_head', 'council_member'))
  );

-- ============================================================
-- Function: file_conduct_case — file a new conduct case
-- ============================================================

create function file_conduct_case(
  p_member_id uuid,
  p_reason_code text,
  p_severity text,
  p_description text,
  p_evidence_links text[]
) returns uuid as $$
declare
  v_case_id uuid;
  v_filer record;
  v_target record;
begin
  select * into v_filer from profiles where id = auth.uid();
  if not found then
    raise exception 'Filer profile not found';
  end if;

  select * into v_target from profiles where id = p_member_id;
  if not found then
    raise exception 'Target member not found';
  end if;

  -- Cannot file against yourself
  if auth.uid() = p_member_id then
    raise exception 'Cannot file conduct case against yourself';
  end if;

  -- Severity-based authorization
  if p_severity = 'severe' then
    if v_filer.role not in ('board', 'admin', 'conduct_panel_member') then
      raise exception 'Only board, admin, or Conduct Panel can file severe cases';
    end if;
  elsif p_severity = 'moderate' then
    if v_filer.role not in ('board', 'admin', 'council_member', 'domain_head', 'conduct_panel_member') then
      raise exception 'Only council, domain head, board, admin, or Conduct Panel can file moderate cases';
    end if;
  else
    -- minor: team lead and above
    if v_filer.role not in ('board', 'admin', 'council_member', 'domain_head', 'team_lead', 'conduct_panel_member') then
      raise exception 'Insufficient permissions to file minor cases';
    end if;
  end if;

  insert into conduct_cases (member_id, reason_code, severity, description, evidence_links, filed_by, status)
  values (p_member_id, p_reason_code, p_severity, p_description, p_evidence_links, auth.uid(), 'notice')
  returning id into v_case_id;

  -- Set response deadline (7 days)
  update conduct_cases
  set response_deadline = now() + interval '7 days',
      notice_sent_at = now()
  where id = v_case_id;

  -- Create probation record if not exists
  insert into probation_records (member_id, stage, reason)
  values (p_member_id, 'at_risk', p_description)
  on conflict do nothing;

  -- Audit log
  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'conduct.case_filed', 'conduct_cases', v_case_id,
          jsonb_build_object('member_id', p_member_id, 'severity', p_severity, 'reason_code', p_reason_code));

  return v_case_id;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: respond_to_conduct_case — member responds to notice
-- ============================================================

create function respond_to_conduct_case(p_case_id uuid, p_response_text text) returns text as $$
declare
  v_case record;
begin
  select * into v_case from conduct_cases where id = p_case_id;
  if not found then
    raise exception 'Conduct case not found';
  end if;

  if auth.uid() <> v_case.member_id then
    raise exception 'Only the member can respond';
  end if;

  if v_case.status <> 'notice' then
    raise exception 'Case is not in notice stage';
  end if;

  if now() > v_case.response_deadline then
    raise exception 'Response deadline has passed';
  end if;

  update conduct_cases
  set status = 'response',
      response_submitted_at = now(),
      response_text = p_response_text
  where id = p_case_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'conduct.responded', 'conduct_cases', p_case_id,
          jsonb_build_object('response_text', p_response_text));

  return 'Response submitted.';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: panel_review_conduct_case — Conduct Panel review
-- ============================================================

create function panel_review_conduct_case(
  p_case_id uuid,
  p_decision text,
  p_reason text
) returns text as $$
declare
  v_case record;
  v_panel_member record;
begin
  select * into v_case from conduct_cases where id = p_case_id;
  if not found then
    raise exception 'Conduct case not found';
  end if;

  select * into v_panel_member from profiles where id = auth.uid();
  if not found then
    raise exception 'Reviewer profile not found';
  end if;

  if v_panel_member.role not in ('board', 'admin', 'conduct_panel_member') then
    raise exception 'Only Conduct Panel members can review cases';
  end if;

  if v_case.status <> 'response' then
    raise exception 'Case is not in response stage';
  end if;

  -- Recusal check: panel member cannot review their own case or cases involving close relations
  if auth.uid() = v_case.filed_by then
    raise exception 'Panel member who filed the case must recuse';
  end if;

  update conduct_cases
  set status = 'panel_review',
      panel_reviewed_at = now(),
      panel_reviewed_by = auth.uid(),
      panel_decision = p_decision
  where id = p_case_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'conduct.panel_reviewed', 'conduct_cases', p_case_id,
          jsonb_build_object('decision', p_decision, 'reason', p_reason));

  return 'Panel review completed.';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: board_ratify_conduct_case — Board ratifies panel decision
-- ============================================================

create function board_ratify_conduct_case(
  p_case_id uuid,
  p_ratified boolean,
  p_reason text
) returns text as $$
declare
  v_case record;
  v_board_member record;
begin
  select * into v_case from conduct_cases where id = p_case_id;
  if not found then
    raise exception 'Conduct case not found';
  end if;

  select * into v_board_member from profiles where id = auth.uid();
  if not found then
    raise exception 'Board member profile not found';
  end if;

  if v_board_member.role not in ('board', 'admin') then
    raise exception 'Only board members can ratify decisions';
  end if;

  if v_case.status <> 'panel_review' then
    raise exception 'Case is not in panel review stage';
  end if;

  update conduct_cases
  set status = case when p_ratified then 'board_ratification' else 'decision' end,
      board_ratified_at = now(),
      board_ratified_by = auth.uid()
  where id = p_case_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'conduct.board_ratified', 'conduct_cases', p_case_id,
          jsonb_build_object('ratified', p_ratified, 'reason', p_reason));

  return case when p_ratified then 'Decision ratified.' else 'Decision not ratified.' end;
end $$ language plpgsql security definer;
