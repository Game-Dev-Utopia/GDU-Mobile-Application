-- Phase 9.5: Security hardening
--
-- Closes the gaps found in the pre-Phase-10 audit:
--   1. Members could UPDATE their own profiles row, including role / total_exp.
--   2. ledger_entries was readable by every authenticated user.
--   3. Views ran with the owner's rights (bypassing RLS) and were reachable by anon.
--   4. finalize_claim() had no caller check.
--   5. list_my_review_queue() returned the claimant's suggested EXP (blind review).
--   6. Anyone could insert approval_items; penalties could be edited by the penalised member.
--   7. Ballots were inserted straight from the browser with a client-chosen chamber and weight;
--      motion status/result could be edited by the motion's creator.
--   8. threshold_violations (Standing zones) was readable by every authenticated user.
--   9. activity_subcategories had no RLS.
--
-- Safe to re-run: every policy is dropped before it is created.

-- ============================================================
-- 1. Protect privileged profile columns
-- ============================================================
-- Direct API calls run as role `authenticated`/`anon`. SECURITY DEFINER functions run as their
-- owner, so current_user tells the two apart: only the former is restricted here.

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_col text;
  v_protected text[] := array[
    'id', 'role', 'total_exp', 'level', 'league_tier', 'discord_id', 'is_active',
    'is_alumni', 'alumni_badge', 'transcript_code', 'transcript_generated_at',
    'min_exp_total', 'min_exp_per_category'
  ];
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client may only create its own row as a plain member with no progress.
    if new.id is distinct from auth.uid() then
      raise exception 'Cannot create a profile for another user';
    end if;
    new.role := 'member';
    new.total_exp := 0;
    new.level := 1;
    return new;
  end if;

  foreach v_col in array v_protected loop
    if to_jsonb(new) -> v_col is distinct from to_jsonb(old) -> v_col then
      raise exception 'Column "%" cannot be changed directly', v_col;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before insert or update on profiles
  for each row execute function public.guard_profile_privileged_columns();

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- 2. Ledger: members read their own rows; oversight roles read all
-- ============================================================

drop policy if exists ledger_read on ledger_entries;
create policy ledger_read on ledger_entries
  for select using (
    member_id = auth.uid()
    or public.has_role(array['board_member', 'admin', 'auditor', 'faculty'], auth.uid())
  );

-- ============================================================
-- 3. Views: respect the caller's RLS where the data is personal, and close off anon
-- ============================================================

do $$
declare
  v text;
begin
  foreach v in array array['my_ledger_view', 'member_standing_view', 'member_category_standing_view'] loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v);
    end if;
  end loop;
end $$;

-- Cross-member aggregates stay owner-run on purpose (leaderboard, health, motion tallies,
-- 360 summaries); they only need to be limited to signed-in users.
do $$
declare
  v text;
begin
  foreach v in array array[
    'my_ledger_view', 'season_leaderboard_view', 'member_standing_view',
    'member_category_standing_view', 'current_branch_health_view',
    'motion_summary_view', 'feedback_360_summary'
  ] loop
    if to_regclass('public.' || v) is not null then
      execute format('revoke all on public.%I from anon, public', v);
      execute format('grant select on public.%I to authenticated', v);
    end if;
  end loop;
end $$;

-- ============================================================
-- 4 + 5. Claims: finalize needs the reviewer; the review queue hides suggested EXP
-- ============================================================

create or replace function finalize_claim(p_claim_id uuid) returns void as $$
declare
  v_claim record;
  v_config uuid;
  v_member record;
begin
  select * into v_claim from claims where id = p_claim_id;

  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'under_review' then raise exception 'Claim not ready for finalization'; end if;

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() = v_claim.claimant_id then
    raise exception 'Cannot finalize your own claim';
  end if;
  if auth.uid() is distinct from v_claim.reviewer_id
     and not public.has_role(array['board_member', 'admin'], auth.uid()) then
    raise exception 'Only the reviewing approver, a board member or an admin can finalize this claim';
  end if;

  select id into v_config from config_versions order by effective_from desc limit 1;

  for v_member in select sa.member_id, sa.share_percent from split_agreements sa where sa.claim_id = p_claim_id
  loop
    insert into ledger_entries (member_id, amount, category, source, activity_date, config_version_id)
    values (v_member.member_id,
            round(v_claim.reviewed_score * v_member.share_percent / 100.0),
            (select category from activity_types where id = v_claim.activity_type_id),
            'claim', v_claim.activity_date, v_config);
  end loop;

  update claims set status = 'approved' where id = p_claim_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'claim.finalized', 'claims', p_claim_id,
          jsonb_build_object('final_score', v_claim.reviewed_score));
end $$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function list_my_review_queue() returns setof claims as $$
begin
  -- suggested_exp is blanked so the approver scores independently of the claimant's number.
  return query
  select (jsonb_populate_record(c, jsonb_build_object('suggested_exp', null))).*
  from claims c
  join profiles p on p.id = c.claimant_id
  join profiles r on r.id = auth.uid()
  where c.status = 'submitted'
    and p.domain_id = r.domain_id
    and public.has_role(array['domain_head', 'team_lead', 'board', 'board_member', 'admin'], auth.uid())
    and c.claimant_id <> auth.uid()
    and not exists (select 1 from split_agreements sa where sa.claim_id = c.id and sa.member_id = auth.uid())
  order by c.created_at asc;
end $$ language plpgsql security definer set search_path = public, pg_temp;

-- ============================================================
-- 6. approval_items / penalties
-- ============================================================
-- Rows are created by SECURITY DEFINER functions (propose_activity etc.), never by clients.

drop policy if exists approval_items_insert on approval_items;

-- Fixes the malformed "create penalties_update" statement in migration 0002 and stops the
-- penalised member (or the filer) editing a penalty row directly; the RPCs do the transitions.
drop policy if exists penalties_update on penalties;
create policy penalties_update on penalties
  for update using (
    public.has_role(array['board_member', 'admin', 'conduct_panel_member'], auth.uid())
  );

-- ============================================================
-- 7. Voting: ballots go through cast_ballot(); motions are not editable by their creator
-- ============================================================

create or replace function cast_ballot(p_motion_id uuid, p_vote text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motion record;
  v_chamber text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_vote not in ('yes', 'no', 'abstain') then raise exception 'Invalid vote'; end if;

  select * into v_motion from motions where id = p_motion_id;
  if not found then raise exception 'Motion not found'; end if;
  if v_motion.status not in ('open', 'voting') then
    raise exception 'Voting is not open on this motion';
  end if;
  if v_motion.tier = 'recall' and v_motion.created_by = auth.uid() then
    raise exception 'You are recused from this motion';
  end if;

  if public.has_role(array['board_member'], auth.uid()) then
    v_chamber := 'board';
  elsif public.has_role(array['council_member', 'domain_head'], auth.uid()) then
    v_chamber := 'council';
  else
    v_chamber := 'members';
  end if;

  insert into ballots (motion_id, voter_id, vote, chamber, weight)
  values (p_motion_id, auth.uid(), p_vote, v_chamber, 1);

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'ballot.cast', 'motions', p_motion_id, jsonb_build_object('chamber', v_chamber));

  return v_chamber;
exception when unique_violation then
  raise exception 'You have already voted on this motion';
end $$;

revoke execute on function cast_ballot(uuid, text) from public;
grant execute on function cast_ballot(uuid, text) to authenticated;

create or replace function open_motion(p_motion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motion record;
begin
  select * into v_motion from motions where id = p_motion_id;
  if not found then raise exception 'Motion not found'; end if;
  if auth.uid() is distinct from v_motion.created_by
     and not public.has_role(array['board_member', 'admin'], auth.uid()) then
    raise exception 'Only the author, a board member or an admin can open this motion';
  end if;
  if v_motion.status <> 'draft' then raise exception 'Only draft motions can be opened'; end if;

  update motions set status = 'open', opened_at = now() where id = p_motion_id;
end $$;

revoke execute on function open_motion(uuid) from public;
grant execute on function open_motion(uuid) to authenticated;

drop policy if exists ballots_create on ballots;

drop policy if exists motions_create on motions;
create policy motions_create on motions
  for insert with check (
    auth.uid() = created_by and status = 'draft' and result is null and result_details is null
  );

drop policy if exists motions_update on motions;
create policy motions_update on motions
  for update using (
    public.has_role(array['board', 'board_member', 'admin'], auth.uid())
  );

-- ============================================================
-- 8 + 9. Standing zones are private; reference table gets RLS
-- ============================================================

drop policy if exists threshold_violations_read on threshold_violations;
create policy threshold_violations_read on threshold_violations
  for select using (
    member_id = auth.uid()
    or public.has_role(
      array['domain_head', 'council_member', 'board_member', 'admin', 'faculty', 'auditor'],
      auth.uid()
    )
  );

alter table activity_subcategories enable row level security;
drop policy if exists activity_subcategories_read on activity_subcategories;
create policy activity_subcategories_read on activity_subcategories
  for select using (auth.role() = 'authenticated');
