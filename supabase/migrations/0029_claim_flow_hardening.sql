-- Phase 1 completion: claim submission, contributor search and proof uploads
--
--   1. search_members(): members can only read their own profile row, so the claim wizard needs a
--      narrow directory function to pick contributors.
--   2. submit_claim(): validates contributors properly, enforces the submit-on-behalf chain, and
--      stops claims against inactive or decrement activities.
--   3. proof_files: the insert policy allowed anyone to attach files to any claim and the select
--      policy compared a column with itself. Both are replaced; limits move into a trigger.
--   4. Storage policies for the private claim_proofs bucket (skipped with a notice if the
--      connecting role does not own storage.objects).
--   5. my_ledger_view: missing from the live database; recreated.

-- ============================================================
-- 1. Member directory (id + display fields only)
-- ============================================================

create or replace function search_members(p_query text default '', p_limit integer default 20)
returns table (id uuid, username text, display_name text, avatar_url text, branch_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.branch_id
  from profiles p
  where auth.uid() is not null
    and length(trim(coalesce(p_query, ''))) >= 2
    and (p.display_name ilike '%' || trim(p_query) || '%' or p.username ilike '%' || trim(p_query) || '%')
  order by p.display_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function search_members(text, integer) from public;
grant execute on function search_members(text, integer) to authenticated;

-- ============================================================
-- 2. submit_claim
-- ============================================================

-- Seniority used for the submit-on-behalf chain: Member < Team Lead/Domain Head < Council < Board.
create or replace function claim_chain_rank(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.has_role(array['board_member', 'admin'], p_user) then 4
    when public.has_role(array['council_member'], p_user) then 3
    when public.has_role(array['team_lead', 'domain_head'], p_user) then 2
    else 0
  end;
$$;

revoke execute on function claim_chain_rank(uuid) from public;
grant execute on function claim_chain_rank(uuid) to authenticated;

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
  v_share_sum integer;
  v_count integer;
  v_distinct integer;
  v_known integer;
  v_claimant uuid;
  v_submitter record;
  v_target record;
  v_member record;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_submitter from profiles where id = auth.uid();
  if not found then raise exception 'Submitter profile not found'; end if;

  select * into v_at from activity_types where id = p_activity_type_id;
  if not found then raise exception 'Activity type not found'; end if;
  if coalesce(to_jsonb(v_at) ->> 'is_active', 'true') = 'false' then raise exception 'This activity is not open for claims'; end if;
  if coalesce(to_jsonb(v_at) ->> 'kind', 'increment') <> 'increment' then
    raise exception 'Penalties cannot be claimed';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception 'A title is required'; end if;
  if p_activity_date is null or p_activity_date > current_date then
    raise exception 'Activity date cannot be in the future';
  end if;
  if coalesce(trim(p_analysis_pointers), '') = '' then
    raise exception 'Impact notes are required';
  end if;

  if p_suggested_exp < v_at.exp_min or p_suggested_exp > v_at.exp_max then
    raise exception 'Suggested EXP % outside range [%-%]', p_suggested_exp, v_at.exp_min, v_at.exp_max;
  end if;

  v_claimant := coalesce(p_submitted_on_behalf_of, auth.uid());

  -- Contributors: non-empty, distinct, real members, each 1..100, totalling exactly 100,
  -- and the claimant must be one of them.
  if p_contributors is null or jsonb_typeof(p_contributors) <> 'array'
     or jsonb_array_length(p_contributors) = 0 then
    raise exception 'At least one contributor is required';
  end if;

  select count(*), count(distinct elem ->> 'member_id'),
         coalesce(sum((elem ->> 'share_percent')::int), 0)
    into v_count, v_distinct, v_share_sum
  from jsonb_array_elements(p_contributors) as elem;

  if v_count <> v_distinct then raise exception 'A contributor is listed more than once'; end if;
  if v_share_sum <> 100 then raise exception 'Contributor shares must total 100, got %', v_share_sum; end if;
  if exists (
    select 1 from jsonb_array_elements(p_contributors) as elem
    where (elem ->> 'share_percent')::int < 1 or (elem ->> 'share_percent')::int > 100
  ) then
    raise exception 'Each share must be between 1 and 100';
  end if;

  select count(*) into v_known
  from jsonb_array_elements(p_contributors) as elem
  join profiles p on p.id = (elem ->> 'member_id')::uuid;
  if v_known <> v_count then raise exception 'Unknown contributor'; end if;

  if not exists (
    select 1 from jsonb_array_elements(p_contributors) as elem
    where (elem ->> 'member_id')::uuid = v_claimant
  ) then
    raise exception 'The claimant must be one of the contributors';
  end if;

  if p_submitted_on_behalf_of is not null then
    if p_submitted_on_behalf_of = auth.uid() then
      raise exception 'Submit your own claim without choosing "submit for"';
    end if;
    select * into v_target from profiles where id = p_submitted_on_behalf_of;
    if not found then raise exception 'Target member not found'; end if;

    -- Chain rule: only someone above the member, within their scope.
    if claim_chain_rank(auth.uid()) <= claim_chain_rank(p_submitted_on_behalf_of)
       or claim_chain_rank(auth.uid()) < 2 then
      raise exception 'You cannot submit on behalf of this member';
    end if;
    if claim_chain_rank(auth.uid()) = 2 and v_submitter.domain_id is distinct from v_target.domain_id then
      raise exception 'You can only submit for members in your own domain';
    end if;
    if claim_chain_rank(auth.uid()) = 3 and v_submitter.branch_id is distinct from v_target.branch_id then
      raise exception 'You can only submit for members in your own branch';
    end if;
    v_status := 'awaiting_confirmation';
  else
    v_status := 'submitted';
  end if;

  insert into claims (claimant_id, activity_type_id, title, description, activity_date,
                      evidence_links, suggested_exp, analysis_pointers, config_version_id,
                      submitted_on_behalf_of, submitted_by, status)
  values (v_claimant, p_activity_type_id, trim(p_title), p_description, p_activity_date,
          coalesce(p_evidence_links, '{}'), p_suggested_exp, p_analysis_pointers,
          (select id from config_versions order by effective_from desc limit 1),
          p_submitted_on_behalf_of, auth.uid(), v_status)
  returning id into v_claim_id;

  for v_member in
    select (elem ->> 'member_id')::uuid as member_id, (elem ->> 'share_percent')::int as share_percent
    from jsonb_array_elements(p_contributors) as elem
  loop
    insert into split_agreements (claim_id, member_id, share_percent)
    values (v_claim_id, v_member.member_id, v_member.share_percent);
  end loop;

  insert into audit_log (actor_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'claim.submitted', 'claims', v_claim_id,
          jsonb_build_object('suggested_exp', p_suggested_exp, 'status', v_status,
                             'submitted_on_behalf_of', p_submitted_on_behalf_of));

  return v_claim_id;
end $$ language plpgsql security definer set search_path = public, pg_temp;

-- ============================================================
-- 3. proof_files
-- ============================================================

drop policy if exists proof_files_own on proof_files;
create policy proof_files_own on proof_files
  for select using (
    exists (
      select 1 from claims c
      where c.id = proof_files.claim_id
        and (c.claimant_id = auth.uid() or c.submitted_by = auth.uid())
    )
    or exists (
      select 1 from split_agreements sa
      where sa.claim_id = proof_files.claim_id and sa.member_id = auth.uid()
    )
    or public.has_role(array['domain_head', 'team_lead', 'council_member', 'board', 'board_member', 'admin'], auth.uid())
  );

drop policy if exists proof_files_insert on proof_files;
create policy proof_files_insert on proof_files
  for insert with check (
    exists (
      select 1 from claims c
      where c.id = proof_files.claim_id
        and (c.claimant_id = auth.uid() or c.submitted_by = auth.uid())
        and c.status in ('submitted', 'awaiting_confirmation')
    )
  );

create or replace function enforce_proof_limits()
returns trigger
language plpgsql
as $$
begin
  if new.file_size > 2 * 1024 * 1024 then
    raise exception 'Proof files must be 2 MB or smaller';
  end if;
  if new.file_type not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm') then
    raise exception 'File type % is not allowed', new.file_type;
  end if;
  if (select count(*) from proof_files where claim_id = new.claim_id) >= 5 then
    raise exception 'A claim can have at most 5 proof files';
  end if;
  return new;
end $$;

drop trigger if exists proof_files_limits on proof_files;
create trigger proof_files_limits
  before insert on proof_files
  for each row execute function enforce_proof_limits();

-- ============================================================
-- 4. Storage policies (private bucket, path claims/<claim_id>/<file>)
-- ============================================================

do $$
begin
  drop policy if exists claim_proofs_insert on storage.objects;
  create policy claim_proofs_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'claim_proofs'
      and (storage.foldername(name))[1] = 'claims'
      and exists (
        select 1 from public.claims c
        where c.id::text = (storage.foldername(name))[2]
          and (c.claimant_id = auth.uid() or c.submitted_by = auth.uid())
      )
    );

  drop policy if exists claim_proofs_select on storage.objects;
  create policy claim_proofs_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'claim_proofs'
      and (storage.foldername(name))[1] = 'claims'
      and (
        exists (
          select 1 from public.claims c
          where c.id::text = (storage.foldername(name))[2]
            and (c.claimant_id = auth.uid() or c.submitted_by = auth.uid())
        )
        or exists (
          select 1 from public.split_agreements sa
          where sa.claim_id::text = (storage.foldername(name))[2] and sa.member_id = auth.uid()
        )
        or public.has_role(array['domain_head', 'team_lead', 'council_member', 'board', 'board_member', 'admin'], auth.uid())
      )
    );
exception when insufficient_privilege then
  raise notice 'Skipped storage.objects policies: connecting role does not own the table. Add them in the Supabase dashboard.';
end $$;

-- ============================================================
-- 5. my_ledger_view
-- ============================================================

create or replace view my_ledger_view with (security_invoker = true) as
select le.id, le.amount, le.category, le.source, le.activity_date,
       at.name as activity_name, c.title as claim_title,
       le.created_at
from ledger_entries le
left join claims c on c.id = le.claim_id
left join activity_types at on at.id = c.activity_type_id
where le.member_id = auth.uid();

revoke all on my_ledger_view from anon, public;
grant select on my_ledger_view to authenticated;
