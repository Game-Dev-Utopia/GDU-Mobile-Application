-- Phase 4: Compliance Module + Maker-Checker Cash Flow

-- ============================================================
-- Articles/Bylaw versions (versioned config)
-- ============================================================

create table articles_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  document_url text not null,
  effective_from timestamptz not null,
  clause text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table articles_versions enable row level security;

create policy articles_read on articles_versions
  for select using (auth.role() = 'authenticated');
create policy articles_manage on articles_versions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- MoU register with expiry reminders
-- ============================================================

create table mou_register (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  partner_type text not null check (partner_type in ('friend', 'partner', 'strategic')),
  mou_document_url text,
  start_date date not null,
  end_date date not null,
  expiry_reminder_sent boolean not null default false,
  status text not null default 'active' check (status in ('active', 'expired', 'terminated')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table mou_register enable row level security;

create policy mou_read on mou_register
  for select using (auth.role() = 'authenticated');
create policy mou_manage on mou_register
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Filing calendar
-- ============================================================

create table filing_calendar (
  id uuid primary key default gen_random_uuid(),
  filing_name text not null,
  filing_type text not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'filed', 'overdue', 'waived')),
  filed_at timestamptz,
  filed_by uuid references profiles(id),
  document_url text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table filing_calendar enable row level security;

create policy filing_read on filing_calendar
  for select using (auth.role() = 'authenticated');
create policy filing_manage on filing_calendar
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Motion records linked to clause that authorised them
-- ============================================================

create table motion_authorizations (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid references motions(id) not null,
  clause_reference text not null,
  articles_version_id uuid references articles_versions(id),
  authorized_at timestamptz default now(),
  authorized_by uuid references profiles(id)
);

alter table motion_authorizations enable row level security;

create policy motion_auth_read on motion_authorizations
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Maker-Checker Cash Flow
-- ============================================================

create table cash_releases (
  id uuid primary key default gen_random_uuid(),
  prepared_by uuid references profiles(id) not null,
  approved_by uuid references profiles(id),
  recipient_id uuid references profiles(id) not null,
  amount_cents integer not null,
  currency text not null default 'INR',
  purpose text not null,
  justification text,
  ledger_entry_ids uuid[] default '{}', -- links to ledger entries justifying the release
  authority text not null, -- board motion ID or config reference
  status text not null default 'prepared' check (status in ('prepared', 'approved', 'released', 'rejected')),
  prepared_at timestamptz default now(),
  approved_at timestamptz,
  released_at timestamptz,
  created_at timestamptz default now()
);

alter table cash_releases enable row level security;

create policy cash_preparer on cash_releases
  for select using (auth.uid() = prepared_by or auth.uid() = approved_by or auth.uid() = recipient_id);
create policy cash_board on cash_releases
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );
create policy cash_insert on cash_releases
  for insert with check (auth.uid() = prepared_by);
create policy cash_update on cash_releases
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
    or auth.uid() = prepared_by
  );

-- ============================================================
-- Finance & Compliance bundle holder config
-- ============================================================

create table permission_bundle_holders (
  id uuid primary key default gen_random_uuid(),
  bundle_name text not null unique check (bundle_name in ('finance.release', 'compliance.manage')),
  holder_type text not null check (holder_type in ('group', 'person', 'committee')),
  holder_id uuid references profiles(id),
  holder_group text,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz default now(),
  effective_from timestamptz not null default now()
);

alter table permission_bundle_holders enable row level security;

create policy bundle_read on permission_bundle_holders
  for select using (auth.role() = 'authenticated');
create policy bundle_manage on permission_bundle_holders
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Seed default bundle holders (Board holds both for now)
-- ============================================================

insert into permission_bundle_holders (bundle_name, holder_type, holder_group, assigned_by, effective_from)
select 'finance.release', 'group', 'board', id, now() from profiles where role = 'board_member' limit 1
on conflict do nothing;

insert into permission_bundle_holders (bundle_name, holder_type, holder_group, assigned_by, effective_from)
select 'compliance.manage', 'group', 'board', id, now() from profiles where role = 'board_member' limit 1
on conflict do nothing;

-- ============================================================
-- Function: prepare_cash_release — board member prepares a release
-- ============================================================

create function prepare_cash_release(
  p_recipient_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_purpose text,
  p_justification text,
  p_ledger_entry_ids uuid[],
  p_authority text
) returns uuid as $$
declare
  v_release_id uuid;
  v_preparer record;
begin
  select * into v_preparer from profiles where id = auth.uid();
  if not found then
    raise exception 'Preparer profile not found';
  end if;

  -- Cannot prepare release to yourself
  if auth.uid() = p_recipient_id then
    raise exception 'Cannot prepare cash release to yourself';
  end if;

  -- Check finance.release bundle permission
  if not exists (
    select 1 from permission_bundle_holders pbh
    join profiles p on p.id = pbh.holder_id
    where pbh.bundle_name = 'finance.release'
      and p.id = auth.uid()
      and pbh.effective_from <= now()
  )
  and not exists (
    select 1 from profiles where id = auth.uid() and role in ('board', 'admin')
  ) then
    raise exception 'Insufficient permissions to prepare cash release';
  end if;

  insert into cash_releases (prepared_by, recipient_id, amount_cents, currency, purpose,
                             justification, ledger_entry_ids, authority, status)
  values (auth.uid(), p_recipient_id, p_amount_cents, p_currency, p_purpose,
          p_justification, p_ledger_entry_ids, p_authority, 'prepared')
  returning id into v_release_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'cash.release_prepared', 'cash_releases', v_release_id,
          jsonb_build_object('recipient_id', p_recipient_id, 'amount_cents', p_amount_cents, 'currency', p_currency));

  return v_release_id;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: approve_cash_release — different board member approves
-- ============================================================

create function approve_cash_release(
  p_release_id uuid,
  p_approve boolean
) returns text as $$
declare
  v_release record;
  v_approver record;
begin
  select * into v_release from cash_releases where id = p_release_id;
  if not found then
    raise exception 'Cash release not found';
  end if;

  select * into v_approver from profiles where id = auth.uid();
  if not found then
    raise exception 'Approver profile not found';
  end if;

  -- Cannot approve your own release
  if auth.uid() = v_release.prepared_by then
    raise exception 'Cannot approve your own cash release';
  end if;

  -- Cannot approve if you are the recipient
  if auth.uid() = v_release.recipient_id then
    raise exception 'Recipient cannot approve cash release';
  end if;

  if v_release.status <> 'prepared' then
    raise exception 'Release is not in prepared status';
  end if;

  -- Check finance.release bundle permission for approver too
  if not exists (
    select 1 from permission_bundle_holders pbh
    join profiles p on p.id = pbh.holder_id
    where pbh.bundle_name = 'finance.release'
      and p.id = auth.uid()
      and pbh.effective_from <= now()
  )
  and not exists (
    select 1 from profiles where id = auth.uid() and role in ('board', 'admin')
  ) then
    raise exception 'Insufficient permissions to approve cash release';
  end if;

  if p_approve then
    update cash_releases
    set status = 'approved',
        approved_by = auth.uid(),
        approved_at = now()
    where id = p_release_id;
  else
    update cash_releases
    set status = 'rejected',
        approved_by = auth.uid(),
        approved_at = now()
    where id = p_release_id;
  end if;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'cash.release_approved', 'cash_releases', p_release_id,
          jsonb_build_object('approved', p_approve));

  return case when p_approve then 'Cash release approved.' else 'Cash release rejected.' end;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: release_cash — finalize the cash release (after approval)
-- ============================================================

create function release_cash(p_release_id uuid) returns text as $$
declare
  v_release record;
begin
  select * into v_release from cash_releases where id = p_release_id;
  if not found then
    raise exception 'Cash release not found';
  end if;

  if v_release.status <> 'approved' then
    raise exception 'Release is not approved';
  end if;

  if auth.uid() = v_release.recipient_id then
    raise exception 'Recipient cannot finalize cash release';
  end if;

  update cash_releases
  set status = 'released',
      released_at = now()
  where id = p_release_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'cash.released', 'cash_releases', p_release_id,
          jsonb_build_object('released_at', now()));

  return 'Cash released.';
end $$ language plpgsql security definer;
