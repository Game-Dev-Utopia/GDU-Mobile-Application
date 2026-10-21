-- Phase 7.3: Feedback 360

-- ============================================================
-- Feedback 360 Cycles (quarterly)
-- ============================================================

create table feedback_360_cycles (
  id uuid primary key default gen_random_uuid(),
  quarter_label text not null,
  quarter_start date not null,
  quarter_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz default now(),
  unique (quarter_label)
);

alter table feedback_360_cycles enable row level security;

create policy feedback_360_cycles_read on feedback_360_cycles
  for select using (auth.role() = 'authenticated');
create policy feedback_360_cycles_manage on feedback_360_cycles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Feedback 360 Responses (anonymous ratings + comment)
-- ============================================================

create table feedback_360_responses (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references feedback_360_cycles(id) not null,
  target_id uuid references profiles(id) not null,
  rater_id uuid references profiles(id), -- nullable for anonymity
  communication integer not null check (communication between 1 and 5),
  reliability integer not null check (reliability between 1 and 5),
  fairness integer not null check (fairness between 1 and 5),
  leadership integer not null check (leadership between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique (cycle_id, target_id, rater_id)
);

alter table feedback_360_responses enable row level security;

create policy feedback_360_responses_read on feedback_360_responses
  for select using (
    -- Raters see their own responses; panel/board see all; targets see aggregated only via view
    auth.uid() = rater_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin', 'conduct_panel_member'))
  );
create policy feedback_360_responses_insert on feedback_360_responses
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- View: feedback_360_summary (averages, only when >= 3 respondents)
-- ============================================================

create view feedback_360_summary as
select
  r.cycle_id,
  r.target_id,
  count(*) as respondent_count,
  round(avg(r.communication)::numeric, 2) as avg_communication,
  round(avg(r.reliability)::numeric, 2) as avg_reliability,
  round(avg(r.fairness)::numeric, 2) as avg_fairness,
  round(avg(r.leadership)::numeric, 2) as avg_leadership,
  round((avg(r.communication) + avg(r.reliability) + avg(r.fairness) + avg(r.leadership)) / 4::numeric, 2) as avg_overall,
  array_agg(r.comment) filter (where r.comment is not null) as comments
from feedback_360_responses r
group by r.cycle_id, r.target_id
having count(*) >= 3;

alter view feedback_360_summary owner to postgres;

grant select on feedback_360_summary to authenticated;

-- ============================================================
-- Function: submit_feedback_360_response
-- ============================================================

create function submit_feedback_360_response(
  p_cycle_id uuid,
  p_target_id uuid,
  p_communication integer,
  p_reliability integer,
  p_fairness integer,
  p_leadership integer,
  p_comment text
) returns text as $$
declare
  v_cycle record;
  v_target record;
begin
  select * into v_cycle from feedback_360_cycles where id = p_cycle_id;
  if not found then
    raise exception 'Feedback cycle not found';
  end if;

  if v_cycle.status <> 'open' then
    raise exception 'Feedback cycle is not open';
  end if;

  select * into v_target from profiles where id = p_target_id;
  if not found then
    raise exception 'Target member not found';
  end if;

  -- Target must be a position holder (board, council_member, domain_head, faculty)
  if v_target.role not in ('board_member', 'council_member', 'domain_head', 'faculty', 'admin') then
    raise exception 'Target is not a position holder';
  end if;

  -- Cannot rate yourself
  if auth.uid() = p_target_id then
    raise exception 'Cannot rate yourself';
  end if;

  insert into feedback_360_responses (cycle_id, target_id, rater_id, communication, reliability, fairness, leadership, comment)
  values (p_cycle_id, p_target_id, auth.uid(), p_communication, p_reliability, p_fairness, p_leadership, p_comment)
  on conflict (cycle_id, target_id, rater_id) do update
  set communication = excluded.communication,
      reliability = excluded.reliability,
      fairness = excluded.fairness,
      leadership = excluded.leadership,
      comment = excluded.comment,
      created_at = now();

  return 'Response submitted';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: close_feedback_360_cycle
-- ============================================================

create function close_feedback_360_cycle(p_cycle_id uuid) returns text as $$
declare
  v_cycle record;
begin
  select * into v_cycle from feedback_360_cycles where id = p_cycle_id;
  if not found then
    raise exception 'Feedback cycle not found';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin')) then
    raise exception 'Only board or admin can close a cycle';
  end if;

  update feedback_360_cycles
  set status = 'closed'
  where id = p_cycle_id;

  return 'Cycle closed';
end $$ language plpgsql security definer;
