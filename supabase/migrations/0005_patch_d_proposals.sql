-- Patch D: Propose new activity + approvals inbox

-- ============================================================
-- Activity Proposals (propose → senior approval → admin approval → live)
-- ============================================================

create table activity_proposals (
  id uuid primary key default gen_random_uuid(),
  proposed_by uuid references profiles(id) not null,
  name text not null,
  category text not null check (category in (
    'technology_innovation_wisdom',
    'motivation_initiative_learning_mindset',
    'social_soft_skills',
    'leadership_management'
  )),
  subcategory_id uuid references activity_subcategories(id),
  domain_id uuid references domains(id),
  exp_min integer not null,
  exp_max integer not null,
  season_cap integer,
  difficulty integer default 3 check (difficulty between 1 and 5),
  evidence_required boolean default true,
  approvers_needed integer default 1 check (approvers_needed in (1, 2, 3)),
  description text,
  justification text not null, -- why this activity matters
  status text not null default 'proposed' check (status in ('proposed', 'senior_approved', 'admin_approved', 'live', 'rejected')),
  senior_approved_by uuid references profiles(id),
  senior_approved_at timestamptz,
  admin_approved_by uuid references profiles(id),
  admin_approved_at timestamptz,
  activity_type_id uuid references activity_types(id), -- set when approved to live
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table activity_proposals enable row level security;

create policy activity_proposals_own on activity_proposals
  for select using (auth.uid() = proposed_by);
create policy activity_proposals_approver on activity_proposals
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('domain_head', 'team_lead', 'board', 'admin'))
  );
create policy activity_proposals_insert on activity_proposals
  for insert with check (auth.uid() = proposed_by);
create policy activity_proposals_update on activity_proposals
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('domain_head', 'team_lead', 'board', 'admin'))
  );

-- ============================================================
-- Approvals Inbox (generic pending items across types)
-- ============================================================

create table approval_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('activity_proposal', 'claim', 'spot_award', 'penalty', 'motion')),
  item_id uuid not null, -- references the actual table row
  title text not null,
  description text,
  requested_by uuid references profiles(id) not null,
  requested_at timestamptz default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'escalated')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  review_reason text,
  scope text not null check (scope in ('self', 'team', 'domain', 'branch', 'org')),
  created_at timestamptz default now()
);

alter table approval_items enable row level security;

create policy approval_items_own on approval_items
  for select using (auth.uid() = requested_by);
create policy approval_items_approver on approval_items
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('domain_head', 'team_lead', 'board', 'admin'))
  );
create policy approval_items_insert on approval_items
  for insert with check (auth.uid() = requested_by);
create policy approval_items_update on approval_items
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('domain_head', 'team_lead', 'board', 'admin'))
  );

-- ============================================================
-- Functions
-- ============================================================

create function propose_activity(
  p_name text,
  p_category text,
  p_subcategory_id uuid,
  p_domain_id uuid,
  p_exp_min integer,
  p_exp_max integer,
  p_season_cap integer,
  p_difficulty integer,
  p_evidence_required boolean,
  p_approvers_needed integer,
  p_description text,
  p_justification text
) returns uuid as $$
declare
  v_proposal_id uuid;
  v_proposer record;
begin
  select * into v_proposer from profiles where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  -- Validate difficulty range
  if p_difficulty < 1 or p_difficulty > 5 then
    raise exception 'Difficulty must be between 1 and 5';
  end if;

  -- Validate EXP range
  if p_exp_min < 0 or p_exp_max < p_exp_min then
    raise exception 'Invalid EXP range';
  end if;

  insert into activity_proposals (proposed_by, name, category, subcategory_id, domain_id,
                                  exp_min, exp_max, season_cap, difficulty, evidence_required,
                                  approvers_needed, description, justification, status)
  values (auth.uid(), p_name, p_category, p_subcategory_id, p_domain_id,
          p_exp_min, p_exp_max, p_season_cap, p_difficulty, p_evidence_required,
          p_approvers_needed, p_description, p_justification, 'proposed')
  returning id into v_proposal_id;

  -- Create approval item for senior authority review
  -- Route to domain head or board based on proposer's scope
  insert into approval_items (item_type, item_id, title, description, requested_by,
                              scope, status)
  values ('activity_proposal', v_proposal_id,
          'New Activity: ' || p_name,
          p_justification,
          auth.uid(),
          'domain',
          'pending');

  -- Audit log
  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'activity.proposed', 'activity_proposals', v_proposal_id,
          jsonb_build_object('name', p_name, 'category', p_category, 'exp_range', p_exp_min || '-' || p_exp_max));

  return v_proposal_id;
end $$ language plpgsql security definer;

create function approve_activity_proposal(
  p_proposal_id uuid,
  p_approve boolean,
  p_reason text
) returns text as $$
declare
  v_proposal record;
  v_approver record;
  v_new_activity_id uuid;
begin
  select * into v_proposal from activity_proposals where id = p_proposal_id;
  if not found then
    raise exception 'Activity proposal not found';
  end if;

  select * into v_approver from profiles where id = auth.uid();

  -- Only domain heads, team leads, board, admin can approve
  if v_approver.role not in ('domain_head', 'team_lead', 'board', 'admin') then
    raise exception 'Insufficient permissions to approve activity proposals';
  end if;

  -- Cannot approve your own proposal
  if auth.uid() = v_proposal.proposed_by then
    raise exception 'Cannot approve your own activity proposal';
  end if;

  -- Senior approval (first level): domain head/team lead approves
  if v_proposal.status = 'proposed' then
    if v_approver.role not in ('domain_head', 'team_lead', 'board', 'admin') then
      raise exception 'Only domain heads or above can do senior approval';
    end if;

    update activity_proposals
    set status = 'senior_approved',
        senior_approved_by = auth.uid(),
        senior_approved_at = now()
    where id = p_proposal_id;

    -- Update approval item
    update approval_items
    set status = case when p_approve then 'approved' else 'rejected' end,
        approved_by = auth.uid(),
        approved_at = now(),
        review_reason = p_reason
    where item_id = p_proposal_id and item_type = 'activity_proposal' and status = 'pending';

    -- Create admin-level approval item
    insert into approval_items (item_type, item_id, title, description, requested_by,
                                scope, status)
    values ('activity_proposal', p_proposal_id,
            'Admin Approval: ' || v_proposal.name,
            v_proposal.justification,
            v_proposal.proposed_by,
            'org',
            'pending');

    insert into audit_log (actor_id, action, table_name, record_id, new_values)
    values (auth.uid(), 'activity_proposal.senior_approved', 'activity_proposals', p_proposal_id,
            jsonb_build_object('approved', p_approve, 'reason', p_reason));

    return case when p_approve then 'Senior approval submitted. Pending admin approval.' else 'Proposal rejected.' end;

  -- Admin approval (second level): board/admin approves and makes live
  elsif v_proposal.status = 'senior_approved' then
    if v_approver.role not in ('board', 'admin') then
      raise exception 'Only board or admin can do final approval';
    end if;

    if p_approve then
      -- Create the actual activity type
      insert into activity_types (name, category, subcategory_id, domain_id,
                                  exp_min, exp_max, season_cap, difficulty,
                                  evidence_required, approvers_needed, description,
                                  is_active, config_version_id)
      values (v_proposal.name, v_proposal.category, v_proposal.subcategory_id, v_proposal.domain_id,
              v_proposal.exp_min, v_proposal.exp_max, v_proposal.season_cap, v_proposal.difficulty,
              v_proposal.evidence_required, v_proposal.approvers_needed, v_proposal.description,
              true,
              (select id from config_versions order by effective_from desc limit 1))
      returning id into v_new_activity_id;

      update activity_proposals
      set status = 'live',
          admin_approved_by = auth.uid(),
          admin_approved_at = now(),
          activity_type_id = v_new_activity_id
      where id = p_proposal_id;
    else
      update activity_proposals
      set status = 'rejected',
          admin_approved_by = auth.uid(),
          admin_approved_at = now()
      where id = p_proposal_id;
    end if;

    -- Update approval item
    update approval_items
    set status = case when p_approve then 'approved' else 'rejected' end,
        approved_by = auth.uid(),
        approved_at = now(),
        review_reason = p_reason
    where item_id = p_proposal_id and item_type = 'activity_proposal' and status = 'pending';

    insert into audit_log (actor_id, action, table_name, record_id, new_values)
    values (auth.uid(), 'activity_proposal.admin_approved', 'activity_proposals', p_proposal_id,
            jsonb_build_object('approved', p_approve, 'reason', p_reason, 'activity_type_id', v_new_activity_id));

    return case when p_approve then 'Activity approved and is now live.' else 'Proposal rejected.' end;

  else
    raise exception 'Proposal is already in a final state';
  end if;
end $$ language plpgsql security definer;

create function list_activity_proposals() returns setof activity_proposals as $$
begin
  return query
  select *
  from activity_proposals
  where status in ('proposed', 'senior_approved')
  order by created_at asc;
end $$ language plpgsql security definer;
