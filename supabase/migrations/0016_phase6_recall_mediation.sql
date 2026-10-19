-- Phase 6: Recall and Mediation backend

-- ============================================================
-- Recall Petitions (signature tracking for recall motions)
-- ============================================================

create table recall_petitions (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid references motions(id) not null unique,
  required_signatures integer not null,
  current_signatures integer not null default 0,
  threshold_reached_at timestamptz,
  created_at timestamptz default now()
);

alter table recall_petitions enable row level security;

create policy recall_petitions_read on recall_petitions
  for select using (auth.role() = 'authenticated');
create policy recall_petitions_manage on recall_petitions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Recall Petition Signatures
-- ============================================================

create table recall_signatures (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid references recall_petitions(id) not null,
  signer_id uuid references profiles(id) not null,
  signed_at timestamptz default now(),
  unique (petition_id, signer_id)
);

alter table recall_signatures enable row level security;

create policy recall_signatures_read on recall_signatures
  for select using (auth.role() = 'authenticated');
create policy recall_signatures_create on recall_signatures
  for insert with check (auth.uid() = signer_id);

-- ============================================================
-- Right of Reply (accused response to recall)
-- ============================================================

create table right_of_reply (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid references motions(id) not null unique,
  respondent_id uuid references profiles(id) not null,
  reply_text text not null,
  submitted_at timestamptz default now()
);

alter table right_of_reply enable row level security;

create policy right_of_reply_read on right_of_reply
  for select using (auth.role() = 'authenticated');
create policy right_of_reply_manage on right_of_reply
  for all using (
    auth.uid() = respondent_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Mediation Cases (faculty mediator view)
-- ============================================================

create table mediation_cases (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid references motions(id),
  disputed_jurisdiction text check (disputed_jurisdiction in ('org', 'branch', 'concurrent')),
  classified_by uuid references profiles(id),
  classification text check (classification in ('org', 'branch', 'concurrent')),
  deadline timestamptz, -- 72 hours from creation
  status text not null default 'pending' check (status in ('pending', 'classified', 'mediated', 'resolved')),
  resolution text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table mediation_cases enable row level security;

create policy mediation_cases_read on mediation_cases
  for select using (auth.role() = 'authenticated');
create policy mediation_cases_manage on mediation_cases
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('faculty', 'board', 'admin'))
  );

-- ============================================================
-- Function: sign_recall_petition — add a signature to a recall petition
-- ============================================================

create function sign_recall_petition(p_petition_id uuid, p_signer_id uuid) returns text as $$
declare
  v_petition record;
  v_new_count integer;
begin
  select * into v_petition from recall_petitions where id = p_petition_id;
  if not found then
    raise exception 'Petition not found';
  end if;

  -- Check if already signed
  if exists (select 1 from recall_signatures where petition_id = p_petition_id and signer_id = p_signer_id) then
    return 'Already signed';
  end if;

  insert into recall_signatures (petition_id, signer_id)
  values (p_petition_id, p_signer_id);

  select count(*) into v_new_count
  from recall_signatures where petition_id = p_petition_id;

  update recall_petitions
  set current_signatures = v_new_count
  where id = p_petition_id;

  -- Check if threshold reached
  if v_new_count >= v_petition.required_signatures and v_petition.threshold_reached_at is null then
    update recall_petitions
    set threshold_reached_at = now()
    where id = p_petition_id;
  end if;

  return 'Signed';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: submit_right_of_reply — accused submits their reply
-- ============================================================

create function submit_right_of_reply(p_motion_id uuid, p_respondent_id uuid, p_reply_text text) returns text as $$
declare
  v_motion record;
begin
  select * into v_motion from motions where id = p_motion_id;
  if not found then
    raise exception 'Motion not found';
  end if;

  if v_motion.tier <> 'recall' then
    raise exception 'Right of reply only available for recall motions';
  end if;

  insert into right_of_reply (motion_id, respondent_id, reply_text)
  values (p_motion_id, p_respondent_id, p_reply_text)
  on conflict (motion_id) do update
  set reply_text = excluded.reply_text,
      submitted_at = now();

  return 'Reply submitted';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: classify_jurisdiction — faculty classifies disputed jurisdiction
-- ============================================================

create function classify_jurisdiction(p_case_id uuid, p_classifier_id uuid, p_classification text) returns text as $$
declare
  v_case record;
begin
  select * into v_case from mediation_cases where id = p_case_id;
  if not found then
    raise exception 'Mediation case not found';
  end if;

  if v_case.status <> 'pending' then
    raise exception 'Case already resolved';
  end if;

  update mediation_cases
  set classified_by = p_classifier_id,
      classification = p_classification,
      status = 'classified',
      resolved_at = now()
  where id = p_case_id;

  return 'Classified';
end $$ language plpgsql security definer;

-- ============================================================
-- Function: mediate_deadlock — faculty resolves a deadlocked recall
-- ============================================================

create function mediate_deadlock(p_case_id uuid, p_mediator_id uuid, p_resolution text) returns text as $$
declare
  v_case record;
begin
  select * into v_case from mediation_cases where id = p_case_id;
  if not found then
    raise exception 'Mediation case not found';
  end if;

  if v_case.status <> 'classified' then
    raise exception 'Case must be classified before mediation';
  end if;

  update mediation_cases
  set resolved_at = now(),
      resolution = p_resolution,
      status = 'mediated'
  where id = p_case_id;

  return 'Mediated';
end $$ language plpgsql security definer;
