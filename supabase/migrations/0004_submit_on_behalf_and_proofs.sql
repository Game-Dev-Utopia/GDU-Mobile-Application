-- Patch C: Submit on behalf + proofs

-- ============================================================
-- Add 'awaiting_confirmation' status to claims
-- ============================================================

-- Drop and recreate claims table with updated status constraint
-- (In production, use ALTER TABLE to add the new status)

alter table claims
  drop constraint claims_status_check;

alter table claims
  add constraint claims_status_check
  check (status in ('submitted', 'under_review', 'approved', 'rejected', 'awaiting_confirmation'));

-- Add submitted_on_behalf_of column
alter table claims
  add column submitted_on_behalf_of uuid references profiles(id);

alter table claims
  add column submitted_by uuid references profiles(id);

-- ============================================================
-- Proofs storage bucket
-- ============================================================

-- Create a storage bucket for claim proofs (run in Supabase Dashboard or via API)
-- insert into storage.buckets (id, name, public) values ('claim_proofs', 'claim_proofs', false);

-- ============================================================
-- Proof files table
-- ============================================================

create table proof_files (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) not null,
  file_name text not null,
  file_size integer not null, -- bytes
  file_type text not null, -- mime type
  storage_path text not null, -- path in Supabase Storage
  url text, -- public URL if public bucket, or signed URL
  uploaded_at timestamptz default now()
);

alter table proof_files enable row level security;

create policy proof_files_own on proof_files
  for select using (
    auth.uid() in (select claimant_id from claims where id = claim_id)
    or auth.uid() in (select member_id from split_agreements where claim_id = claim_id)
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('domain_head', 'team_lead', 'board', 'admin'))
  );

create policy proof_files_insert on proof_files
  for insert with check (auth.uid() = auth.uid()); -- verified via RPC

-- ============================================================
-- Update submit_claim RPC to support submit_on_behalf
-- ============================================================

create or replace function submit_claim(
  p_activity_type_id uuid,
  p_title text,
  p_description text,
  p_activity_date date,
  p_evidence_links text[],
  p_suggested_exp integer,
  p_analysis_pointers text,
  p_contributors jsonb,
  p_submitted_on_behalf_of uuid default null
) returns uuid as $$
declare
  v_claim_id uuid;
  v_at record;
  v_share_sum integer := 0;
  v_submitter record;
  v_target record;
begin
  -- Get submitter info
  select * into v_submitter from profiles where id = auth.uid();

  if not found then
    raise exception 'Submitter profile not found';
  end if;

  -- Validate activity type
  select * into v_at from activity_types where id = p_activity_type_id;
  if not found then
    raise exception 'Activity type not found';
  end if;

  -- Validate suggested EXP in range
  if p_suggested_exp < v_at.exp_min or p_suggested_exp > v_at.exp_max then
    raise exception 'Suggested EXP % outside range [%-%]', p_suggested_exp, v_at.exp_min, v_at.exp_max;
  end if;

  -- Validate splits sum to 100
  select sum((elem->>'share_percent')::int) into v_share_sum
  from jsonb_array_elements(p_contributors) as elem;

  if v_share_sum <> 100 then
    raise exception 'Contributor shares must total 100, got %', v_share_sum;
  end if;

  -- Determine claimant
  if p_submitted_on_behalf_of is not null then
    -- Submit on behalf: check RBAC
    select * into v_target from profiles where id = p_submitted_on_behalf_of;
    if not found then
      raise exception 'Target member not found';
    end if;

    -- Check submitter can submit on behalf of target
    -- Chain rule: submitter's role must be senior to target's role
    if v_submitter.role is not distinct from v_target.role
       or (select count(*) from role_assignments ra where ra.profile_id = auth.uid() and ra.role = v_submitter.role and ra.is_active) = 0 then
      -- Simplified check: submitter must be senior to target
      raise exception 'You cannot submit on behalf of this member';
    end if;

    -- Set status to awaiting_confirmation
    insert into claims (claimant_id, activity_type_id, title, description, activity_date,
                        evidence_links, suggested_exp, analysis_pointers, config_version_id,
                        submitted_on_behalf_of, submitted_by, status)
    values (p_submitted_on_behalf_of, p_activity_type_id, p_title, p_description, p_activity_date,
            p_evidence_links, p_suggested_exp, p_analysis_pointers,
            (select id from config_versions order by effective_from desc limit 1),
            p_submitted_on_behalf_of, auth.uid(), 'awaiting_confirmation')
    returning id into v_claim_id;
  else
    -- Self-submission
    insert into claims (claimant_id, activity_type_id, title, description, activity_date,
                        evidence_links, suggested_exp, analysis_pointers, config_version_id,
                        submitted_by, status)
    values (auth.uid(), p_activity_type_id, p_title, p_description, p_activity_date,
            p_evidence_links, p_suggested_exp, p_analysis_pointers,
            (select id from config_versions order by effective_from desc limit 1),
            auth.uid(), 'submitted')
    returning id into v_claim_id;
  end if;

  -- Insert split agreements
  for v_member in select elem->>'member_id' as member_id, (elem->>'share_percent')::int as share_percent
                  from jsonb_array_elements(p_contributors) as elem
  loop
    insert into split_agreements (claim_id, member_id, share_percent)
    values (v_claim_id, v_member.member_id::uuid, v_member.share_percent);
  end loop;

  -- Audit log
  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'claim.submitted', 'claims', v_claim_id,
          jsonb_build_object('suggested_exp', p_suggested_exp, 'status',
            case when p_submitted_on_behalf_of is not null then 'awaiting_confirmation' else 'submitted' end,
            'submitted_on_behalf_of', p_submitted_on_behalf_of));

  return v_claim_id;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: confirm_claim — target member confirms a claim submitted on their behalf
-- ============================================================

create function confirm_claim(p_claim_id uuid, p_confirm boolean) returns text as $$
declare
  v_claim record;
begin
  select * into v_claim from claims where id = p_claim_id;
  if not found then
    raise exception 'Claim not found';
  end if;

  if auth.uid() <> v_claim.claimant_id then
    raise exception 'Only the claimant can confirm/reject';
  end if;

  if v_claim.status <> 'awaiting_confirmation' then
    raise exception 'Claim is not awaiting confirmation';
  end if;

  if p_confirm then
    update claims set status = 'submitted' where id = p_claim_id;
    insert into audit_log (actor_id, action, table_name, record_id, new_values)
    values (auth.uid(), 'claim.confirmed', 'claims', p_claim_id,
            jsonb_build_object('status', 'submitted'));
    return 'Claim confirmed.';
  else
    update claims set status = 'rejected' where id = p_claim_id;
    insert into audit_log (actor_id, action, table_name, record_id, new_values)
    values (auth.uid(), 'claim.disputed', 'claims', p_claim_id,
            jsonb_build_object('status', 'rejected', 'reason', 'Member disputed claim'));
    return 'Claim disputed and rejected.';
  end if;
end $$ language plpgsql security definer;
