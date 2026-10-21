-- Phase 9.1: Partners
--
-- 1. `partners` directory (Friend / Partner / Strategic tier).
-- 2. `partner_scorecard` (collaborations, jams co-hosted, projects delivered,
--    member feedback).
-- 3. `partner_reps` links a profile to a partner as its representative.
-- 4. `partner_events` / `partner_opportunities` / `partner_projects` for
--    co-hosted events & jams, posted opportunities and joint projects.
-- 5. `partner_splits` for co-signed revenue/EXP splits.
-- 6. `guest_passes` for time-boxed guest passes issued by a Partner Rep.
--
-- Partner Reps never see EXP, leaderboards or votes (no such permissions are
-- granted) and can never be the sole approver of a motion or claim
-- (see `public.can_be_sole_approver()`).

-- ============================================================
-- 1. Partners directory
-- ============================================================

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null check (tier in ('friend', 'partner', 'strategic')),
  description text,
  website text,
  contact_email text,
  contact_name text,
  logo_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'prospect')),
  joined_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_tier_idx on partners (tier);
create index if not exists partners_status_idx on partners (status);

-- ============================================================
-- 2. Partner scorecard
-- ============================================================

create table if not exists partner_scorecard (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  collaborations integer not null default 0,
  jams_cohosted integer not null default 0,
  projects_delivered integer not null default 0,
  member_feedback_score numeric check (member_feedback_score >= 0 and member_feedback_score <= 5),
  feedback_count integer not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (partner_id, period_start, period_end)
);

create index if not exists partner_scorecard_partner_idx on partner_scorecard (partner_id);

-- ============================================================
-- 3. Partner reps
-- ============================================================

create table if not exists partner_reps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  role text not null default 'rep',
  is_primary boolean not null default false,
  active_from timestamptz not null default now(),
  active_to timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, partner_id)
);

create index if not exists partner_reps_profile_idx on partner_reps (profile_id);
create index if not exists partner_reps_partner_idx on partner_reps (partner_id);

-- ============================================================
-- 4. Partner events & jams
-- ============================================================

create table if not exists partner_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in ('event', 'jam')),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  is_virtual boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'completed', 'cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_events_partner_idx on partner_events (partner_id);
create index if not exists partner_events_status_idx on partner_events (status);

-- ============================================================
-- 5. Partner opportunities
-- ============================================================

create table if not exists partner_opportunities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  title text not null,
  op_type text not null check (op_type in ('opportunity', 'jam')),
  description text,
  link text,
  status text not null default 'open' check (status in ('open', 'closed', 'filled')),
  expires_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_opportunities_partner_idx on partner_opportunities (partner_id);
create index if not exists partner_opportunities_status_idx on partner_opportunities (status);

-- ============================================================
-- 6. Joint projects
-- ============================================================

create table if not exists partner_projects (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'completed', 'archived')),
  proposed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_projects_partner_idx on partner_projects (partner_id);
create index if not exists partner_projects_status_idx on partner_projects (status);

-- ============================================================
-- 7. Co-signed splits
-- ============================================================

create table if not exists partner_splits (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('claim', 'project')),
  source_id uuid not null,
  partner_share_percent integer not null check (partner_share_percent between 0 and 100),
  member_share_percent integer not null check (member_share_percent between 0 and 100),
  status text not null default 'pending' check (status in ('pending', 'co_signed', 'paid', 'rejected')),
  co_signed_by uuid references profiles(id),
  co_signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_splits_source_idx on partner_splits (source_type, source_id);
create index if not exists partner_splits_status_idx on partner_splits (status);

-- ============================================================
-- 8. Guest passes
-- ============================================================

create table if not exists guest_passes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  issued_by uuid references profiles(id),
  guest_email text not null,
  guest_name text not null,
  purpose text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'revoked')),
  used_at timestamptz
);

create index if not exists guest_passes_partner_idx on guest_passes (partner_id);
create index if not exists guest_passes_status_idx on guest_passes (status);
create index if not exists guest_passes_expires_at_idx on guest_passes (expires_at);

-- ============================================================
-- 9. Sole approver guard (Partner Reps can never be sole approver)
-- ============================================================

create or replace function public.can_be_sole_approver(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.role_assignments ra
    join public.profiles p on p.id = ra.profile_id
    where p.id = p_profile_id
      and ra.role = 'partner_rep'
      and ra.is_active
      and (ra.expires_at is null or ra.expires_at > now())
  );
$$;

-- ============================================================
-- 10. Row level security
-- ============================================================

-- Partners directory: readable by any signed-in member; manageable by board/admin.
alter table partners enable row level security;

drop policy if exists partners_read on partners;
create policy partners_read on partners
  for select using (auth.role() = 'authenticated');

drop policy if exists partners_manage on partners;
create policy partners_manage on partners
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

-- Partner scorecard: readable by all; manageable by board/admin.
alter table partner_scorecard enable row level security;

drop policy if exists partner_scorecard_read on partner_scorecard;
create policy partner_scorecard_read on partner_scorecard
  for select using (auth.role() = 'authenticated');

drop policy if exists partner_scorecard_manage on partner_scorecard;
create policy partner_scorecard_manage on partner_scorecard
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

-- Partner reps: readable by the rep themselves and board/admin; manageable by board/admin.
alter table partner_reps enable row level security;

drop policy if exists partner_reps_read on partner_reps;
create policy partner_reps_read on partner_reps
  for select using (
    auth.uid() = profile_id
    or public.has_role(array['board', 'board_member', 'admin'])
  );

drop policy if exists partner_reps_manage on partner_reps;
create policy partner_reps_manage on partner_reps
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
  );

-- Partner events: readable by all; written by the rep's partner or board/admin.
alter table partner_events enable row level security;

drop policy if exists partner_events_read on partner_events;
create policy partner_events_read on partner_events
  for select using (auth.role() = 'authenticated');

drop policy if exists partner_events_rep_manage on partner_events;
create policy partner_events_rep_manage on partner_events
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = partner_events.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = partner_events.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  );

-- Partner opportunities: readable by all; written by the rep's partner or board/admin.
alter table partner_opportunities enable row level security;

drop policy if exists partner_opportunities_read on partner_opportunities;
create policy partner_opportunities_read on partner_opportunities
  for select using (auth.role() = 'authenticated');

drop policy if exists partner_opportunities_rep_manage on partner_opportunities;
create policy partner_opportunities_rep_manage on partner_opportunities
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = partner_opportunities.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = partner_opportunities.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  );

-- Joint projects: readable by all; written by the rep's partner or board/admin.
alter table partner_projects enable row level security;

drop policy if exists partner_projects_read on partner_projects;
create policy partner_projects_read on partner_projects
  for select using (auth.role() = 'authenticated');

drop policy if exists partner_projects_rep_manage on partner_projects;
create policy partner_projects_rep_manage on partner_projects
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = partner_projects.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = partner_projects.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  );

-- Partner splits: readable by the rep's partner or board/admin; managed likewise.
alter table partner_splits enable row level security;

drop policy if exists partner_splits_read on partner_splits;
create policy partner_splits_read on partner_splits
  for select using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partners p
      join public.partner_reps pr on pr.partner_id = p.id
      where p.id in (
        select partner_id from public.partner_splits ps2 where ps2.id = partner_splits.id
      )
      and pr.profile_id = auth.uid()
      and (pr.active_to is null or pr.active_to > now())
    )
  );

drop policy if exists partner_splits_manage on partner_splits;
create policy partner_splits_manage on partner_splits
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partners p
      join public.partner_reps pr on pr.partner_id = p.id
      where p.id in (
        select partner_id from public.partner_splits ps2 where ps2.id = partner_splits.id
      )
      and pr.profile_id = auth.uid()
      and (pr.active_to is null or pr.active_to > now())
    )
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  );

-- Guest passes: readable by the rep's partner or board/admin; managed likewise.
alter table guest_passes enable row level security;

drop policy if exists guest_passes_read on guest_passes;
create policy guest_passes_read on guest_passes
  for select using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = guest_passes.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  );

drop policy if exists guest_passes_manage on guest_passes;
create policy guest_passes_manage on guest_passes
  for all using (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = guest_passes.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  ) with check (
    public.has_role(array['board', 'board_member', 'admin'])
    or exists (
      select 1 from public.partner_reps pr
      where pr.partner_id = guest_passes.partner_id
        and pr.profile_id = auth.uid()
        and (pr.active_to is null or pr.active_to > now())
    )
  );

-- ============================================================
-- 11. Seed example partners (optional reference data)
-- ============================================================

insert into partners (name, tier, description, website, contact_email, status) values
  ('Pixel Forge Studios', 'strategic', 'Game development co-studio co-hosting game jams.', 'https://pixelforge.example', 'partners@pixelforge.example', 'active'),
  ('Circuit Arts Collective', 'partner', 'Digital arts and design collective co-delivering creative projects.', 'https://circuitarts.example', 'hello@circuitarts.example', 'active'),
  ('Open Build Guild', 'friend', 'Open-source community collaborating on dev tooling.', 'https://openbuild.example', 'ops@openbuild.example', 'active')
on conflict do nothing;
