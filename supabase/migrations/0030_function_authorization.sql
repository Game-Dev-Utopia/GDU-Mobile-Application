-- Closes the authorization gaps listed in docs/API.md ("Known authorization gaps").
--
-- Pattern: functions that act on a member id the client supplies become internal-only
-- (EXECUTE revoked from anon/authenticated; other SECURITY DEFINER functions and triggers
-- still call them as the owner). Clients get small wrappers that use auth.uid() instead.
--
--   award_badge             -> internal; admin_award_badge() for admins
--   check_and_award_badges  -> internal; check_my_badges() for the caller
--   update_quest_progress   -> internal only
--   get_or_create_member_quest -> internal; ensure_my_quest() for the caller
--   assign_league_tier      -> internal; refresh_my_league_tier() for the caller
--   add_to_coach_plan       -> caller must be the plan owner
--   claim_quest_reward      -> caller must own the quest row; row-locked against double claims
--
-- Safe to re-run.

-- ============================================================
-- Triggers that call the internal functions must not depend on the caller's rights
-- ============================================================

create or replace function on_claim_approved() returns trigger as $$
begin
  perform check_and_award_badges(new.claimant_id);
  return new;
end $$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function on_claim_approved_for_quests() returns trigger as $$
declare
  v_quests record;
begin
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
end $$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function on_ledger_entry_insert() returns trigger as $$
begin
  perform assign_league_tier(new.member_id);
  return new;
end $$ language plpgsql security definer set search_path = public, pg_temp;

-- assign_league_tier writes profiles.league_tier, which the profile guard (0028) blocks for direct
-- API calls; as a definer function it runs as the owner and is allowed.
alter function assign_league_tier(uuid) security definer;
alter function assign_league_tier(uuid) set search_path = public, pg_temp;
alter function update_all_league_tiers() security definer;
alter function update_all_league_tiers() set search_path = public, pg_temp;

-- ============================================================
-- Make the member-id functions internal-only
-- ============================================================

revoke execute on function award_badge(uuid, uuid) from public, anon, authenticated;
revoke execute on function check_and_award_badges(uuid) from public, anon, authenticated;
revoke execute on function update_quest_progress(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function get_or_create_member_quest(uuid, uuid) from public, anon, authenticated;
revoke execute on function assign_league_tier(uuid) from public, anon, authenticated;
revoke execute on function update_all_league_tiers() from public, anon, authenticated;

alter function award_badge(uuid, uuid) set search_path = public, pg_temp;
alter function check_and_award_badges(uuid) set search_path = public, pg_temp;
alter function update_quest_progress(uuid, uuid, integer) set search_path = public, pg_temp;
alter function get_or_create_member_quest(uuid, uuid) set search_path = public, pg_temp;

-- ============================================================
-- Caller-scoped wrappers
-- ============================================================

create or replace function admin_award_badge(p_member_id uuid, p_badge_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(array['admin', 'board_member'], auth.uid()) then
    raise exception 'Only an admin or board member can award badges manually';
  end if;
  perform award_badge(p_member_id, p_badge_id);
end $$;

create or replace function check_my_badges()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform check_and_award_badges(auth.uid());
end $$;

create or replace function ensure_my_quest(p_quest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from quests where id = p_quest_id) then
    raise exception 'Quest not found';
  end if;
  return get_or_create_member_quest(auth.uid(), p_quest_id);
end $$;

create or replace function refresh_my_league_tier()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform assign_league_tier(auth.uid());
end $$;

revoke execute on function admin_award_badge(uuid, uuid) from public, anon;
revoke execute on function check_my_badges() from public, anon;
revoke execute on function ensure_my_quest(uuid) from public, anon;
revoke execute on function refresh_my_league_tier() from public, anon;
grant execute on function admin_award_badge(uuid, uuid) to authenticated;
grant execute on function check_my_badges() to authenticated;
grant execute on function ensure_my_quest(uuid) to authenticated;
grant execute on function refresh_my_league_tier() to authenticated;

-- ============================================================
-- add_to_coach_plan: only for yourself
-- ============================================================

create or replace function add_to_coach_plan(
  p_member_id uuid,
  p_activity_type_id uuid,
  p_activity_title text,
  p_activity_category text,
  p_activity_domain uuid,
  p_exp_reward integer,
  p_day_of_week integer
) returns uuid as $$
declare
  v_plan_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_member_id is distinct from auth.uid() then
    raise exception 'You can only change your own plan';
  end if;
  if p_day_of_week < 0 or p_day_of_week > 6 then
    raise exception 'Invalid day of week';
  end if;
  if not exists (select 1 from activity_types where id = p_activity_type_id) then
    raise exception 'Activity type not found';
  end if;

  if exists (
    select 1 from coach_plan
    where member_id = p_member_id and day_of_week = p_day_of_week
  ) then
    raise exception 'You already have an activity planned for this day of the week.';
  end if;

  if (
    select count(*) from coach_plan
    where member_id = p_member_id
      and added_at >= date_trunc('week', now())
      and added_at < date_trunc('week', now()) + interval '7 days'
  ) >= 5 then
    raise exception 'Weekly plan capacity reached (max 5 items).';
  end if;

  insert into coach_plan (member_id, activity_type_id, activity_title, activity_category,
                          activity_domain, exp_reward, day_of_week)
  values (p_member_id, p_activity_type_id, p_activity_title, p_activity_category,
          p_activity_domain, p_exp_reward, p_day_of_week)
  returning id into v_plan_id;

  return v_plan_id;
end $$ language plpgsql security definer set search_path = public, pg_temp;

-- ============================================================
-- claim_quest_reward: owner only, once
-- ============================================================

create or replace function claim_quest_reward(p_member_quest_id uuid) returns integer as $$
declare
  v_mq record;
  v_xp_reward integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- Lock the row so two parallel requests cannot both claim.
  select * into v_mq from member_quests where id = p_member_quest_id for update;
  if not found then
    raise exception 'Member quest not found';
  end if;

  if v_mq.member_id is distinct from auth.uid() then
    raise exception 'This quest belongs to another member';
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
end $$ language plpgsql security definer set search_path = public, pg_temp;
