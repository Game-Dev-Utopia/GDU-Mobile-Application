-- Phase 7.2: Conduct and Probation

-- ============================================================
-- Conduct Panel Members (panel of 5 with recusal indicators)
-- ============================================================

create table conduct_panel_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null unique,
  is_recused boolean not null default false,
  recused_at timestamptz,
  recusal_reason text,
  appointed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table conduct_panel_members enable row level security;

create policy conduct_panel_members_read on conduct_panel_members
  for select using (auth.role() = 'authenticated');
create policy conduct_panel_members_manage on conduct_panel_members
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Conduct Case Appeals (dedicated appeals table)
-- ============================================================

create table conduct_case_appeals (
  id uuid primary key default gen_random_uuid(),
  conduct_case_id uuid references conduct_cases(id) not null,
  appellant_id uuid references profiles(id) not null,
  appeal_reason text not null,
  status text not null default 'pending' check (status in ('pending', 'upheld', 'overturned')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz default now(),
  unique (conduct_case_id, appellant_id)
);

alter table conduct_case_appeals enable row level security;

create policy conduct_case_appeals_read on conduct_case_appeals
  for select using (
    auth.uid() = appellant_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'conduct_panel_member'))
  );
create policy conduct_case_appeals_manage on conduct_case_appeals
  for all using (
    auth.uid() = appellant_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Probation Records - 60-day grace for new position holders
-- ============================================================

alter table probation_records
  add column if not exists position_started_at date,
  add column if not exists grace_period_days integer default 60,
  add column if not exists grace_expires_at timestamptz;

-- ============================================================
-- Leave of Absence - freeze requests
-- ============================================================

alter table leave_of_absence
  add column if not exists is_freeze_request boolean not null default false,
  add column if not exists freeze_reason text,
  add column if not exists frozen_at timestamptz;

-- ============================================================
-- Function: appoint_conduct_panel_member
-- ============================================================

create function appoint_conduct_panel_member(p_profile_id uuid) returns text as $$
declare
  v_count integer;
begin
  -- Only board or admin can appoint
  if not exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin')) then
    raise exception 'Only board or admin can appoint panel members';
  end if;

  -- Max 5 panel members
  select count(*) into v_count from conduct_panel_members;
  if v_count >= 5 then
    raise exception 'Conduct panel already has 5 members';
  end if;

  insert into conduct_panel_members (profile_id)
  values (p_profile_id)
  on conflict (profile_id) do update
  set is_recused = false,
      recused_at = null,
      recusal_reason = null;

  return 'Panel member appointed';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: recuse_panel_member
-- ============================================================

create function recuse_panel_member(p_case_id uuid, p_reason text) returns text as $$
declare
  v_panel_member record;
  v_case record;
begin
  select * into v_case from conduct_cases where id = p_case_id;
  if not found then
    raise exception 'Conduct case not found';
  end if;

  select * into v_panel_member from conduct_panel_members where profile_id = auth.uid();
  if not found then
    raise exception 'Not a conduct panel member';
  end if;

  update conduct_panel_members
  set is_recused = true,
      recused_at = now(),
      recusal_reason = p_reason
  where profile_id = auth.uid();

  return 'Recused from panel';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: file_conduct_case_appeal
-- ============================================================

create function file_conduct_case_appeal(
  p_conduct_case_id uuid,
  p_appellant_id uuid,
  p_appeal_reason text
) returns text as $$
declare
  v_case record;
  v_existing_appeal record;
begin
  select * into v_case from conduct_cases where id = p_conduct_case_id;
  if not found then
    raise exception 'Conduct case not found';
  end if;

  if auth.uid() <> p_appellant_id then
    raise exception 'Only the appellant can file an appeal';
  end if;

  select * into v_existing_appeal from conduct_case_appeals where conduct_case_id = p_conduct_case_id and appellant_id = p_appellant_id;
  if found then
    raise exception 'Appeal already filed for this case';
  end if;

  insert into conduct_case_appeals (conduct_case_id, appellant_id, appeal_reason)
  values (p_conduct_case_id, p_appellant_id, p_appeal_reason);

  update conduct_cases
  set status = 'appeal',
      appeal_deadline = now() + interval '14 days'
  where id = p_conduct_case_id;

  return 'Appeal filed';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: decide_conduct_case_appeal
-- ============================================================

create function decide_conduct_case_appeal(
  p_appeal_id uuid,
  p_decider_id uuid,
  p_status text,
  p_decision_reason text
) returns text as $$
declare
  v_appeal record;
begin
  select * into v_appeal from conduct_case_appeals where id = p_appeal_id;
  if not found then
    raise exception 'Appeal not found';
  end if;

  if v_appeal.status <> 'pending' then
    raise exception 'Appeal already decided';
  end if;

  if p_status not in ('upheld', 'overturned') then
    raise exception 'Invalid appeal status';
  end if;

  -- Only board or admin can decide appeals
  if not exists (select 1 from profiles where id = p_decider_id and role in ('board', 'admin')) then
    raise exception 'Only board or admin can decide appeals';
  end if;

  update conduct_case_appeals
  set status = p_status,
      decided_by = p_decider_id,
      decided_at = now(),
      decision_reason = p_decision_reason
  where id = p_appeal_id;

  update conduct_cases
  set status = case when p_status = 'overturned' then 'decision' else 'resolved' end
  where id = v_appeal.conduct_case_id;

  return 'Appeal decided';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: request_leave_of_absence_freeze
-- ============================================================

create function request_leave_of_absence_freeze(
  p_member_id uuid,
  p_reason text,
  p_start_date date,
  p_end_date date,
  p_freeze_reason text
) returns text as $$
declare
  v_member record;
begin
  select * into v_member from profiles where id = p_member_id;
  if not found then
    raise exception 'Member not found';
  end if;

  if auth.uid() <> p_member_id then
    raise exception 'Only the member can request a freeze';
  end if;

  insert into leave_of_absence (member_id, reason, start_date, end_date, status, is_freeze_request, freeze_reason)
  values (p_member_id, p_reason, p_start_date, p_end_date, 'pending', true, p_freeze_reason);

  return 'Freeze request submitted';
end $$ language plpgsql security definer;
