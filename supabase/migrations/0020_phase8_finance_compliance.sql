-- Phase 8.2: Finance & Compliance Console

-- Link permission bundle assignments to org-list motions
alter table permission_bundle_holders
  add column if not exists motion_id uuid references motions(id);

-- Index for faster bundle lookup by holder
create index if not exists idx_permission_bundle_holders_bundle on permission_bundle_holders(bundle_name);
create index if not exists idx_permission_bundle_holders_holder on permission_bundle_holders(holder_id);

-- ============================================================
-- Function: update_redemption_status — advance fulfilment stage
-- ============================================================

create function update_redemption_status(
  p_redemption_id uuid,
  p_new_status text,
  p_tracking_info text
) returns text as $$
declare
  v_redemption record;
begin
  select * into v_redemption from redemptions where id = p_redemption_id;
  if not found then
    raise exception 'Redemption not found';
  end if;

  -- Only board/admin (or finance bundle holder) may advance fulfilment
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
    raise exception 'Insufficient permissions to update redemption status';
  end if;

  -- Enforce the requested -> approved -> shipped -> collected chain
  if p_new_status = 'shipped' and v_redemption.status <> 'approved' then
    raise exception 'Redemption must be approved before shipping';
  end if;

  if p_new_status = 'collected' and v_redemption.status <> 'shipped' then
    raise exception 'Redemption must be shipped before collection';
  end if;

  if p_new_status not in ('approved', 'shipped', 'collected') then
    raise exception 'Invalid redemption status: %', p_new_status;
  end if;

  update redemptions
  set status = p_new_status,
      processed_at = now(),
      processed_by = auth.uid(),
      tracking_info = coalesce(p_tracking_info, tracking_info)
  where id = p_redemption_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'redemption.status_updated', 'redemptions', p_redemption_id,
          jsonb_build_object('status', p_new_status, 'tracking_info', p_tracking_info));

  return 'Redemption updated to ' || p_new_status;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: assign_permission_bundle_holder
-- Requires an org-list motion authorising the assignment.
-- ============================================================

create function assign_permission_bundle_holder(
  p_bundle_name text,
  p_holder_type text,
  p_holder_id uuid,
  p_holder_group text,
  p_motion_id uuid
) returns text as $$
declare
  v_motion record;
begin
  if p_bundle_name not in ('finance.release', 'compliance.manage') then
    raise exception 'Unknown permission bundle: %', p_bundle_name;
  end if;

  if p_holder_type not in ('group', 'person', 'committee') then
    raise exception 'Invalid holder type: %', p_holder_type;
  end if;

  -- Assignment must be authorised by an org-list motion
  if p_motion_id is null then
    raise exception 'An org-list motion is required to assign a permission bundle holder';
  end if;

  select * into v_motion from motions where id = p_motion_id;
  if not found then
    raise exception 'Motion not found';
  end if;

  if v_motion.jurisdiction <> 'org' then
    raise exception 'Only an org-level motion can authorise a permission bundle assignment';
  end if;

  if v_motion.status not in ('result', 'closed') then
    raise exception 'Motion has not passed; bundle holder cannot be assigned';
  end if;

  insert into permission_bundle_holders (
    bundle_name, holder_type, holder_id, holder_group, assigned_by, effective_from, motion_id
  )
  values (
    p_bundle_name, p_holder_type, p_holder_id, p_holder_group, auth.uid(), now(), p_motion_id
  )
  on conflict (bundle_name) do update
  set holder_type = excluded.holder_type,
      holder_id = excluded.holder_id,
      holder_group = excluded.holder_group,
      assigned_by = excluded.assigned_by,
      effective_from = excluded.effective_from,
      motion_id = excluded.motion_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'bundle.holder_assigned', 'permission_bundle_holders', p_motion_id,
          jsonb_build_object('bundle_name', p_bundle_name, 'holder_type', p_holder_type,
                             'holder_id', p_holder_id, 'holder_group', p_holder_group,
                             'motion_id', p_motion_id));

  return 'Permission bundle holder assigned';
end $$ language plpgsql security definer;
