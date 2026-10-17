-- Phase 2: League system backend

-- ============================================================
-- Seed league tiers (Duolingo-style bandwidths)
-- ============================================================

insert into league_tiers (name, display_name, min_exp, max_exp, color, sort_order, is_locked) values
('bronze', 'Bronze', 0, 999, '#CD7F32', 1, false),
('silver', 'Silver', 1000, 2499, '#C0C0C0', 2, false),
('gold', 'Gold', 2500, 4999, '#FFD700', 3, false),
('platinum', 'Platinum', 5000, 7499, '#E5E4E2', 4, false),
('emerald', 'Emerald', 7500, 9999, '#10B981', 5, false),
('diamond', 'Diamond', 10000, NULL, '#B9F2FF', 6, false);

-- ============================================================
-- Function: assign_league_tier — compute and update user's tier
-- ============================================================

create function assign_league_tier(p_profile_id uuid) returns void as $$
declare
  v_total_exp integer;
  v_tier text;
begin
  select total_exp into v_total_exp from profiles where id = p_profile_id;

  if not found then
    return;
  end if;

  select name into v_tier
  from league_tiers
  where v_total_exp >= min_exp
    and (max_exp is null or v_total_exp <= max_exp)
  order by min_exp desc
  limit 1;

  if v_tier is not null then
    update profiles
    set league_tier = v_tier
    where id = p_profile_id;
  end if;
end $$ language plpgsql;

-- ============================================================
-- Function: update_all_league_tiers — batch assign tiers
-- ============================================================

create function update_all_league_tiers() returns void as $$
declare
  v_profile record;
begin
  for v_profile in select id from profiles where is_active is not false loop
    perform assign_league_tier(v_profile.id);
  end loop;
end $$ language plpgsql;

-- ============================================================
-- View: season_leaderboard_with_tiers — leaderboard with tier info
-- ============================================================

create or replace view season_leaderboard_view as
select p.id as member_id, p.display_name, p.username, p.avatar_url,
       sum(le.amount) as season_exp,
       p.branch_id, p.domain_id, p.league_tier,
       lt.display_name as tier_display_name,
       lt.color as tier_color
from profiles p
join ledger_entries le on le.member_id = p.id
left join league_tiers lt on lt.name = p.league_tier
where le.source = 'claim'
  and le.activity_date >= (select max(activity_date) from ledger_entries) - interval '14 days'
group by p.id, p.display_name, p.username, p.avatar_url, p.branch_id, p.domain_id, p.league_tier, lt.display_name, lt.color
order by season_exp desc;

-- ============================================================
-- Trigger: auto-assign league tier on EXP change
-- ============================================================

create function on_ledger_entry_insert() returns trigger as $$
begin
  perform assign_league_tier(new.member_id);
  return new;
end $$ language plpgsql;

create trigger ledger_entry_after_insert
  after insert on ledger_entries
  for each row execute function on_ledger_entry_insert();
