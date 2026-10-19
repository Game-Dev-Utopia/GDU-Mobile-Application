-- Phase 4: Coins & Rewards

-- ============================================================
-- Coin wallet transactions
-- ============================================================

create table coin_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  amount integer not null, -- positive = earned, negative = spent
  source text not null check (source in ('exp_award', 'spot_award', 'kudos', 'redemption', 'adjustment')),
  reference_id uuid, -- links to claim, spot_award, redemption, etc.
  description text,
  created_at timestamptz default now()
);

alter table coin_transactions enable row level security;

create policy coin_tx_own on coin_transactions
  for select using (auth.uid() = member_id);
create policy coin_tx_panel on coin_transactions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Reward catalog
-- ============================================================

create table reward_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cost_coins integer not null,
  stock integer not null default 0,
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table reward_catalog enable row level security;

create policy reward_catalog_read on reward_catalog
  for select using (auth.role() = 'authenticated');
create policy reward_catalog_manage on reward_catalog
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Redemptions
-- ============================================================

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) not null,
  reward_id uuid references reward_catalog(id) not null,
  cost_coins integer not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'shipped', 'collected', 'rejected')),
  requested_at timestamptz default now(),
  processed_at timestamptz,
  processed_by uuid references profiles(id),
  tracking_info text,
  created_at timestamptz default now()
);

alter table redemptions enable row level security;

create policy redemption_own on redemptions
  for select using (auth.uid() = member_id);
create policy redemption_panel on redemptions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );
create policy redemption_insert on redemptions
  for insert with check (auth.uid() = member_id);
create policy redemption_update on redemptions
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('board', 'admin'))
  );

-- ============================================================
-- Seed reward catalog
-- ============================================================

insert into reward_catalog (name, description, cost_coins, stock, rarity, image_url) values
('GDU Mouse Pad', 'Premium GDU branded mouse pad', 150, 100, 'common', null),
('GDU T-Shirt', 'Official GDU community T-shirt', 400, 50, 'common', null),
('GDU Hoodie/Jacket', 'GDU branded hoodie or jacket', 900, 25, 'uncommon', null),
('GDU Keychain', 'GDU logo keychain', 100, 200, 'common', null),
('GDU Laptop Sticker Pack', 'Set of 5 GDU stickers', 50, 500, 'common', null),
('GDU Playing Cards', 'Custom GDU playing cards', 200, 30, 'uncommon', null),
('GDU Limited Edition Pin', 'Exclusive GDU enamel pin', 600, 10, 'rare', null),
('GDU Backpack', 'GDU branded backpack', 1200, 15, 'epic', null)
on conflict do nothing;

-- ============================================================
-- Function: get_coin_balance — compute current coin balance
-- ============================================================

create function get_coin_balance(p_member_id uuid) returns integer as $$
declare
  v_balance integer := 0;
begin
  select coalesce(sum(amount), 0) into v_balance
  from coin_transactions
  where member_id = p_member_id;

  return v_balance;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: award_coins — award coins to a member
-- ============================================================

create function award_coins(
  p_member_id uuid,
  p_amount integer,
  p_source text,
  p_reference_id uuid,
  p_description text
) returns void as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  insert into coin_transactions (member_id, amount, source, reference_id, description)
  values (p_member_id, p_amount, p_source, p_reference_id, p_description);

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'coins.awarded', 'coin_transactions', null,
          jsonb_build_object('member_id', p_member_id, 'amount', p_amount, 'source', p_source));
end $$ language plpgsql security definer;

-- ============================================================
-- Function: spend_coins — spend coins (for redemptions)
-- ============================================================

create function spend_coins(
  p_member_id uuid,
  p_amount integer,
  p_source text,
  p_reference_id uuid,
  p_description text
) returns void as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select get_coin_balance(p_member_id) into v_balance;

  if v_balance < p_amount then
    raise exception 'Insufficient coin balance: % < %', v_balance, p_amount;
  end if;

  insert into coin_transactions (member_id, amount, source, reference_id, description)
  values (p_member_id, -p_amount, p_source, p_reference_id, p_description);

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'coins.spent', 'coin_transactions', null,
          jsonb_build_object('member_id', p_member_id, 'amount', p_amount, 'source', p_source));
end $$ language plpgsql security definer;

-- ============================================================
-- Function: request_redemption — request a reward redemption
-- ============================================================

create function request_redemption(
  p_member_id uuid,
  p_reward_id uuid
) returns uuid as $$
declare
  v_reward record;
  v_balance integer;
  v_redemption_id uuid;
begin
  select * into v_reward from reward_catalog where id = p_reward_id;
  if not found then
    raise exception 'Reward not found';
  end if;

  if not v_reward.is_active then
    raise exception 'Reward is not active';
  end if;

  if v_reward.stock <= 0 then
    raise exception 'Reward is out of stock';
  end if;

  select get_coin_balance(p_member_id) into v_balance;
  if v_balance < v_reward.cost_coins then
    raise exception 'Insufficient coin balance: % < %', v_balance, v_reward.cost_coins;
  end if;

  insert into redemptions (member_id, reward_id, cost_coins, status)
  values (p_member_id, p_reward_id, v_reward.cost_coins, 'requested')
  returning id into v_redemption_id;

  -- Deduct coins
  perform spend_coins(p_member_id, v_reward.cost_coins, 'redemption', v_redemption_id,
                      'Redeemed: ' || v_reward.name);

  -- Reduce stock
  update reward_catalog
  set stock = stock - 1
  where id = p_reward_id;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'coins.redeemed', 'redemptions', v_redemption_id,
          jsonb_build_object('reward_id', p_reward_id, 'cost_coins', v_reward.cost_coins));

  return v_redemption_id;
end $$ language plpgsql security definer;

-- ============================================================
-- Function: process_redemption — approve/reject redemption
-- ============================================================

create function process_redemption(
  p_redemption_id uuid,
  p_approve boolean,
  p_tracking_info text
) returns text as $$
declare
  v_redemption record;
begin
  select * into v_redemption from redemptions where id = p_redemption_id;
  if not found then
    raise exception 'Redemption not found';
  end if;

  if v_redemption.status <> 'requested' then
    raise exception 'Redemption is not in requested status';
  end if;

  if p_approve then
    update redemptions
    set status = 'approved',
        processed_at = now(),
        processed_by = auth.uid(),
        tracking_info = p_tracking_info
    where id = p_redemption_id;
  else
    -- Refund coins
    perform award_coins(v_redemption.member_id, v_redemption.cost_coins, 'redemption', p_redemption_id,
                        'Refund for rejected redemption');

    -- Restore stock
    update reward_catalog
    set stock = stock + 1
    where id = v_redemption.reward_id;

    update redemptions
    set status = 'rejected',
        processed_at = now(),
        processed_by = auth.uid()
    where id = p_redemption_id;
  end if;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'coins.redemption_processed', 'redemptions', p_redemption_id,
          jsonb_build_object('approved', p_approve, 'tracking_info', p_tracking_info));

  return case when p_approve then 'Redemption approved.' else 'Redemption rejected and coins refunded.' end;
end $$ language plpgsql security definer;
