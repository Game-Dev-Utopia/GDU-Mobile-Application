-- Phase 8.4: Announcements table
--
-- The application reads announcements from the home banner and the admin
-- console, but no migration ever created the table, so both surfaces silently
-- rendered an empty list (getAnnouncements swallows the query error).

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'info'
    check (type in ('info', 'event', 'warning', 'reward')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table announcements enable row level security;

drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements
  for select using (auth.role() = 'authenticated');

drop policy if exists announcements_manage on announcements;
create policy announcements_manage on announcements
  for all using (
    public.has_role(array['board_member', 'board', 'admin'])
  ) with check (
    public.has_role(array['board_member', 'board', 'admin'])
  );

create index if not exists announcements_created_at_idx
  on announcements (created_at desc);
